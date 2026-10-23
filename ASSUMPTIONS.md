# AccessDrift assumptions

- This first pass is frontend-only and uses a deterministic static API facade. No model, connector or backend is called.
- The third app, GitHub, is illustrative only.
- Numbers are derived from the seeded records and selector functions; demo records are synthetic.
- A static API mutation updates in-memory state and appends an audit-style activity item for the session.
- Handoffs are requests for an administrator; no connected app is changed and completion is self-reported.
- The settings/rules pages show the configurable defaults and local what-if behavior but do not persist to a server.
- `stale_grant`, seniority grouping and dedupe precedence are represented in the static findings selectors and may be moved to server-side engine functions later.
- `send_to_review` and `reopen` are represented as append-only status transitions.
- A future backend must enforce the same role gating currently mirrored by the UI.
- All displayed names are synthetic, and pseudonym mode replaces display names in the UI.
- Added libraries are intentionally limited to React, React DOM, React Router, Vite and TypeScript; icons are inline SVG/CSS to keep the demo portable.
