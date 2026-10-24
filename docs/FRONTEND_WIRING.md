# Frontend Wiring Instructions

This document describes the manual steps to integrate the F-02 backend with the AccessDrift frontend.

## Prerequisites

1. The backend server is running on `http://localhost:8787`
2. You have verified the backend works by running `npm run demo` in the `server/` directory

## Step 1: Copy the HTTP API Reference

Copy `docs/httpApi.reference.ts` to `src/api/httpApi.ts`:

```bash
cp docs/httpApi.reference.ts src/api/httpApi.ts
```

## Step 2: Configure Environment Variables

Set the following environment variables for the frontend:

In your `.env` file (or `.env.local`):

```bash
VITE_API_MODE=http
VITE_API_BASE_URL=http://localhost:8787
```

## Step 3: Export from API Index

Edit `src/api/index.ts` to export the HTTP API:

```typescript
// Add this import at the top
import { httpApi } from './httpApi'

// Add this export
export { httpApi as api } from './httpApi'
```

The complete file should look like:

```typescript
import { staticApi } from './staticApi'
import { httpApi } from './httpApi'

export { staticApi, httpApi as api }
```

## Step 4: Update Frontend to Use HTTP API for F-02 Features

The following frontend features should use the HTTP API instead of staticApi:

### Access As-Of
Replace `staticApi.getAccessAsOf` calls with `api.getAccessAsOf`.

### Diff
Replace `staticApi.diffSnapshots` calls with `api.diffSnapshots`.

### Replay Check
Replace `staticApi.replay` calls with `api.runReplayCheck`.

### Sync Simulation
Replace `staticApi.sync` calls with `api.syncSimulate`.

### Drift Summary
Use `api.getDriftSummary` (new feature not in staticApi).

### Schedule Updates
Use `api.updateSchedule` and `api.getSchedule`.

### Manual Findings
Use `api.createManualFinding` and `api.getManualFindings`.

### Audit Events
Use `api.recordAuditEvent` for locally originated audit events.

## Step 5: Handle Sync Results in Store

When sync simulation results are received from the backend, push them into the frontend store:

```typescript
// In your sync action handler
const result = await api.syncSimulate(app, withChange, actorId)

// Push to store
store.dispatch({
  type: 'SYNC_COMPLETED',
  payload: {
    snapshot: result.snapshot,
    syncRun: result.syncRun,
    addedGrants: result.addedGrants,
  },
})
```

## Step 6: Handle Manual Findings in Store

When manual findings are created via the backend, push them into the frontend store:

```typescript
// In your manual finding handler
const result = await api.createManualFinding(params)

// Push to store
store.dispatch({
  type: 'FINDING_CREATED',
  payload: {
    finding: result.finding,
    evidence: result.evidence,
  },
})
```

## Step 7: Post Audit Events for Local Actions

For actions that originate in the frontend (e.g., viewing a finding), post audit events to the backend:

```typescript
// When a user views a finding
await api.recordAuditEvent({
  id: `finding-viewed-${findingId}-${sessionId}`,
  actorId: currentUser.id,
  action: 'finding.viewed',
  targetType: 'finding',
  targetId: findingId,
  detail: `Viewed finding ${findingId}`,
})
```

## Step 8: Handle API Errors

The HTTP API throws `ApiErrorException` on errors. Wrap your API calls with error handling:

```typescript
import { ApiErrorException } from './httpApi'

try {
  const result = await api.getAccessAsOf(userId, date)
  // Handle success
} catch (error) {
  if (error instanceof ApiErrorException) {
    // Handle API error
    console.error('API Error:', error.error)
    showNotification(error.error.detail, 'error')
  } else {
    // Handle other errors
    console.error('Unexpected error:', error)
  }
}
```

## Step 9: Features Not Covered by Backend

The following features are not covered by the backend and should continue using `staticApi`:

- `getFindings`, `getFinding` (except manual findings)
- `decide`, `undo`, `assign`, `comment`, `createHandoff`
- `getExplanation`, `verifyAudit`
- `getHandoffs`, `getActivity`
- `getUsers`, `getEntitlements` (use backend for inventory instead)
- `getPeerGroups`
- `getRoleChanges` (backend provides this via listRoleChanges)
- `getSettings`
- `getConnectors`
- `revokeConsent`, `restoreConsent`

## Step 10: Test the Integration

1. Start the backend: `cd server && npm run dev`
2. Start the frontend: `npm run dev`
3. Navigate to the frontend and test:
   - Access as-of view
   - Diff view
   - Replay check
   - Sync simulation
   - Drift summary
   - Manual findings

## Verification Checklist

- [ ] Backend server is running on port 8787
- [ ] `src/api/httpApi.ts` exists
- [ ] `VITE_API_MODE=http` is set
- [ ] `VITE_API_BASE_URL=http://localhost:8787` is set
- [ ] `src/api/index.ts` exports `httpApi as api`
- [ ] Access as-of uses `api.getAccessAsOf`
- [ ] Diff uses `api.diffSnapshots`
- [ ] Replay check uses `api.runReplayCheck`
- [ ] Sync simulation uses `api.syncSimulate`
- [ ] Drift summary uses `api.getDriftSummary`
- [ ] Schedule updates use `api.updateSchedule`
- [ ] Manual findings use `api.createManualFinding`
- [ ] Audit events are posted for local actions
- [ ] API errors are handled with try/catch
- [ ] All features work end-to-end

## Troubleshooting

### CORS Errors
If you see CORS errors, ensure:
- The backend `CORS_ORIGIN` matches your frontend URL (default: `http://localhost:5173`)
- The backend is running before the frontend

### 404 Errors
If you get 404 errors:
- Verify the backend server is running
- Check the `VITE_API_BASE_URL` is correct
- Check the endpoint path in the API call

### Authentication Errors
If you get authentication errors:
- Verify the `x-actor-id` header is being sent
- The default actor ID is `rev-asha` (Asha Rao)
- Ensure the reviewer exists in the database

### Data Not Updating
If data isn't updating in the frontend:
- Ensure you're pushing backend results to the store
- Check that the store dispatch is working
- Verify the backend is returning the expected data shape
