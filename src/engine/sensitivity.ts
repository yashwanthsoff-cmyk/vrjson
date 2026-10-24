import type { Entitlement, SensitivityChip } from '../types/contract';

export function deriveChip(e: Pick<Entitlement, 'privilegeLevel' | 'dataSensitivity'>): SensitivityChip {
  if (e.privilegeLevel === 'admin') return 'admin';
  if (e.dataSensitivity === 'confidential' || e.dataSensitivity === 'pii_financial') return 'high';
  if (e.dataSensitivity === 'internal') return 'medium';
  return 'low';
}

export type TagOverride = Partial<Pick<Entitlement, 'privilegeLevel' | 'dataSensitivity' | 'categories'>>;

/** Session-only what-if edits from the SensitivityTagger. Seed data is never mutated. */
export function applyTagOverrides(
  entitlements: Entitlement[],
  overrides: Record<string, TagOverride>,
): Entitlement[] {
  return entitlements.map((e) => (overrides[e.id] ? { ...e, ...overrides[e.id] } : e));
}
