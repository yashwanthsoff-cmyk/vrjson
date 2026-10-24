# F-02 API Documentation

Backend API for AccessDrift Feature 2 (Permission History / Drift Over Time).

## Base URL

```
http://localhost:8787/api
```

## Common Headers

- `x-actor-id`: Reviewer ID (validated against reviewers table, defaults to Asha Rao's id)
- `x-session-id`: Session ID for deduplication
- `x-request-id`: Request ID (generated if absent, echoed back)
- `x-data-as-of`: Last good sync time (set on every response)

## Common Query Parameters

- `limit`: Number of items to return (default: 100, max: 500)
- `offset`: Number of items to skip (default: 0)

## Common Response Format

All responses include:
- JSON body
- `x-request-id` header
- `x-data-as-of` header

Errors follow RFC 7807:
```json
{
  "type": "error_type",
  "title": "Error Title",
  "status": 400,
  "detail": "Detailed error message"
}
```

---

## Endpoints

### Health

#### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "store": "supabase",
  "supabaseReachable": true,
  "groqConfigured": true,
  "counts": {
    "users": 7,
    "entitlements": 10,
    "grants": 15,
    "snapshots": 4,
    "auditEvents": 0
  },
  "syntheticDataNotice": "Synthetic demo data. No real people or systems. Nothing here changes any real app."
}
```

#### GET /api/health
Alias for `/health`.

---

### Inventory

#### GET /api/inventory
Get normalized inventory rows.

**Query Parameters:**
- `userId`: Filter by user ID
- `app`: Filter by app (`google_workspace`, `microsoft_entra`, `github`)
- `q`: Search query
- `limit`: Page size (default: 100, max: 500)
- `offset`: Page offset (default: 0)

**Response:**
```json
{
  "items": [
    {
      "user": { "id": "u-001", "displayName": "Meera Iyer", "pseudonym": "Person 001" },
      "app": "google_workspace",
      "entitlement": { "id": "ent-001", "name": "Admin", "kind": "role" },
      "kind": "role",
      "privilegeLevel": "admin",
      "sensitivity": "confidential",
      "source": "directory_sync"
    }
  ],
  "total": 10,
  "limit": 100,
  "offset": 0
}
```

---

### Grants

#### GET /api/grants
List grants with filtering.

**Query Parameters:**
- `userId`: Filter by user ID
- `app`: Filter by app
- `entitlementId`: Filter by entitlement ID
- `source`: Filter by source
- `activeOn`: Date string to filter for active grants on that date
- `removed`: `true` to include only removed grants, `false` for only active
- `limit`: Page size
- `offset`: Page offset

**Response:**
```json
{
  "items": [
    {
      "id": "grant-0001",
      "userId": "u-001",
      "entitlementId": "ent-001",
      "app": "google_workspace",
      "grantedAt": "2025-01-01T00:00:00Z",
      "removedAt": null,
      "source": "directory_sync",
      "firstSeenSnapshotId": "snap-google-20250101",
      "lastSeenSnapshotId": null
    }
  ],
  "total": 15,
  "limit": 100,
  "offset": 0
}
```

---

### Snapshots

#### GET /api/snapshots
List snapshots.

**Query Parameters:**
- `app`: Filter by app
- `from`: Start date (ISO string)
- `to`: End date (ISO string)
- `complete`: `true` for complete only, `false` for incomplete only
- `limit`: Page size
- `offset`: Page offset

**Response:**
```json
{
  "items": [
    {
      "id": "snap-google-20261023",
      "app": "google_workspace",
      "takenAt": "2026-10-23T00:00:00Z",
      "complete": true,
      "memberCount": 31,
      "contentHash": "sha256:9d4f...82aa"
    }
  ],
  "total": 4,
  "limit": 100,
  "offset": 0
}
```

---

### Access As-Of

#### GET /api/access-as-of
Get access as of a specific date.

**Query Parameters:**
- `userId`: User ID (required)
- `date`: Date string in YYYY-MM-DD format (required)

**Response:**
```json
{
  "userId": "u-001",
  "requestedDate": "2026-06-01",
  "permissions": [
    {
      "id": "grant-0001",
      "userId": "u-001",
      "entitlementId": "ent-001",
      "app": "google_workspace",
      "grantedAt": "2025-01-01T00:00:00Z",
      "removedAt": null,
      "source": "directory_sync"
    }
  ],
  "perApp": [
    {
      "app": "google_workspace",
      "requestedDate": "2026-06-01",
      "effectiveDate": "2026-05-14T00:00:00Z",
      "snapshotUsed": {
        "id": "snap-google-20260514",
        "app": "google_workspace",
        "takenAt": "2026-05-14T00:00:00Z",
        "complete": true,
        "memberCount": 28,
        "contentHash": "sha256:2c18...7b04"
      },
      "snapped": true,
      "message": "Showing snapshot of 2026-05-14 (nearest before selected)."
    }
  ]
}
```

---

### Diff

#### GET /api/diff
Compare access between two dates or snapshots.

**Query Parameters:**
- `userId`: User ID (required)
- `a`: Date string or snapshot ID (required)
- `b`: Date string or snapshot ID (required)
- `app`: Filter by app (optional)

**Response:**
```json
{
  "userId": "u-001",
  "a": {
    "ref": "2026-05-14",
    "perApp": [...]
  },
  "b": {
    "ref": "2026-10-23",
    "perApp": [...]
  },
  "added": [...],
  "removed": [...],
  "unchanged": [...],
  "counts": {
    "added": 2,
    "removed": 1,
    "unchanged": 10,
    "atA": 11,
    "atB": 12
  }
}
```

---

### Snapshot Coverage

#### GET /api/snapshot-coverage
Get coverage strip for all apps.

**Response:**
```json
[
  {
    "app": "google_workspace",
    "cells": [
      {
        "weekStart": "2026-05-11",
        "status": "complete",
        "snapshotIds": ["snap-google-20260514"]
      },
      {
        "weekStart": "2026-05-18",
        "status": "gap",
        "snapshotIds": []
      }
    ]
  }
]
```

---

### Before-After

#### GET /api/before-after
Get pre-post comparison for a role change event.

**Query Parameters:**
- `userId`: User ID (required)
- `eventDate`: Event date (optional, defaults to user's role change date)

**Response:**
```json
{
  "userId": "u-001",
  "eventDate": "2026-06-01T00:00:00Z",
  "before": [...],
  "after": [...],
  "carriedOverCount": 6
}
```

---

### Sync Runs

#### GET /api/sync-runs
List sync runs.

**Query Parameters:**
- `app`: Filter by app (optional)

**Response:**
```json
[
  {
    "id": "sync-001",
    "app": "google_workspace",
    "status": "ok",
    "trigger": "manual",
    "startedAt": "2026-10-23T00:00:00Z",
    "completedAt": "2026-10-23T00:01:00Z",
    "grantsAdded": 1,
    "grantsRemoved": 0,
    "snapshotId": "snap-google-20261023",
    "isSimulated": true,
    "simIndex": 1,
    "createdBy": "rev-asha",
    "createdAt": "2026-10-23T00:00:00Z"
  }
]
```

---

### Schedule

#### GET /api/schedule
Get sync schedules for all apps.

**Response:**
```json
[
  {
    "app": "google_workspace",
    "frequency": "weekly",
    "enabled": true,
    "lastRunAt": "2026-10-22T00:00:00Z",
    "nextRunAt": "2026-10-29T00:00:00Z",
    "actorId": "rev-vikram",
    "updatedAt": "2026-10-01T00:00:00Z"
  }
]
```

#### PUT /api/schedule/:app
Update sync schedule for an app.

**Body:**
```json
{
  "frequency": "daily",
  "enabled": true,
  "actorId": "rev-asha"
}
```

**Response:** Returns the updated schedule.

---

### Sync Simulate

#### POST /api/sync/simulate
Simulate a sync run.

**Body:**
```json
{
  "app": "google_workspace",
  "withChange": true,
  "actorId": "rev-asha"
}
```

**Response:**
```json
{
  "snapshot": {...},
  "syncRun": {...},
  "addedGrants": [...],
  "evidence": [...],
  "auditEventId": "au-001",
  "simulatedAt": "2026-10-23T00:01:00Z",
  "message": "Simulated. No connected app was contacted."
}
```

---

### Replay Check

#### POST /api/replay-check
Run replay check on snapshots.

**Body:**
```json
{
  "snapshotId": "snap-google-20261023"
}
```

**Response:**
```json
{
  "scope": "one",
  "checked": 1,
  "passed": 1,
  "failed": 0,
  "skippedIncomplete": ["snap-entra-20260312"],
  "failingSnapshotIds": [],
  "ranAt": "2026-10-23T00:00:00Z"
}
```

---

### Evidence

#### GET /api/evidence/:id
Get evidence by ID.

**Response:**
```json
{
  "id": "ev-grant-0001",
  "type": "grant",
  "occurredAt": "2025-01-01T00:00:00Z",
  "source": "directory_sync",
  "payload": {
    "grantId": "grant-0001",
    "userId": "u-001",
    "entitlementId": "ent-001",
    "entitlementName": "Admin",
    "app": "google_workspace",
    "grantedAt": "2025-01-01T00:00:00Z",
    "removedAt": null,
    "source": "directory_sync",
    "firstSeenSnapshotId": "snap-google-20250101",
    "lastSeenSnapshotId": null
  },
  "derived": false
}
```

---

### Audit

#### GET /api/audit
List audit events.

**Query Parameters:**
- `actorId`: Filter by actor ID
- `action`: Filter by action
- `targetType`: Filter by target type
- `from`: Start date
- `to`: End date
- `q`: Search query
- `limit`: Page size
- `offset`: Page offset

**Response:**
```json
{
  "items": [
    {
      "id": "au-001",
      "at": "2026-10-23T00:00:00Z",
      "actorId": "rev-asha",
      "action": "sync.completed",
      "targetType": "sync_run",
      "targetId": "sync-001",
      "detail": "Simulated sync completed",
      "prevHash": "",
      "hash": ""
    }
  ],
  "total": 10,
  "limit": 100,
  "offset": 0
}
```

#### POST /api/audit/event
Record an audit event.

**Body:**
```json
{
  "id": "au-001",
  "actorId": "rev-asha",
  "action": "finding.viewed",
  "targetType": "finding",
  "targetId": "find-001",
  "detail": "Viewed finding"
}
```

**Response:**
```json
{
  "recorded": true
}
```

---

### Findings

#### POST /api/findings/manual
Create a manual finding.

**Body:**
```json
{
  "userId": "u-001",
  "entitlementId": "ent-001",
  "grantId": "grant-0001",
  "actorId": "rev-asha"
}
```

**Response:**
```json
{
  "finding": {
    "id": "find-001",
    "type": "manual",
    "status": "open",
    "recommendedAction": "review",
    "confidence": "low",
    "blastRadius": null,
    "explanation": {...}
  },
  "evidence": [...]
}
```

#### GET /api/findings/manual
Get all manual findings.

**Response:**
```json
{
  "findings": [...],
  "evidence": [...]
}
```

---

### Export

#### GET /api/export/diff.csv
Export diff as CSV.

**Query Parameters:**
- `userId`: User ID (required)
- `a`: Date or snapshot ID (required)
- `b`: Date or snapshot ID (required)

**Response:** CSV text with formula-leading cells escaped.

---

### Drift Summary

#### POST /api/drift-summary
Generate drift summary for a user between two dates.

**Body:**
```json
{
  "userId": "u-001",
  "from": "2026-01-01T00:00:00Z",
  "to": "2026-10-23T00:00:00Z",
  "showNames": false
}
```

**Response:**
```json
{
  "id": "ds-001",
  "userId": "u-001",
  "from": "2026-01-01T00:00:00Z",
  "to": "2026-10-23T00:00:00Z",
  "source": "model",
  "fallbackUsed": false,
  "label": "Wording generated by gpt-oss via Groq, validated against evidence. Facts are computed by transparent rules.",
  "sentences": [
    {
      "template": "Access changed from {c1} to {c2} between the selected dates.",
      "claimIds": ["c1", "c2"]
    }
  ],
  "evidence": [...],
  "validation": {
    "claims": 6,
    "linked": 6,
    "passed": true,
    "failures": []
  },
  "cached": false,
  "createdAt": "2026-10-23T00:00:00Z"
}
```

**Rate Limit:** 10 requests per minute.

---

### Dev Flags

#### POST /api/dev/flags
Set dev flags (non-production only).

**Body:**
```json
{
  "corruptSnapshotId": "snap-google-20261023",
  "simulateConnectorError": {
    "google_workspace": true
  },
  "simulateShortLogs": false
}
```

#### POST /api/dev/reset
Reset all simulated data (non-production only).

**Response:**
```json
{
  "deleted": {
    "grants": 5,
    "snapshots": 3,
    "syncRuns": 3,
    "auditEvents": 10
  }
}
```
