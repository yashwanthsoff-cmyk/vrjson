export type UsageState = 'used' | 'unused' | 'unknown'
export type FindingType = 'unused' | 'stale_grant' | 'peer_outlier' | 'mover_carryover' | 'manual'
export type AppName = 'Google Workspace' | 'Microsoft Entra' | 'GitHub'
export type FindingStatus = 'open' | 'in_review' | 'handed_off' | 'kept' | 'deferred' | 'justified'

export const DEMO_NOW = '2026-10-23T00:00:00Z'
export const DEMO_DATE = 'Oct 23, 2026'

export type User = {
  id: string
  name: string
  pseudonym: string
  department: string
  title: string
  seniority: string
  employmentType: 'employee' | 'contractor' | 'guest'
  startDate: string
  manager: string
  lastSeen: string
}

export type Entitlement = {
  id: string
  app: AppName
  name: string
  kind: 'role' | 'group' | 'permission'
  level: 'read' | 'write' | 'admin'
  sensitivity: 'low' | 'medium' | 'high' | 'admin'
  categories: string[]
  downgradeTo?: string
  seasonal?: boolean
}

export type Finding = {
  id: string
  userId: string
  entitlementId: string
  type: FindingType
  secondaryTypes: FindingType[]
  riskScore: number
  confidence: 'high' | 'medium' | 'low'
  confidenceReason: string
  usage: { state: UsageState; lastUsedAt: string | null; observedDays: number; windowDays: number; dormantAccount: boolean; evidenceIds: string[]; decisionPath: string[] }
  recommendation: 'Review' | 'Revoke' | 'Downgrade' | 'Keep'
  recommendationPath: string[]
  blastRadius: { actions: number; resources: number } | null
  peerText?: string
  status: FindingStatus
  ownerId: string
  dueDate: string
  evidenceIds: string[]
  evidenceCompleteness: number
  createdAt: string
}

export type Evidence = {
  id: string
  type: 'grant' | 'activity' | 'peer_calc' | 'role_change' | 'coverage'
  label: string
  source: string
  at: string
  derived?: boolean
  payload: Record<string, string | number | boolean>
}

export type ActivityEvent = { id: string; userId: string; app: AppName; at: string; action: string; resource: string; actionClass: 'read' | 'write' | 'export' | 'admin'; mapped: boolean }
export type AuditEvent = { id: string; at: string; action: string; target: string; actor: string; detail: string; hash: string }
export type Handoff = { id: string; findingId: string; assignee: string; status: 'requested' | 'acknowledged' | 'done_self_reported'; requestedAt: string; note: string }

export const users: User[] = [
  { id: 'u-meera', name: 'Meera Iyer', pseudonym: 'Person 014', department: 'Support', title: 'Support Specialist', seniority: 'mid', employmentType: 'employee', startDate: '2023-02-10', manager: 'Priya Shah', lastSeen: '2026-10-22' },
  { id: 'u-rohan', name: 'Rohan Das', pseudonym: 'Person 027', department: 'Data Analytics', title: 'Data Analyst', seniority: 'senior', employmentType: 'employee', startDate: '2022-08-21', manager: 'Nisha Verma', lastSeen: '2026-10-22' },
  { id: 'u-karthik', name: 'Karthik Menon', pseudonym: 'Person 031', department: 'Finance', title: 'Finance Contractor', seniority: 'mid', employmentType: 'contractor', startDate: '2024-01-05', manager: 'Vikram Shah', lastSeen: '2026-06-03' },
  { id: 'u-divya', name: 'Divya Nambiar', pseudonym: 'Person 009', department: 'Marketing', title: 'Marketing Analyst', seniority: 'mid', employmentType: 'employee', startDate: '2023-07-12', manager: 'Asha Rao', lastSeen: '2026-10-21' },
  { id: 'u-aarav', name: 'Aarav Khanna', pseudonym: 'Person 044', department: 'Engineering', title: 'Software Engineer', seniority: 'junior', employmentType: 'employee', startDate: '2026-10-12', manager: 'Asha Rao', lastSeen: '2026-10-22' },
  { id: 'u-sana', name: 'Sana Kapoor', pseudonym: 'Person 052', department: 'Engineering', title: 'Platform Engineer', seniority: 'senior', employmentType: 'employee', startDate: '2021-04-06', manager: 'Asha Rao', lastSeen: '2026-10-22' },
  { id: 'u-tara', name: 'Tara Bose', pseudonym: 'Person 018', department: 'Sales', title: 'Account Executive', seniority: 'mid', employmentType: 'employee', startDate: '2023-11-03', manager: 'Priya Shah', lastSeen: '2026-10-20' },
]

