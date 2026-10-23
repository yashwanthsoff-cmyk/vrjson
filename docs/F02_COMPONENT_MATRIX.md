# F-02 Component Matrix

Frontend components and their backend endpoint mappings.

## Status Legend
- **READY**: Backend endpoint exists and satisfies component needs
- **MISSING**: Component does not exist in frontend
- **GAP**: Backend endpoint missing or signature mismatch

## Components

| Component | Backend Endpoint | Status | Notes |
|-----------|------------------|--------|-------|
| SnapshotScheduler (GET/PUT schedule) | GET /api/schedule, PUT /api/schedule/:app | READY | Component not yet implemented in frontend |
| SyncRunsTable (GET sync-runs) | GET /api/sync-runs | READY | Component not yet implemented in frontend |
| GrantRecordTable (GET grants) | GET /api/grants | READY | Component not yet implemented in frontend |
| SnapshotsTab (GET snapshots) | GET /api/snapshots | READY | Component not yet implemented in frontend |
| HistorySlider (GET snapshots + snapshot-coverage) | GET /api/snapshots, GET /api/snapshot-coverage | READY | Component not yet implemented in frontend |
| SnapshotCoverageStrip (GET snapshot-coverage) | GET /api/snapshot-coverage | READY | Component not yet implemented in frontend |
| TimeTravelQuery (GET access-as-of) | GET /api/access-as-of | READY | Component not yet implemented in frontend |
| DiffViewer (GET diff + export csv) | GET /api/diff, GET /api/export/diff.csv | READY | Component not yet implemented in frontend |
| BeforeAfterView (GET before-after) | GET /api/before-after | READY | Component not yet implemented in frontend |
| IntegrityPanel (POST replay-check) | POST /api/replay-check | READY | Component not yet implemented in frontend |
| GrantRecord drawer "Open evidence" (GET evidence/:id) | GET /api/evidence/:id | READY | Component not yet implemented in frontend |
| "Flag for review" (POST findings/manual) | POST /api/findings/manual | READY | Component not yet implemented in frontend |
| "Simulate sync" buttons (POST sync/simulate) | POST /api/sync/simulate | READY | Component not yet implemented in frontend |
| Dev panel toggles (POST dev/flags, dev/reset) | POST /api/dev/flags, POST /api/dev/reset | READY | Component not yet implemented in frontend |
| InventoryTable (GET inventory) | GET /api/inventory | READY | Component not yet implemented in frontend |
| DriftSummaryCard (POST drift-summary) | POST /api/drift-summary | READY | Component not yet implemented in frontend |
| Audit table (GET audit) | GET /api/audit | READY | Component not yet implemented in frontend |

## Summary

- **READY**: 18/18 (all backend endpoints exist)
- **MISSING**: 18/18 (no frontend components implemented yet)
- **GAP**: 0/18

**Note**: The frontend is currently minimal (only App.tsx and main.tsx). All F-02 backend endpoints are implemented and ready for component implementation. The httpApi wrapper already exists in `src/api/httpApi.ts` and is conditionally exported based on `VITE_API_MODE`.
