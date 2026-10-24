import type { User, Entitlement, Grant } from '@contract'
import type { GitHubUser, GitHubRepo, GitHubCollaborator } from './client.js'
import { logger } from '../../logger.js'

export function normalizeUser(githubUser: GitHubUser): User {
  return {
    id: `github-${githubUser.id}`,
    displayName: githubUser.name || githubUser.login,
    pseudonym: githubUser.login,
    department: 'unknown',
    title: 'unknown',
    managerId: null,
    employmentType: 'employee',
    startDate: new Date().toISOString().split('T')[0],
    seniority: 'mid',
  }
}

export function normalizePermissionLevel(permissions: GitHubCollaborator['permissions']): 'read' | 'write' | 'admin' {
  if (permissions.admin) return 'admin'
  if (permissions.maintain || permissions.push) return 'write'
  if (permissions.triage || permissions.pull) return 'read'
  return 'read'
}

export function normalizeCollaboratorToEntitlement(
  repo: GitHubRepo,
  collaborator: GitHubCollaborator
): Entitlement {
  const permissionLevel = normalizePermissionLevel(collaborator.permissions)

  return {
    id: `github:${repo.id}:${permissionLevel}`,
    app: 'github',
    name: `${repo.full_name}:${permissionLevel}`,
    kind: 'permission',
    privilegeLevel: permissionLevel,
    dataSensitivity: repo.private ? 'confidential' : 'public',
    categories: repo.private ? ['private-repo'] : ['public-repo'],
    seasonal: false,
    version: 1,
  }
}

export function normalizeCollaboratorToGrant(
  repo: GitHubRepo,
  collaborator: GitHubCollaborator,
  snapshotId: string
): Omit<Grant, 'id'> {
  const permissionLevel = normalizePermissionLevel(collaborator.permissions)

  return {
    userId: `github-${collaborator.id}`,
    entitlementId: `github:${repo.id}:${permissionLevel}`,
    app: 'github',
    grantedAt: new Date().toISOString(),
    removedAt: null,
    source: 'github_api',
    firstSeenSnapshotId: snapshotId,
    lastSeenSnapshotId: null,
  }
}

export function generateGrantId(userId: string, entitlementId: string): string {
  return `grant-${userId}-${entitlementId}`
}
