import type { Settings } from '../types/contract';

/** Configurable defaults, not validated. */
export const DEFAULT_SETTINGS: Settings = {
  unusedWindowDays: { admin: 45, standard: 180 },
  peerThresholdPct: 10,
  minPeerCount: 5,
  graceDays: 30,
  staleGrantDays: 365,
  staleReviewDays: 180,
  weights: { severity: 0.3, sensitivity: 0.25, evidenceStrength: 0.25, staleness: 0.2 },
  blastRadiusMinCoverageDays: 90,
  detectorsEnabled: { unused: true, stale_grant: true, peer_outlier: true, mover_carryover: true, manual: true },
  version: 1,
};
