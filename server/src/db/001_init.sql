-- 001_init.sql: Core tables

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  pseudonym TEXT NOT NULL,
  department TEXT NOT NULL,
  title TEXT NOT NULL,
  manager_id TEXT,
  employment_type TEXT NOT NULL CHECK (employment_type IN ('employee', 'contractor', 'guest')),
  start_date TEXT NOT NULL,
  seniority TEXT NOT NULL CHECK (seniority IN ('junior', 'mid', 'senior', 'lead'))
);

-- Entitlements
CREATE TABLE IF NOT EXISTS entitlements (
  id TEXT PRIMARY KEY,
  app TEXT NOT NULL CHECK (app IN ('google_workspace', 'microsoft_entra', 'github')),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('role', 'group', 'permission')),
  privilege_level TEXT NOT NULL CHECK (privilege_level IN ('read', 'write', 'admin')),
  data_sensitivity TEXT NOT NULL CHECK (data_sensitivity IN ('public', 'internal', 'confidential', 'pii_financial')),
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  seasonal BOOLEAN DEFAULT FALSE,
  downgrade_to_id TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

-- Reviewers
CREATE TABLE IF NOT EXISTS reviewers (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  pseudonym TEXT NOT NULL,
  department TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Connectors
CREATE TABLE IF NOT EXISTS connectors (
  id TEXT PRIMARY KEY,
  app TEXT NOT NULL UNIQUE CHECK (app IN ('google_workspace', 'microsoft_entra', 'github')),
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked', 'error')),
  last_sync_at TIMESTAMPTZ,
  data_as_of TEXT,
  coverage_days INTEGER NOT NULL DEFAULT 0,
  consented_by TEXT NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

-- Role changes
CREATE TABLE IF NOT EXISTS role_changes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  previous_department TEXT NOT NULL,
  new_department TEXT NOT NULL,
  previous_title TEXT,
  new_title TEXT,
  previous_manager TEXT,
  new_manager TEXT,
  changed_at TIMESTAMPTZ NOT NULL,
  grace_days INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL CHECK (status IN ('in_grace', 'past_grace'))
);

-- Sync schedules
CREATE TABLE IF NOT EXISTS sync_schedules (
  app TEXT PRIMARY KEY CHECK (app IN ('google_workspace', 'microsoft_entra', 'github')),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'manual')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  actor_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dev flags
CREATE TABLE IF NOT EXISTS dev_flags (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb
);