export const entitlements: Entitlement[] = [
  { id: 'e-drive-admin', app: 'Google Workspace', name: 'Finance Shared Drive · Admin', kind: 'role', level: 'admin', sensitivity: 'admin', categories: ['admin', 'billing', 'pii'], downgradeTo: 'e-drive-write' },
  { id: 'e-drive-write', app: 'Google Workspace', name: 'Finance Shared Drive · Contributor', kind: 'role', level: 'write', sensitivity: 'high', categories: ['billing'] },
  { id: 'e-export', app: 'Google Workspace', name: 'Quarter-close export', kind: 'permission', level: 'write', sensitivity: 'high', categories: ['export'], seasonal: true },
  { id: 'e-support-admin', app: 'Google Workspace', name: 'Support group · Admin', kind: 'group', level: 'admin', sensitivity: 'admin', categories: ['admin'], downgradeTo: 'e-support-read' },
  { id: 'e-support-read', app: 'Google Workspace', name: 'Support group · Reader', kind: 'group', level: 'read', sensitivity: 'medium', categories: ['standard'] },
  { id: 'e-github-write', app: 'GitHub', name: 'acme/platform · Write', kind: 'permission', level: 'write', sensitivity: 'high', categories: ['repo_write'], downgradeTo: 'e-github-read' },
  { id: 'e-github-read', app: 'GitHub', name: 'acme/platform · Read', kind: 'permission', level: 'read', sensitivity: 'medium', categories: ['standard'] },
  { id: 'e-entra-admin', app: 'Microsoft Entra', name: 'Directory Readers · Admin', kind: 'role', level: 'admin', sensitivity: 'admin', categories: ['admin'] },
  { id: 'e-entra-app', app: 'Microsoft Entra', name: 'Billing app · User', kind: 'role', level: 'read', sensitivity: 'high', categories: ['billing'] },
  { id: 'e-repo-export', app: 'GitHub', name: 'Release artifacts · Export', kind: 'permission', level: 'write', sensitivity: 'high', categories: ['export'] },
]

const usage = (state: UsageState, observedDays: number, windowDays: number, lastUsedAt: string | null, evidenceIds: string[], dormantAccount = false) => ({ state, observedDays, windowDays, lastUsedAt, evidenceIds, dormantAccount, decisionPath: state === 'unknown' ? [`Only ${observedDays} days of logs. Cannot judge.`] : state === 'unused' ? [`No mapped events in the ${windowDays}-day window.`, `${observedDays} of ${windowDays} days observed.`] : ['A mapped event falls inside the active observation window.'] })

