-- 005_live.sql: Live integration tables (tenants, provider connections, findings, AI analysis)

-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Provider connections table
CREATE TABLE IF NOT EXISTS provider_connections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('github', 'google_workspace', 'microsoft_entra')),
  account_login TEXT NOT NULL,
  account_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('connected', 'disconnected', 'error', 'revoked')),
  scopes_note TEXT,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, provider, account_id)
);

-- Resources table (provider repos/apps)
CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('github', 'google_workspace', 'microsoft_entra')),
  provider_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private', 'internal')),
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, provider, provider_id)
);

-- Extend sync_runs with live integration fields
ALTER TABLE sync_runs
  ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS stage TEXT CHECK (stage IN ('provider_fetch', 'snapshot_persistence', 'drift_detection', 'ai_analysis', 'completed')),
  ADD COLUMN IF NOT EXISTS coverage JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS error TEXT,
  ADD COLUMN IF NOT EXISTS counts JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS baseline BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure sync_runs has the updated stage status enum
ALTER TABLE sync_runs
  DROP CONSTRAINT IF EXISTS sync_runs_status_check;

ALTER TABLE sync_runs
  ADD CONSTRAINT sync_runs_status_check CHECK (status IN ('ok', 'error', 'partial', 'running', 'completed', 'failed'));

-- Extend snapshots with live integration fields
ALTER TABLE snapshots
  ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS coverage JSONB DEFAULT '{}'::jsonb;

-- Findings table
CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  entitlement_id TEXT NOT NULL,
  app TEXT NOT NULL CHECK (app IN ('google_workspace', 'microsoft_entra', 'github')),
  type TEXT NOT NULL CHECK (type IN ('unused', 'stale_grant', 'peer_outlier', 'mover_carryover', 'manual')),
  rule_id TEXT NOT NULL,
  rule_version INTEGER NOT NULL,
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  recommendation TEXT NOT NULL CHECK (recommendation IN ('keep', 'review', 'downgrade', 'revoke')),
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  blast_radius JSONB,
  usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('open', 'in_review', 'handed_off', 'kept', 'deferred', 'justified')),
  owner_id TEXT,
  due_date TIMESTAMPTZ,
  evidence_version TEXT NOT NULL,
  created_from_snapshot_id TEXT NOT NULL REFERENCES snapshots(id),
  previous_snapshot_id TEXT REFERENCES snapshots(id),
  fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, fingerprint)
);

-- Finding evidence table
CREATE TABLE IF NOT EXISTS finding_evidence (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL REFERENCES evidence(id),
  version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(finding_id, evidence_id, version)
);

-- AI analyses table
CREATE TABLE IF NOT EXISTS ai_analyses (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  evidence_version TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  model TEXT NOT NULL,
  analysed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('pending', 'validated', 'rejected', 'failed')),
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INTEGER NOT NULL DEFAULT 0,
  UNIQUE(finding_id, evidence_version, cache_key)
);

-- Decisions table
CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('keep', 'send_to_review', 'defer', 'mark_justified', 'approve_revoke', 'approve_downgrade')),
  reason_code TEXT,
  note TEXT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evidence_hash TEXT NOT NULL,
  explanation_snapshot TEXT,
  supersedes_id TEXT REFERENCES decisions(id),
  handoff_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure audit_events has tenant_id
ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;

-- Update RLS policies for tenant isolation

-- Tenants: service role only
DROP POLICY IF EXISTS "Anon can select users" ON tenants;
CREATE POLICY "Service role only on tenants" ON tenants FOR ALL TO service_role USING (true);

-- Provider connections: service role only
DROP POLICY IF EXISTS "Anon no access connectors" ON provider_connections;
CREATE POLICY "Service role only on provider_connections" ON provider_connections FOR ALL TO service_role USING (true);

-- Resources: service role only
CREATE POLICY "Service role only on resources" ON resources FOR ALL TO service_role USING (true);

-- Findings: service role only
CREATE POLICY "Service role only on findings" ON findings FOR ALL TO service_role USING (true);

-- Finding evidence: service role only
CREATE POLICY "Service role only on finding_evidence" ON finding_evidence FOR ALL TO service_role USING (true);

-- AI analyses: service role only
CREATE POLICY "Service role only on ai_analyses" ON ai_analyses FOR ALL TO service_role USING (true);

-- Decisions: service role only
CREATE POLICY "Service role only on decisions" ON decisions FOR ALL TO service_role USING (true);

-- Update existing tables to add tenant_id where missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE grants ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE manual_findings ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE drift_summaries ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;

-- Update RLS for users, entitlements, grants, evidence with tenant isolation
DROP POLICY IF EXISTS "Anon can select users" ON users;
CREATE POLICY "Service role only on users" ON users FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Anon can select entitlements" ON entitlements;
CREATE POLICY "Service role only on entitlements" ON entitlements FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Anon can select grants" ON grants;
CREATE POLICY "Service role only on grants" ON grants FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Anon can select snapshots" ON snapshots;
CREATE POLICY "Service role only on snapshots" ON snapshots FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Anon can select sync_runs" ON sync_runs;
CREATE POLICY "Service role only on sync_runs" ON sync_runs FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Anon can select sync_schedules" ON sync_schedules;
CREATE POLICY "Service role only on sync_schedules" ON sync_schedules FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Anon can select role_changes" ON role_changes;
CREATE POLICY "Service role only on role_changes" ON role_changes FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Anon no access evidence" ON evidence;
CREATE POLICY "Service role only on evidence" ON evidence FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Anon no access manual_findings" ON manual_findings;
CREATE POLICY "Service role only on manual_findings" ON manual_findings FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Anon no access audit_events" ON audit_events;
CREATE POLICY "Service role only on audit_events" ON audit_events FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Anon no access drift_summaries" ON drift_summaries;
CREATE POLICY "Service role only on drift_summaries" ON drift_summaries FOR ALL TO service_role USING (true);

-- Create indexes for tenant_id
CREATE INDEX IF NOT EXISTS users_tenant_id ON users (tenant_id);
CREATE INDEX IF NOT EXISTS entitlements_tenant_id ON entitlements (tenant_id);
CREATE INDEX IF NOT EXISTS grants_tenant_id ON grants (tenant_id);
CREATE INDEX IF NOT EXISTS snapshots_tenant_id ON snapshots (tenant_id);
CREATE INDEX IF NOT EXISTS sync_runs_tenant_id ON sync_runs (tenant_id);
CREATE INDEX IF NOT EXISTS evidence_tenant_id ON evidence (tenant_id);
CREATE INDEX IF NOT EXISTS findings_tenant_id ON findings (tenant_id);
CREATE INDEX IF NOT EXISTS audit_events_tenant_id ON audit_events (tenant_id);
CREATE INDEX IF NOT EXISTS provider_connections_tenant_id ON provider_connections (tenant_id);
CREATE INDEX IF NOT EXISTS resources_tenant_id ON resources (tenant_id);
