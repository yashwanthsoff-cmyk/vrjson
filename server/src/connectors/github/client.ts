import { env } from '../../env.js'
import { logger } from '../../logger.js'

export interface Coverage {
  endpoint: string
  status: 'success' | 'error' | 'rate_limited' | 'forbidden' | 'not_found'
  pages: number
  items: number
  complete: boolean
  error?: string
}

export interface GitHubUser {
  id: number
  login: string
  name: string | null
  email: string | null
}

export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  owner: { login: string }
  private: boolean
  archived: boolean
  visibility: 'public' | 'private'
}

export interface GitHubCollaborator {
  login: string
  id: number
  role_name: string
  permissions: {
    admin: boolean
    maintain: boolean
    push: boolean
    triage: boolean
    pull: boolean
  }
}

export interface GitHubOrg {
  id: number
  login: string
}

export interface GitHubTeam {
  id: number
  name: string
  slug: string
}

export interface GitHubMember {
  id: number
  login: string
}

export interface GitHubEvent {
  id: string
  type: string
  created_at: string
  actor: { id: number; login: string }
  repo: { id: number; name: string }
}

export class GitHubClient {
  private baseUrl = 'https://api.github.com'
  private timeout = 15000 // 15 seconds

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<{ data: T | null; rateLimit?: { remaining: number; reset: number }; error?: string }> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeout)

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': env.GITHUB_API_VERSION,
      ...((options.headers as Record<string, string>) || {}),
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      })

      clearTimeout(timeout)

      const rateLimit = {
        remaining: parseInt(response.headers.get('x-ratelimit-remaining') || '0'),
        reset: parseInt(response.headers.get('x-ratelimit-reset') || '0'),
      }

      if (response.status === 401) {
        return { data: null, rateLimit, error: 'Authentication failed: invalid token' }
      }

      if (response.status === 403) {
        const retryAfter = response.headers.get('retry-after')
        if (retryAfter) {
          const waitTime = parseInt(retryAfter) * 1000
          logger.warn({ rateLimitReset: waitTime }, 'GitHub rate limited, waiting')
          await new Promise((resolve) => setTimeout(resolve, waitTime))
          return this.request<T>(path, options)
        }
        return { data: null, rateLimit, error: 'Forbidden: insufficient permissions' }
      }

      if (response.status === 404) {
        return { data: null, rateLimit, error: 'Not found' }
      }

      if (response.status === 429) {
        return { data: null, rateLimit, error: 'Rate limited' }
      }

      if (response.status >= 500) {
        // Retry once on 5xx
        logger.warn({ status: response.status }, 'GitHub server error, retrying once')
        await new Promise((resolve) => setTimeout(resolve, 1000))
        const retry = await fetch(`${this.baseUrl}${path}`, {
          ...options,
          headers,
          signal: AbortSignal.timeout(this.timeout),
        })
        if (retry.ok) {
          const data = await retry.json() as T
          return { data, rateLimit }
        }
        return { data: null, rateLimit, error: `Server error: ${response.status}` }
      }

      if (!response.ok) {
        return { data: null, rateLimit, error: `HTTP ${response.status}` }
      }

      const data = await response.json() as T
      return { data, rateLimit }
    } catch (error) {
      clearTimeout(timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        return { data: null, error: 'Request timeout' }
      }
      logger.error({ error }, 'GitHub request failed')
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  private async *paginate<T>(path: string): AsyncGenerator<T, void, unknown> {
    let nextPath = path
    let pageCount = 0

    while (nextPath) {
      pageCount++
      const response = await fetch(`${this.baseUrl}${nextPath}`, {
        headers: {
          'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': env.GITHUB_API_VERSION,
        },
        signal: AbortSignal.timeout(this.timeout),
      })

      if (!response.ok) {
        throw new Error(`Pagination failed: ${response.status}`)
      }

      const items = await response.json() as T[]

      for (const item of items) {
        yield item
      }

      const linkHeader = response.headers.get('Link')
      if (!linkHeader) {
        break
      }

      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
      if (!nextMatch) {
        break
      }

      nextPath = nextMatch[1].replace(this.baseUrl, '')
    }

    logger.info({ path, pageCount }, 'Pagination complete')
  }

  async getAuthenticatedUser(): Promise<{ user: GitHubUser | null; coverage: Coverage }> {
    const coverage: Coverage = { endpoint: 'GET /user', status: 'success', pages: 1, items: 0, complete: false }

    const result = await this.request<GitHubUser>('/user')

    if (result.error) {
      coverage.status = result.error.includes('Authentication') ? 'error' : 'forbidden'
      coverage.error = result.error
      return { user: null, coverage }
    }

    coverage.items = 1
    coverage.complete = true
    return { user: result.data, coverage }
  }

  async getUserRepos(): Promise<{ repos: GitHubRepo[]; coverage: Coverage }> {
    const coverage: Coverage = { endpoint: 'GET /user/repos', status: 'success', pages: 0, items: 0, complete: false }

    const repos: GitHubRepo[] = []

    try {
      for await (const repo of this.paginate<GitHubRepo>('/user/repos?per_page=100&affiliation=owner,collaborator,organization_member')) {
        repos.push(repo)
        coverage.items++
      }
      coverage.complete = true
      coverage.status = 'success'
    } catch (error) {
      coverage.status = 'error'
      coverage.error = error instanceof Error ? error.message : 'Unknown error'
    }

    return { repos, coverage }
  }

  async getOrgRepos(org: string): Promise<{ repos: GitHubRepo[]; coverage: Coverage }> {
    const coverage: Coverage = { endpoint: `GET /orgs/${org}/repos`, status: 'success', pages: 0, items: 0, complete: false }

    const repos: GitHubRepo[] = []

    try {
      for await (const repo of this.paginate<GitHubRepo>(`/orgs/${org}/repos?per_page=100`)) {
        repos.push(repo)
        coverage.items++
      }
      coverage.complete = true
      coverage.status = 'success'
    } catch (error) {
      coverage.status = 'error'
      coverage.error = error instanceof Error ? error.message : 'Unknown error'
    }

    return { repos, coverage }
  }

  async getRepoCollaborators(owner: string, repo: string): Promise<{ collaborators: GitHubCollaborator[]; coverage: Coverage }> {
    const coverage: Coverage = { endpoint: `GET /repos/${owner}/${repo}/collaborators`, status: 'success', pages: 0, items: 0, complete: false }

    const collaborators: GitHubCollaborator[] = []

    try {
      for await (const collab of this.paginate<GitHubCollaborator>(`/repos/${owner}/${repo}/collaborators?affiliation=all`)) {
        collaborators.push(collab)
        coverage.items++
      }
      coverage.complete = true
      coverage.status = 'success'
    } catch (error) {
      coverage.status = 'error'
      coverage.error = error instanceof Error ? error.message : 'Unknown error'
    }

    return { collaborators, coverage }
  }

  async getUserOrgs(): Promise<{ orgs: GitHubOrg[]; coverage: Coverage }> {
    const coverage: Coverage = { endpoint: 'GET /user/orgs', status: 'success', pages: 0, items: 0, complete: false }

    const orgs: GitHubOrg[] = []

    try {
      for await (const org of this.paginate<GitHubOrg>('/user/orgs?per_page=100')) {
        orgs.push(org)
        coverage.items++
      }
      coverage.complete = true
      coverage.status = 'success'
    } catch (error) {
      coverage.status = 'error'
      coverage.error = error instanceof Error ? error.message : 'Unknown error'
    }

    return { orgs, coverage }
  }

  async getOrgMembers(org: string): Promise<{ members: GitHubMember[]; coverage: Coverage }> {
    const coverage: Coverage = { endpoint: `GET /orgs/${org}/members`, status: 'success', pages: 0, items: 0, complete: false }

    const members: GitHubMember[] = []

    try {
      for await (const member of this.paginate<GitHubMember>(`/orgs/${org}/members?per_page=100`)) {
        members.push(member)
        coverage.items++
      }
      coverage.complete = true
      coverage.status = 'success'
    } catch (error) {
      coverage.status = 'error'
      coverage.error = error instanceof Error ? error.message : 'Unknown error'
    }

    return { members, coverage }
  }

  async getOrgTeams(org: string): Promise<{ teams: GitHubTeam[]; coverage: Coverage }> {
    const coverage: Coverage = { endpoint: `GET /orgs/${org}/teams`, status: 'success', pages: 0, items: 0, complete: false }

    const teams: GitHubTeam[] = []

    try {
      for await (const team of this.paginate<GitHubTeam>(`/orgs/${org}/teams?per_page=100`)) {
        teams.push(team)
        coverage.items++
      }
      coverage.complete = true
      coverage.status = 'success'
    } catch (error) {
      coverage.status = 'error'
      coverage.error = error instanceof Error ? error.message : 'Unknown error'
    }

    return { teams, coverage }
  }

  async getRepoEvents(owner: string, repo: string): Promise<{ events: GitHubEvent[]; coverage: Coverage }> {
    const coverage: Coverage = { endpoint: `GET /repos/${owner}/${repo}/events`, status: 'success', pages: 0, items: 0, complete: false }

    const events: GitHubEvent[] = []

    try {
      for await (const event of this.paginate<GitHubEvent>(`/repos/${owner}/${repo}/events?per_page=100`)) {
        events.push(event)
        coverage.items++
      }
      coverage.complete = true
      coverage.status = 'success'
    } catch (error) {
      coverage.status = 'error'
      coverage.error = error instanceof Error ? error.message : 'Unknown error'
    }

    return { events, coverage }
  }
}
