# AccessDrift implementation plan

## Scope
AccessDrift is a synthetic, backend-swappable review console. This implementation prioritizes a complete interactive frontend demo with deterministic in-browser data and API-shaped boundaries. The highest-value path is queue → finding drawer → evidence-linked explanation → human decision or handoff → audit trail.

## Architecture
- `src/data.ts`: typed seed objects and pure derived selectors for findings, people, evidence, peers, movers, snapshots, activity, handoffs, notifications and audit events.
- `src/api.ts`: async static API facade with small artificial latency. UI imports data through this boundary so a future HTTP client can replace it.
- `src/App.tsx`: shell, navigation, route rendering, global interaction state, drawers and feature pages.
- `src/styles.css`: tokenized light/dark system and responsive operations-console layout.
- `public/manus-routes.json`: complete route manifest for Preview.

## Design
### Style directions considered
- Operational atelier (0.07): calm paper-like surfaces, hairline dividers and instrument-panel density.
- Midnight control room (0.06): dark-first navy canvas with amber signal highlights.
- Civic ledger (0.04): archival typography, ruled tables and evidence-first hierarchy.

Chosen: **Operational atelier**.

### Design movement
Swiss information design translated into a modern security-operations console: measured typography, restrained color, visible provenance and no ornamental dashboard noise.

### Core principles
1. Evidence before emphasis: claims sit beside provenance, not behind a chart.
2. Calm urgency: amber and red indicate state, never drama.
3. One reviewer, one decision: every action is explicit and per finding.
4. Dense but breathable: cards, tables and drawers preserve context without turning the app into a wall of widgets.

### Color philosophy
Ink and blue-gray neutrals make the console feel trustworthy. A signature oxidized teal marks active navigation and trustworthy computed state. Amber, coral and green are reserved for state semantics and always paired with labels or icons.

### Layout paradigm
A fixed rail and shallow top bar frame an offset content canvas. Feature pages use a narrow title rail, then a primary work surface with secondary evidence/context panels rather than centered card grids.

### Signature elements
- Teal “signal rail” on selected nav items.
- Evidence IDs rendered as monospaced chips with a small link glyph.
- Hairline “computed” annotations under metrics, opening a formula popover.

### Interaction philosophy
Controls show their consequence immediately. Drawers preserve the underlying queue; append-only decisions appear as new timeline entries; disabled actions explain the governing rule.

### Animation
Use short 160ms ease-out transitions for drawer, hover and nav state. Avoid continuous motion. Toasts slide from the bottom-right and respect reduced-motion preferences.

### Typography system
Use Inter/system UI for operational copy and IBM Plex Mono fallback for IDs and formulas. Headings use a tight, semibold hierarchy; labels use uppercase tracking only for metadata.

### Brand essence
A transparent review console for access drift, built for people who need to explain every decision. Precise, calm, accountable.

### Brand voice
Headlines state the work: “Review what changed.” CTAs state the consequence: “Open evidence” and “Create handoff”. Avoid inflated claims.

### Wordmark & logo
A split-ring “A” mark: two offset teal arcs around a small amber point, suggesting drift detected and evidence connected.

### Signature brand color
Oxidized teal `#0c7770`.

## Build workflow
Implement static mode first, run TypeScript/Vite checks, verify route manifest and preview readiness, then commit the project checkpoint. No external connectors, model calls or real-system mutations are included.