export const findings: Finding[] = [
  { id: 'f-001', userId: 'u-karthik', entitlementId: 'e-drive-admin', type: 'unused', secondaryTypes: ['stale_grant'], riskScore: 87, confidence: 'high', confidenceReason: '180 days observed with no mapped activity.', usage: usage('unused', 180, 45, null, ['ev-grant-karthik', 'ev-coverage-google'], true), recommendation: 'Revoke', recommendationPath: ['Usage is unused for the admin window.', 'Full 180-day coverage is available.', 'No owned shared resources or recent actions.', 'Dormant account makes revoke the highest available recommendation.'], blastRadius: { actions: 0, resources: 0 }, status: 'open', ownerId: 'rev-asha', dueDate: '2026-10-20', evidenceIds: ['ev-grant-karthik', 'ev-coverage-google'], evidenceCompleteness: 1, createdAt: '2026-10-01' },
  { id: 'f-002', userId: 'u-divya', entitlementId: 'e-support-admin', type: 'peer_outlier', secondaryTypes: [], riskScore: 78, confidence: 'high', confidenceReason: '24 employees in an unambiguous title group.', usage: usage('unused', 180, 45, '2026-01-02', ['ev-activity-divya', 'ev-peer-divya']), recommendation: 'Downgrade', recommendationPath: ['Usage is unused for the admin window.', 'Peer prevalence is below the configurable threshold.', 'A lower privilege entitlement is available.', 'No blast radius detected in observed activity.'], blastRadius: { actions: 0, resources: 0 }, peerText: 'Held by 1 of 24 peers (4%)', status: 'open', ownerId: 'rev-asha', dueDate: '2026-10-25', evidenceIds: ['ev-activity-divya', 'ev-peer-divya'], evidenceCompleteness: 1, createdAt: '2026-10-05' },
  { id: 'f-003', userId: 'u-meera', entitlementId: 'e-drive-admin', type: 'mover_carryover', secondaryTypes: ['peer_outlier'], riskScore: 82, confidence: 'medium', confidenceReason: 'New peer baseline includes a contractor.', usage: usage('unused', 143, 45, null, ['ev-role-meera', 'ev-peer-meera']), recommendation: 'Revoke', recommendationPath: ['Permission carried over after a department and manager change.', 'No mapped activity since the move.', 'New-team prevalence is below the configurable threshold.'], blastRadius: { actions: 0, resources: 0 }, peerText: 'Held by 1 of 8 new peers (12%)', status: 'open', ownerId: 'rev-asha', dueDate: '2026-10-26', evidenceIds: ['ev-role-meera', 'ev-peer-meera'], evidenceCompleteness: 1, createdAt: '2026-09-18' },
  { id: 'f-004', userId: 'u-aarav', entitlementId: 'e-github-write', type: 'unused', secondaryTypes: [], riskScore: 41, confidence: 'low', confidenceReason: 'Only 11 days of logs.', usage: usage('unknown', 11, 45, null, ['ev-coverage-aarav']), recommendation: 'Review', recommendationPath: ['Coverage is shorter than the configured window.', 'Unknown usage cannot be revoked or downgraded.', 'Review manually once more history is available.'], blastRadius: null, status: 'open', ownerId: 'rev-vikram', dueDate: '2026-10-24', evidenceIds: ['ev-coverage-aarav'], evidenceCompleteness: 1, createdAt: '2026-10-17' },
  { id: 'f-005', userId: 'u-tara', entitlementId: 'e-export', type: 'unused', secondaryTypes: [], riskScore: 36, confidence: 'low', confidenceReason: 'Seasonal permission; history under 365 days.', usage: usage('unused', 180, 180, null, ['ev-coverage-google', 'ev-grant-tara']), recommendation: 'Review', recommendationPath: ['Permission is marked seasonal.', 'History is shorter than the configured stale-grant horizon.', 'Review rather than revoke.'], blastRadius: { actions: 0, resources: 0 }, status: 'in_review', ownerId: 'rev-asha', dueDate: '2026-10-23', evidenceIds: ['ev-coverage-google', 'ev-grant-tara'], evidenceCompleteness: 1, createdAt: '2026-09-25' },
  { id: 'f-006', userId: 'u-rohan', entitlementId: 'e-entra-app', type: 'mover_carryover', secondaryTypes: [], riskScore: 24, confidence: 'high', confidenceReason: 'Grace period is still active.', usage: usage('unknown', 11, 45, null, ['ev-role-rohan', 'ev-coverage-entra']), recommendation: 'Keep', recommendationPath: ['Role change is inside the configurable grace period.', 'No finding is queued yet.'], blastRadius: null, status: 'kept', ownerId: 'rev-asha', dueDate: '2026-11-11', evidenceIds: ['ev-role-rohan', 'ev-coverage-entra'], evidenceCompleteness: 1, createdAt: '2026-10-12' },
  { id: 'f-007', userId: 'u-sana', entitlementId: 'e-github-write', type: 'stale_grant', secondaryTypes: [], riskScore: 52, confidence: 'medium', confidenceReason: 'Grant is older than the stale-grant default.', usage: usage('used', 180, 45, '2026-10-20', ['ev-grant-sana', 'ev-activity-sana']), recommendation: 'Review', recommendationPath: ['Admin or high-sensitivity grant is older than the stale-grant horizon.', 'Recent use prevents revoke or downgrade.', 'Human review is required.'], blastRadius: { actions: 12, resources: 1 }, status: 'open', ownerId: 'rev-vikram', dueDate: '2026-10-28', evidenceIds: ['ev-grant-sana', 'ev-activity-sana'], evidenceCompleteness: 1, createdAt: '2026-10-08' },
  { id: 'f-008', userId: 'u-meera', entitlementId: 'e-repo-export', type: 'mover_carryover', secondaryTypes: [], riskScore: 59, confidence: 'medium', confidenceReason: 'Small new peer group.', usage: usage('unused', 143, 45, null, ['ev-role-meera', 'ev-peer-meera']), recommendation: 'Review', recommendationPath: ['Permission carried over after the move.', 'Permission is unused, but peer confidence is low.', 'Review the access context before a handoff.'], blastRadius: { actions: 0, resources: 0 }, peerText: 'Held by 1 of 8 new peers (12%)', status: 'open', ownerId: 'rev-asha', dueDate: '2026-10-29', evidenceIds: ['ev-role-meera', 'ev-peer-meera'], evidenceCompleteness: 1, createdAt: '2026-09-18' },
]

