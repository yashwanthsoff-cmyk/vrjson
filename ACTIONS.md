# AccessDrift actions

This first-pass action inventory maps the implemented controls to the static API boundary and the audit-style event shown in the UI.

| data-action | API boundary | Audit event |
|---|---|---|
| `queue.finding.open` | `GET /findings/{id}` | `finding.viewed` |
| `queue.finding.decision` | `POST /findings/{id}/decisions` | `decision.created` |
| `queue.finding.comment` | `POST /findings/{id}/comments` | `comment.created` |
| `queue.finding.assign` | `PATCH /findings/{id}` | `finding.updated` |
| `queue.finding.handoff` | `POST /findings/{id}/decisions` | `handoff.requested` |
| `evidence.open` | `GET /evidence/{id}` | `evidence.viewed` |
| `settings.save` | `PUT /settings` | `settings.updated` |
| `sources.sync` | `POST /connectors/{id}/sync` | `sync.run` |
| `snapshots.replay` | `POST /replay-check` | `replay.run` |
| `audit.verify` | `POST /audit/verify` | `audit.verified` |
| `export.review-pack` | `POST /exports/review-pack` | `export.created` |
| `dev.toggle` | static session state | `demo.toggled` |
