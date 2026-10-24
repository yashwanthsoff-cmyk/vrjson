-- 002_append_only.sql: Append-only enforcement

-- Grants table
CREATE TABLE IF NOT EXISTS grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  entitlement_id TEXT NOT NULL,
  app TEXT NOT NULL CHECK (app IN ('google_workspace', 'microsoft_entra', 'github')),
  granted_at TIMESTAMPTZ NOT NULL,
  removed_at TIMESTAMPTZ,
  source TEXT NOT NULL,
  first_seen_snapshot_id TEXT NOT NULL,
  last_seen_snapshot_id TEXT,
  is_simulated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Snapshots table
CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  app TEXT NOT NULL CHECK (app IN ('google_workspace', 'microsoft_entra', 'github')),
  taken_at TIMESTAMPTZ NOT NULL,
  complete BOOLEAN NOT NULL DEFAULT FALSE,
  member_count INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT NOT NULL,
  sync_run_id TEXT,
  is_simulated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sync runs table
CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  app TEXT NOT NULL CHECK (app IN ('google_workspace', 'microsoft_entra', 'github')),
  status TEXT NOT NULL CHECK (status IN ('ok', 'error', 'partial')),
  trigger TEXT NOT NULL CHECK (trigger IN ('scheduled', 'manual')),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  grants_added INTEGER NOT NULL DEFAULT 0,
  grants_removed INTEGER NOT NULL DEFAULT 0,
  snapshot_id TEXT NOT NULL,
  is_simulated BOOLEAN NOT NULL DEFAULT FALSE,
  sim_index INTEGER UNIQUE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create unique index on sim_index for simulated runs
CREATE UNIQUE INDEX IF NOT EXISTS sync_runs_sim_index_unique ON sync_runs (sim_index) WHERE sim_index IS NOT NULL;

-- Evidence table
CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('grant', 'activity', 'peer_calc', 'role_change', 'coverage')),
  occurred_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  derived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Manual findings table
CREATE TABLE IF NOT EXISTS manual_findings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  entitlement_id TEXT NOT NULL,
  app TEXT NOT NULL CHECK (app IN ('google_workspace', 'microsoft_entra', 'github')),
  grant_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_simulated BOOLEAN NOT NULL DEFAULT FALSE
);

-- Audit events table
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  detail TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  session_id TEXT,
  is_simulated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index for finding.viewed deduplication
CREATE UNIQUE INDEX IF NOT EXISTS audit_events_finding_viewed_unique ON audit_events (target_id, session_id) WHERE action = 'finding.viewed';

-- Drift summaries table
CREATE TABLE IF NOT EXISTS drift_summaries (
  id TEXT PRIMARY KEY,
  scope_key TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('model', 'template')),
  wording JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Append-only enforcement functions

CREATE OR REPLACE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF tg_op = 'DELETE' and old.is_simulated and current_setting('app.dev_reset', true) = 'on' then
    return old;
  end if;
  raise exception 'append-only table %: % is not allowed', tg_table_name, tg_op;
end $$;

-- Grants: only removed_at and last_seen_snapshot_id may change
CREATE OR REPLACE FUNCTION grants_update_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  if (new.id, new.user_id, new.entitlement_id, new.app, new.granted_at, new.source,
      new.first_seen_snapshot_id, new.is_simulated, new.created_at)
     is distinct from
     (old.id, old.user_id, old.entitlement_id, old.app, old.granted_at, old.source,
      old.first_seen_snapshot_id, old.is_simulated, old.created_at) then
    raise exception 'grants: only removed_at and last_seen_snapshot_id may change';
  end if;
  if old.removed_at is not null and new.removed_at is distinct from old.removed_at then
    raise exception 'grants: removed_at is already set; add a new record instead';
  end if;
  return new;
end $$;

-- Triggers on grants
CREATE TRIGGER grants_delete BEFORE DELETE ON grants FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER grants_update BEFORE UPDATE ON grants FOR EACH ROW EXECUTE FUNCTION grants_update_guard();

-- Triggers on snapshots (no updates allowed)
CREATE TRIGGER snapshots_delete BEFORE DELETE ON snapshots FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER snapshots_update BEFORE UPDATE ON snapshots FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- Triggers on sync_runs (no updates allowed)
CREATE TRIGGER sync_runs_delete BEFORE DELETE ON sync_runs FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER sync_runs_update BEFORE UPDATE ON sync_runs FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- Triggers on audit_events (no updates allowed)
CREATE TRIGGER audit_events_delete BEFORE DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER audit_events_update BEFORE UPDATE ON audit_events FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- Triggers on manual_findings (no updates allowed)
CREATE TRIGGER manual_findings_delete BEFORE DELETE ON manual_findings FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER manual_findings_update BEFORE UPDATE ON manual_findings FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- Statement-level TRUNCATE triggers
CREATE CONSTRAINT TRIGGER grants_truncate AFTER TRUNCATE ON grants INITIALLY DEFERRED FOR EACH STATEMENT EXECUTE FUNCTION forbid_change();
CREATE CONSTRAINT TRIGGER snapshots_truncate AFTER TRUNCATE ON snapshots INITIALLY DEFERRED FOR EACH STATEMENT EXECUTE FUNCTION forbid_change();
CREATE CONSTRAINT TRIGGER sync_runs_truncate AFTER TRUNCATE ON sync_runs INITIALLY DEFERRED FOR EACH STATEMENT EXECUTE FUNCTION forbid_change();
CREATE CONSTRAINT TRIGGER audit_events_truncate AFTER TRUNCATE ON audit_events INITIALLY DEFERRED FOR EACH STATEMENT EXECUTE FUNCTION forbid_change();
CREATE CONSTRAINT TRIGGER manual_findings_truncate AFTER TRUNCATE ON manual_findings INITIALLY DEFERRED FOR EACH STATEMENT EXECUTE FUNCTION forbid_change();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS grants_user_id ON grants (user_id);
CREATE INDEX IF NOT EXISTS grants_entitlement_id ON grants (entitlement_id);
CREATE INDEX IF NOT EXISTS grants_granted_at ON grants (granted_at);
CREATE INDEX IF NOT EXISTS grants_app ON grants (app);
CREATE INDEX IF NOT EXISTS snapshots_app_taken_at ON snapshots (app, taken_at);
CREATE INDEX IF NOT EXISTS audit_events_at ON audit_events (at);
CREATE INDEX IF NOT EXISTS audit_events_actor_action ON audit_events (actor_id, action);