export const evidence: Evidence[] = [
  { id: 'ev-grant-karthik', type: 'grant', label: 'Finance Shared Drive admin grant', source: 'Google Workspace snapshot · 2026-04-26', at: '2026-04-26', payload: { grantAgeDays: 180, privilegeLevel: 'admin', source: 'group_inheritance' } },
  { id: 'ev-coverage-google', type: 'coverage', label: 'Google Workspace observation coverage', source: 'Connector retention metadata', at: '2026-10-23', payload: { observedDays: 180, windowDays: 180, complete: true }, derived: true },
  { id: 'ev-activity-divya', type: 'activity', label: 'Last mapped admin event', source: 'Google Workspace activity stream', at: '2026-01-02', payload: { daysAgo: 294, actionClass: 'read', mapped: true } },
  { id: 'ev-peer-divya', type: 'peer_calc', label: 'Marketing Analyst peer prevalence', source: 'Peer calculation · department + title', at: '2026-10-23', payload: { holders: 1, peerCount: 24, prevalencePct: 4 }, derived: true },
  { id: 'ev-role-meera', type: 'role_change', label: 'Sales → Support move', source: 'Directory attribute diff', at: '2026-06-02', payload: { previousDepartment: 'Sales', newDepartment: 'Support', changeTypes: 'title, department, manager' } },
  { id: 'ev-peer-meera', type: 'peer_calc', label: 'Support peer prevalence', source: 'Peer calculation · department + title', at: '2026-10-23', payload: { holders: 1, peerCount: 8, prevalencePct: 12 }, derived: true },
  { id: 'ev-coverage-aarav', type: 'coverage', label: 'Short observation window', source: 'GitHub connector retention metadata', at: '2026-10-23', payload: { observedDays: 11, windowDays: 45, complete: true }, derived: true },
  { id: 'ev-grant-tara', type: 'grant', label: 'Quarter-close export grant', source: 'Google Workspace snapshot · 2026-05-14', at: '2026-05-14', payload: { seasonal: true, dataSensitivity: 'high', source: 'admin_console' } },
  { id: 'ev-role-rohan', type: 'role_change', label: 'Engineering → Data Analytics move', source: 'HR feed · simulated', at: '2026-10-12', payload: { previousDepartment: 'Engineering', newDepartment: 'Data Analytics', graceDays: 30 } },
  { id: 'ev-coverage-entra', type: 'coverage', label: 'Entra 30-day retention window', source: 'Connector card', at: '2026-10-23', payload: { observedDays: 30, windowDays: 45, complete: true }, derived: true },
  { id: 'ev-grant-sana', type: 'grant', label: 'Platform repository write grant', source: 'GitHub snapshot · 2025-10-01', at: '2025-10-01', payload: { grantAgeDays: 387, privilegeLevel: 'write', source: 'admin_console' } },
  { id: 'ev-activity-sana', type: 'activity', label: 'Recent repository push', source: 'GitHub activity stream', at: '2026-10-20', payload: { daysAgo: 3, actionClass: 'write', mapped: true } },
]

