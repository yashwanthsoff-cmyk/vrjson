import { auditSeed, evidence, findings, getExplanation, getFinding, getUser, handoffs, activity, snapshots, users, entitlements, peerGroups, roleChanges, settings, connectors, type AuditEvent, type Finding } from './data'
import { replaySnapshot } from './engine'

const wait = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms))
let audit = [...auditSeed]
let currentFindings = [...findings]
let currentHandoffs = [...handoffs]
const previousStatuses: Record<string, Finding['status']> = {}
let corruptedSnapshotId: string | null = null

const notify = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('accessdrift:data')) }
const log = (action: string, target: string, detail: string) => {
  const event: AuditEvent = { id: `au-live-${audit.length + 1}`, at: '2026-10-23 11:54', action, target, actor: 'Asha Rao', detail, hash: `live…${String(audit.length + 1).padStart(4, '0')}` }
  audit = [event, ...audit]
  return event
}

export const api = {
  async getFindings(): Promise<Finding[]> { await wait(); return [...currentFindings] },
  async getFinding(id: string) { await wait(); const finding = currentFindings.find((item) => item.id === id) ?? getFinding(id); log('finding.viewed', id, `Opened ${getUser(finding.userId).name}.`); return finding },
  async decide(id: string, decision: 'keep' | 'send_to_review' | 'defer' | 'mark_justified' | 'approve_revoke' | 'approve_downgrade') { await wait(); const before = currentFindings.find((item) => item.id === id); if (before) previousStatuses[id] = before.status; currentFindings = currentFindings.map((finding) => finding.id === id ? { ...finding, status: decision === 'keep' ? 'kept' : decision === 'defer' ? 'deferred' : decision === 'mark_justified' ? 'justified' : decision.startsWith('approve') ? 'handed_off' : 'in_review' } : finding); notify(); const event = log(decision === 'approve_revoke' || decision === 'approve_downgrade' ? 'handoff.requested' : 'decision.created', id, `Recorded ${decision.replace(/_/g, ' ')}.`); return { finding: currentFindings.find((item) => item.id === id)!, event } },
  async undo(id: string) { await wait(); const status = previousStatuses[id] ?? 'open'; currentFindings = currentFindings.map((finding) => finding.id === id ? { ...finding, status } : finding); notify(); return log('decision.undo', id, `Undo superseded the previous decision; status restored to ${status}.`) },
  async assign(id: string, ownerId: string, dueDate: string) { await wait(); currentFindings = currentFindings.map((finding) => finding.id === id ? { ...finding, ownerId, dueDate } : finding); notify(); log('finding.updated', id, `Assigned to ${ownerId}; due ${dueDate}.`); return currentFindings.find((item) => item.id === id)! },
  async comment(id: string, note: string) { await wait(); return log('comment.created', id, note) },
  async createHandoff(id: string, decision: 'approve_revoke' | 'approve_downgrade') { await wait(); const handoff = { id: `h-live-${currentHandoffs.length + 1}`, findingId: id, assignee: 'Vikram Shah', status: 'requested' as const, requestedAt: '2026-10-23', note: 'No change is made in the connected app. An administrator performs the change.' }; currentHandoffs = [handoff, ...currentHandoffs]; notify(); log('handoff.requested', id, `Created ${decision.replaceAll('_', ' ')} handoff.`); return handoff },
  async getAudit() { await wait(); return [...audit] },
  async getEvidence() { await wait(); return [...evidence] },
  async getExplanation(id: string) { await wait(); return getExplanation(getFinding(id)) },
  async verifyAudit() { await wait(); log('audit.verified', 'chain', 'Hash chain verified through the demo event set.'); return { passed: audit.length, brokenAt: null } },
  async replay(id?: string) { await wait(); const checked = snapshots.filter((item) => !id || item.id === id).map((item) => replaySnapshot(item, item.id === corruptedSnapshotId)); const failedItem = checked.find((item) => item.status === 'failed'); log('replay.run', id ?? 'all', failedItem ? `Replay failed for ${failedItem.snapshotId}.` : 'Replay check completed on synthetic snapshots.'); return { passed: checked.filter((item) => item.status === 'passed').length, failed: checked.filter((item) => item.status === 'failed').length, skipped: checked.filter((item) => item.status === 'skipped').length, failedSnapshotId: failedItem?.snapshotId ?? null } },
  async corruptSnapshot(id: string) { await wait(); corruptedSnapshotId = id; return log('snapshot.corrupted', id, `Session-only corruption toggle enabled for ${id}.`) },
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
  async revokeConsent(app: string) { await wait(); return log('consent.revoked', app, 'Source revoked. Data frozen as of 2026-10-23.') },
  async restoreConsent(app: string) { await wait(); return log('consent.restored', app, 'Consent restored; simulated first sync is available.') },
  async getDriftSummary(userId: string, from: string, to: string, showNames: boolean = false) { await wait(); throw new Error('Drift summary not available in static mode. Set VITE_API_MODE=http to use the backend.') },
  async setDevFlags(flags: any) { await wait(); return log('dev.flags.updated', 'dev', 'Dev flags updated in static mode.') },
  async resetDev() { await wait(); return log('dev.reset', 'dev', 'Demo reset in static mode.') },
}

export type Api = typeof api
