-- Migration 005: F-03 Granted-vs-Used Initial Schema

-- Activity Events Table
CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  app TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL DEFAULT '',
  action_class TEXT NOT NULL DEFAULT 'read',
  is_simulated BOOLEAN NOT NULL DEFAULT false,
  ingest_run_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_events_user ON activity_events(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_app ON activity_events(app);
CREATE INDEX IF NOT EXISTS idx_activity_events_at ON activity_events(at);

-- Event Mapping Rules Table
CREATE TABLE IF NOT EXISTS event_mapping_rules (
  id TEXT PRIMARY KEY,
  app TEXT NOT NULL,
  action_pattern TEXT NOT NULL,
  entitlement_id TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_mapping_rules_app ON event_mapping_rules(app);

-- Ingest Runs Table
CREATE TABLE IF NOT EXISTS ingest_runs (
  id TEXT PRIMARY KEY,
  app TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL,
  window_from TIMESTAMPTZ NOT NULL,
  window_to TIMESTAMPTZ NOT NULL,
  events_pulled INTEGER NOT NULL DEFAULT 0,
  unmapped INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  ing_index INTEGER,
  is_simulated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingest_runs_app ON ingest_runs(app);
CREATE INDEX IF NOT EXISTS idx_ingest_runs_at ON ingest_runs(at);

-- Usage Summaries Table
CREATE TABLE IF NOT EXISTS usage_summaries (
  scope_key TEXT PRIMARY KEY,
  summary_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