export const activity: ActivityEvent[] = [
  { id: 'a-1', userId: 'u-sana', app: 'GitHub', at: '2026-10-20', action: 'repo.push', resource: 'acme/platform', actionClass: 'write', mapped: true },
  { id: 'a-2', userId: 'u-divya', app: 'Google Workspace', at: '2026-01-02', action: 'drive.read', resource: 'marketing/briefs', actionClass: 'read', mapped: true },
  { id: 'a-3', userId: 'u-meera', app: 'Google Workspace', at: '2026-09-04', action: 'drive.read', resource: 'support/handbook', actionClass: 'read', mapped: true },
  { id: 'a-4', userId: 'u-tara', app: 'Google Workspace', at: '2026-10-12', action: 'export.csv', resource: 'quarter-close', actionClass: 'export', mapped: false },
  { id: 'a-5', userId: 'u-rohan', app: 'Microsoft Entra', at: '2026-10-18', action: 'billing.view', resource: 'billing-app', actionClass: 'read', mapped: true },
]

export const handoffs: Handoff[] = [
  { id: 'h-1', findingId: 'f-002', assignee: 'Vikram Shah', status: 'acknowledged', requestedAt: '2026-10-18', note: 'Please confirm the replacement role is sufficient.' },
  { id: 'h-2', findingId: 'f-003', assignee: 'Priya Shah', status: 'requested', requestedAt: '2026-10-21', note: 'Administrator performs the change in the connected app.' },
  { id: 'h-3', findingId: 'f-005', assignee: 'Asha Rao', status: 'done_self_reported', requestedAt: '2026-10-10', note: 'Self-reported completion; no connected-app verification.' },
]

export const auditSeed: AuditEvent[] = [
  { id: 'au-1', at: '2026-10-23 09:41', action: 'finding.viewed', target: 'f-002', actor: 'Asha Rao', detail: 'Opened Divya Nambiar peer outlier.', hash: '9d4f…82aa' },
  { id: 'au-2', at: '2026-10-22 16:17', action: 'sync.run', target: 'Google Workspace', actor: 'Vikram Shah', detail: 'Simulated scheduled sync; 4 changes.', hash: '2c18…7b04' },
  { id: 'au-3', at: '2026-10-22 14:09', action: 'explanation.validated', target: 'f-005', actor: 'Asha Rao', detail: 'Claims linked 4/4.', hash: '8aa1…3f10' },
  { id: 'au-4', at: '2026-10-21 11:32', action: 'exception.created', target: 'f-006', actor: 'Vikram Shah', detail: 'Justified through 2026-11-20.', hash: '47b3…ca90' },
]

export const settings = { adminWindowDays: 45, standardWindowDays: 180, peerThresholdPct: 10, minPeerCount: 5, graceDays: 30, staleGrantDays: 365, staleReviewDays: 180, mode: 'department_title' as const, coverageMinDays: 90 }
export const connectors = [
  { app: 'Google Workspace' as AppName, status: 'Active', coverage: 180, dataAsOf: '2026-10-23', note: 'Synthetic retention window for the demo.' },
  { app: 'Microsoft Entra' as AppName, status: 'Active', coverage: 30, dataAsOf: '2026-10-23', note: 'Mirrors a 30-day documented retention assumption; usage can be unknown.' },
  { app: 'GitHub' as AppName, status: 'Active', coverage: 90, dataAsOf: '2026-10-23', note: 'Illustrative retention, not a documented figure.' },
]

