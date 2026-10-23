import { auditSeed, evidence, findings, getExplanation, getFinding, getUser, handoffs, activity, snapshots, users, entitlements, peerGroups, roleChanges, settings, connectors, type AuditEvent, type Finding } from './data'

const wait = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms))
let audit = [...auditSeed]
let currentFindings = [...findings]
let currentHandoffs = [...handoffs]

const log = (action: string, target: string, detail: string) => {
  const event: AuditEvent = { id: `au-live-${audit.length + 1}`, at: '2026-10-23 11:54', action, target, actor: 'Asha Rao', detail, hash: `live…${String(audit.length + 1).padStart(4, '0')}` }
  audit = [event, ...audit]
  return event
}

export const api = {
  async getFindings(): Promise<Finding[]> { await wait(); return [...currentFindings] },
  async getFinding(id: string) { await wait(); const finding = currentFindings.find((item) => item.id === id) ?? getFinding(id); log('finding.viewed', id, `Opened ${getUser(finding.userId).name}.`); return finding },
  async decide(id: string, decision: 'keep' | 'send_to_review' | 'defer' | 'mark_justified' | 'approve_revoke' | 'approve_downgrade') { await wait(); currentFindings = currentFindings.map((finding) => finding.id === id ? { ...finding, status: decision === 'keep' ? 'kept' : decision === 'defer' ? 'deferred' : decision === 'mark_justified' ? 'justified' : decision.startsWith('approve') ? 'handed_off' : 'in_review' } : finding); const event = log(decision === 'approve_revoke' || decision === 'approve_downgrade' ? 'handoff.requested' : 'decision.created', id, `Recorded ${decision.replaceAll('_', ' ')}.`); return { finding: currentFindings.find((item) => item.id === id)!, event } },
  async assign(id: string, ownerId: string, dueDate: string) { await wait(); currentFindings = currentFindings.map((finding) => finding.id === id ? { ...finding, ownerId, dueDate } : finding); log('finding.updated', id, `Assigned to ${ownerId}; due ${dueDate}.`); return currentFindings.find((item) => item.id === id)! },
  async comment(id: string, note: string) { await wait(); return log('comment.created', id, note) },
  async createHandoff(id: string, decision: 'approve_revoke' | 'approve_downgrade') { await wait(); const handoff = { id: `h-live-${currentHandoffs.length + 1}`, findingId: id, assignee: 'Vikram Shah', status: 'requested' as const, requestedAt: '2026-10-23', note: 'No change is made in the connected app. An administrator performs the change.' }; currentHandoffs = [handoff, ...currentHandoffs]; log('handoff.requested', id, `Created ${decision.replaceAll('_', ' ')} handoff.`); return handoff },
  async getAudit() { await wait(); return [...audit] },
  async getEvidence() { await wait(); return [...evidence] },
  async getExplanation(id: string) { await wait(); return getExplanation(getFinding(id)) },
  async verifyAudit() { await wait(); log('audit.verified', 'chain', 'Hash chain verified through the demo event set.'); return { passed: audit.length, brokenAt: null } },
  async replay(id?: string) { await wait(); log('replay.run', id ?? 'all', 'Replay check completed on synthetic snapshots.'); return { passed: snapshots.filter((item) => item.complete && (!id || item.id === id)).length, failed: 0, skipped: snapshots.filter((item) => !item.complete).length } },
  async sync(app: string) { await wait(); log('sync.run', app, 'Simulated. No connected app was contacted.'); return { status: 'ok', added: 1, removed: 0, note: 'Synthetic sync run appended.' } },
  async getHandoffs() { await wait(); return [...currentHandoffs] },
  async getActivity() { await wait(); return [...activity] },
  async getSnapshots() { await wait(); return [...snapshots] },
  async getUsers() { await wait(); return [...users] },
  async getEntitlements() { await wait(); return [...entitlements] },
  async getPeerGroups() { await wait(); return [...peerGroups] },
  async getRoleChanges() { await wait(); return [...roleChanges] },
  async getSettings() { await wait(); return { ...settings } },
  async getConnectors() { await wait(); return [...connectors] },
}

export type Api = typeof api
