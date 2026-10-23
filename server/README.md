# AccessDrift Backend Server

Node 20 + Express + TypeScript + Supabase Postgres + Groq gpt-oss backend for AccessDrift.

## Setup

1. **Install dependencies:**
   ```bash
   cd server
   npm install
   ```

2. **Configure environment:**
   Copy `.env.example` to `.env` and fill in the values:
   ```bash
   cp .env.example .env
   ```

   Required environment variables:
   - `GROQ_API_KEY`: Groq API key for drift summaries
   - `GROQ_MODEL`: Model name (default: `openai/gpt-oss-120b`)
   - `GROQ_BASE_URL`: Groq API base URL (default: `https://api.groq.com/openai/v1`)
   - `GROQ_ENABLED`: Set to `true` to enable Groq, `false` to use templates only
   - `SUPABASE_URL`: Supabase project URL
   - `SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key
   - `SUPABASE_ANON_KEY`: Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (for writes)
   - `DATABASE_URL`: Postgres connection string (optional, for migrations)
   - `STORE`: `supabase` or `memory` (default: `supabase`)
   - `PORT`: Server port (default: `8787`)
   - `CORS_ORIGIN`: Frontend origin (default: `http://localhost:5173`)
   - `DEMO_NOW`: Demo time (default: `2026-10-23T00:00:00Z`)
   - `NODE_ENV`: `development`, `production`, or `test`

3. **Run database migrations:**

   If `DATABASE_URL` is set:
   ```bash
   npm run db:migrate
   ```

   If `DATABASE_URL` is not set, the script will write `src/db/all.sql`. Paste this file into the Supabase SQL Editor, run it, then:
   ```bash
   npm run db:seed
   ```

4. **Seed the database:**
   ```bash
   npm run db:seed
   ```

   To verify seed counts without reseeding:
   ```bash
   npm run db:verify
   ```

## Running the Server

**Development mode (with hot reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

The server will start on port 8787 (or the configured `PORT`).

Health check: http://localhost:8787/api/health

## Testing

**Run tests (MemoryStore only):**
```bash
npm test
```

**Run tests with live Supabase:**
```bash
RUN_LIVE=1 npm run test:live
```

**TypeScript check:**
```bash
npm run typecheck
```

**Secret scanning:**
```bash
npm run scan:secrets
```

**Full verification:**
```bash
npm run verify
```

## Demo

Run the demo script to verify key flows:
```bash
npm run demo
```

## API Documentation

See `docs/F02_API.md` for endpoint documentation and examples.

## Frontend Integration

See `docs/FRONTEND_WIRING.md` for manual integration steps.

## Notes

- The server uses path aliases: `@engine/*` maps to `../src/engine/*`, `@contract` maps to `../src/types/contract.ts`
- All times are UTC ISO strings
- The server falls back to MemoryStore if Supabase is unreachable
- Synthetic data is used throughout - no real people or systems