export const getUser = (id: string) => users.find((user) => user.id === id) ?? users[0]
export const getEntitlement = (id: string) => entitlements.find((item) => item.id === id) ?? entitlements[0]
export const getFinding = (id: string) => findings.find((item) => item.id === id) ?? findings[0]
export const getEvidence = (id: string) => evidence.find((item) => item.id === id) ?? evidence[0]
export const displayName = (user: User, pseudonyms: boolean) => pseudonyms ? user.pseudonym : user.name
export const findingLabel = (finding: Finding) => ({ unused: 'Unused access', peer_outlier: 'Peer outlier', mover_carryover: 'Mover carry-over', stale_grant: 'Stale privileged grant', manual: 'Manual review' }[finding.type])
export const openFindings = () => findings.filter((finding) => ['open', 'in_review'].includes(finding.status))
export const overdueFindings = () => openFindings().filter((finding) => finding.dueDate <= '2026-10-23')
export const dueSoonFindings = () => openFindings().filter((finding) => finding.dueDate > '2026-10-23' && finding.dueDate <= '2026-10-26')
export const counts = () => ({ open: openFindings().length, overdue: overdueFindings().length, dueSoon: dueSoonFindings().length, unknown: findings.filter((finding) => finding.usage.state === 'unknown').length, handoffs: handoffs.filter((item) => item.status !== 'done_self_reported').length, unmapped: activity.filter((item) => !item.mapped).length })

export const peerGroups = [
  { id: 'pg-marketing-analyst', label: 'Marketing · Analyst', members: 24, contractors: 0, ambiguous: 0, confidence: 'high', prevalence: '1 of 24 peers (4%)' },
  { id: 'pg-support-specialist', label: 'Support · Specialist', members: 8, contractors: 1, ambiguous: 0, confidence: 'medium', prevalence: '1 of 8 peers (12%)' },
  { id: 'pg-engineering', label: 'Engineering · Seniority', members: 13, contractors: 2, ambiguous: 1, confidence: 'medium', prevalence: '5 of 13 peers (38%)' },
  { id: 'pg-small-team', label: 'Finance · Small team', members: 3, contractors: 1, ambiguous: 0, confidence: 'low', prevalence: '1 of 3 peers (33%)' },
]

export const snapshots = [
  { id: 'snap-google-20261023', app: 'Google Workspace', date: '2026-10-23', complete: true, members: 31, hash: 'sha256:9d4f…82aa', changes: '+3 / −1' },
  { id: 'snap-entra-20260312', app: 'Microsoft Entra', date: '2026-03-12', complete: false, members: 26, hash: 'skipped · incomplete', changes: '+0 / −0' },
  { id: 'snap-google-20260514', app: 'Google Workspace', date: '2026-05-14', complete: true, members: 28, hash: 'sha256:2c18…7b04', changes: '+5 / −2' },
  { id: 'snap-github-20261016', app: 'GitHub', date: '2026-10-16', complete: true, members: 17, hash: 'sha256:47b3…ca90', changes: '+1 / −0' },
]

export const roleChanges = [
  { id: 'rc-meera', userId: 'u-meera', date: '2026-06-02', from: 'Sales', to: 'Support', status: 'Past grace', changeTypes: 'title · department · manager', carryover: 6, unused: 4 },
  { id: 'rc-rohan', userId: 'u-rohan', date: '2026-10-12', from: 'Engineering', to: 'Data Analytics', status: 'In grace', changeTypes: 'department · manager', carryover: 3, unused: 0 },
]

export const usageRows = findings.map((finding) => ({ finding, user: getUser(finding.userId), entitlement: getEntitlement(finding.entitlementId) }))

export const getExplanation = (finding: Finding) => {
  const user = getUser(finding.userId)
  const entitlement = getEntitlement(finding.entitlementId)
  const claims = finding.evidenceIds.map((id, index) => ({ id: `claim-${finding.id}-${index + 1}`, text: index === 0 ? `${user.name} holds ${entitlement.name}.` : index === 1 ? `${finding.peerText ?? 'The grant has no mapped activity in the configured window.'}` : 'The recommendation is capped by available evidence.', evidenceId: id, passed: true }))
  return { sentences: claims.map((claim) => claim.text), claims, wording: 'template' as const }
}
