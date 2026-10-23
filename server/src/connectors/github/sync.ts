import { GitHubClient, type Coverage } from './client.js'
import { normalizeUser, normalizeCollaboratorToEntitlement, normalizeCollaboratorToGrant, generateGrantId } from './normalize.js'
import { logger } from '../../logger.js'
import { env } from '../../env.js'
import { randomUUID } from 'crypto'

export interface SyncResult {
  success: boolean
  coverage: Record<string, Coverage>
  counts: {
    users: number
    entitlements: number
    grants: number
  }
  data?: {
    users: any[]
    entitlements: any[]
    grants: any[]
  }
  error?: string
}

export async function syncGitHub(): Promise<SyncResult> {
  const client = new GitHubClient()
  const coverage: Record<string, Coverage> = {}
  const counts = { users: 0, entitlements: 0, grants: 0 }

  try {
    // Step 1: Authenticate and get user
    logger.info('Starting GitHub sync: authenticate')
    const { user, coverage: userCoverage } = await client.getAuthenticatedUser()
    coverage['GET /user'] = userCoverage

    if (!user) {
      return {
        success: false,
        coverage,
        counts,
        error: 'Failed to authenticate with GitHub',
      }
    }

    logger.info({ user: user.login }, 'GitHub authenticated')

    // Step 2: Get repos
    logger.info('Fetching repositories')
    let repos: Awaited<ReturnType<typeof client.getUserRepos>>['repos'] = []

    if (env.GITHUB_ORG) {
      const result = await client.getOrgRepos(env.GITHUB_ORG)
      coverage[`GET /orgs/${env.GITHUB_ORG}/repos`] = result.coverage
      repos = result.repos
    } else {
      const result = await client.getUserRepos()
      coverage['GET /user/repos'] = result.coverage
      repos = result.repos
    }

    logger.info({ repoCount: repos.length }, 'Repositories fetched')

    // Step 3: For each repo, get collaborators
    const grants: any[] = []
    const entitlements: any[] = []
    const users = new Map<number, any>()

    for (const repo of repos) {
      if (repo.archived) {
        logger.info({ repo: repo.full_name }, 'Skipping archived repo')
        continue
      }

      logger.info({ repo: repo.full_name }, 'Fetching collaborators')

      const { collaborators, coverage: collabCoverage } = await client.getRepoCollaborators(
        repo.owner.login,
        repo.name
      )
      coverage[`GET /repos/${repo.owner.login}/${repo.name}/collaborators`] = collabCoverage

      if (collabCoverage.status === 'error' || collabCoverage.status === 'forbidden') {
        logger.warn(
          { repo: repo.full_name, error: collabCoverage.error },
          'Cannot fetch collaborators (insufficient permissions)'
        )
        continue
      }

      for (const collaborator of collaborators) {
        // Normalize user
        if (!users.has(collaborator.id)) {
          users.set(collaborator.id, {
            id: `github-${collaborator.id}`,
            displayName: collaborator.login,
            pseudonym: collaborator.login,
            department: 'unknown',
            title: 'unknown',
            managerId: null,
            employmentType: 'employee',
            startDate: new Date().toISOString().split('T')[0],
            seniority: 'mid',
          })
          counts.users++
        }

        // Normalize entitlement
        const entitlement = normalizeCollaboratorToEntitlement(repo, collaborator)
        if (!entitlements.find((e) => e.id === entitlement.id)) {
          entitlements.push(entitlement)
          counts.entitlements++
        }

        // Normalize grant
        const grantBase = normalizeCollaboratorToGrant(repo, collaborator, `snap-${randomUUID()}`)
        const grant = {
          ...grantBase,
          id: generateGrantId(grantBase.userId, grantBase.entitlementId),
        }
        grants.push(grant)
        counts.grants++
      }
    }

    logger.info(
      { users: counts.users, entitlements: counts.entitlements, grants: counts.grants },
      'GitHub sync complete'
    )

    return {
      success: true,
      coverage,
      counts,
      data: {
        users: Array.from(users.values()),
        entitlements,
        grants,
      },
    }
  } catch (error) {
    logger.error({ error }, 'GitHub sync failed')
    return {
      success: false,
      coverage,
      counts,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
