-- 006_rpc_live.sql: RPC functions for live integration

-- persist_sync: Atomic sync operation with tenant support
CREATE OR REPLACE FUNCTION persist_sync(
  p_tenant_id TEXT,
  p_snapshot JSONB,
  p_run JSONB,
  p_grants JSONB,
  p_users JSONB,
  p_entitlements JSONB,
  p_audit JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Take advisory lock to prevent concurrent sync conflicts for the same tenant
  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id || ':sync'));

  -- Insert snapshot with tenant_id
  INSERT INTO snapshots (
    id, app, taken_at, complete, member_count, content_hash, sync_run_id, is_simulated, tenant_id, coverage
  ) VALUES (
    p_snapshot->>'id',
    p_snapshot->>'app',
    (p_snapshot->>'taken_at')::TIMESTAMPTZ,
    (p_snapshot->>'complete')::BOOLEAN,
    (p_snapshot->>'member_count')::INTEGER,
    p_snapshot->>'content_hash',
    p_snapshot->>'sync_run_id',
    (p_snapshot->>'is_simulated')::BOOLEAN,
    p_tenant_id,
    p_snapshot->>'coverage'
  );

  -- Insert sync run with tenant_id and stage
  INSERT INTO sync_runs (
    id, app, status, trigger, started_at, completed_at,
    grants_added, grants_removed, snapshot_id, is_simulated, sim_index, created_by,
    tenant_id, stage, coverage, error, counts, baseline
  ) VALUES (
    p_run->>'id',
    p_run->>'app',
    p_run->>'status',
    p_run->>'trigger',
    (p_run->>'started_at')::TIMESTAMPTZ,
    (p_run->>'completed_at')::TIMESTAMPTZ,
    (p_run->>'grants_added')::INTEGER,
    (p_run->>'grants_removed')::INTEGER,
    p_run->>'snapshot_id',
    (p_run->>'is_simulated')::BOOLEAN,
    (p_run->>'sim_index')::INTEGER,
    p_run->>'created_by',
    p_tenant_id,
    p_run->>'stage',
    p_run->>'coverage',
    p_run->>'error',
    p_run->>'counts',
    (p_run->>'baseline')::BOOLEAN
  );

  -- Insert users with tenant_id (on conflict do nothing)
  INSERT INTO users (
    id, display_name, pseudonym, department, title, manager_id,
    employment_type, start_date, seniority, tenant_id
  )
  SELECT
    user_data->>'id',
    user_data->>'display_name',
    user_data->>'pseudonym',
    user_data->>'department',
    user_data->>'title',
    user_data->>'manager_id',
    user_data->>'employment_type',
    (user_data->>'start_date')::DATE,
    user_data->>'seniority',
    p_tenant_id
  FROM jsonb_array_elements(p_users) AS user_data
  ON CONFLICT (id) DO NOTHING;

  -- Insert entitlements with tenant_id (on conflict do nothing)
  INSERT INTO entitlements (
    id, app, name, kind, privilege_level, data_sensitivity, categories,
    seasonal, downgrade_to_id, version, tenant_id
  )
  SELECT
    ent_data->>'id',
    ent_data->>'app',
    ent_data->>'name',
    ent_data->>'kind',
    ent_data->>'privilege_level',
    ent_data->>'data_sensitivity',
    ent_data->>'categories',
    (ent_data->>'seasonal')::BOOLEAN,
    ent_data->>'downgrade_to_id',
    (ent_data->>'version')::INTEGER,
    p_tenant_id
  FROM jsonb_array_elements(p_entitlements) AS ent_data
  ON CONFLICT (id) DO NOTHING;

  -- Insert grants with tenant_id (on conflict do nothing for idempotency)
  INSERT INTO grants (
    id, user_id, entitlement_id, app, granted_at, removed_at,
    source, first_seen_snapshot_id, last_seen_snapshot_id, is_simulated, created_at, tenant_id
  )
  SELECT
    grant_data->>'id',
    grant_data->>'user_id',
    grant_data->>'entitlement_id',
    grant_data->>'app',
    (grant_data->>'granted_at')::TIMESTAMPTZ,
    (grant_data->>'removed_at')::TIMESTAMPTZ,
    grant_data->>'source',
    grant_data->>'first_seen_snapshot_id',
    grant_data->>'last_seen_snapshot_id',
    (grant_data->>'is_simulated')::BOOLEAN,
    (grant_data->>'created_at')::TIMESTAMPTZ,
    p_tenant_id
  FROM jsonb_array_elements(p_grants) AS grant_data
  ON CONFLICT (id) DO NOTHING;

  -- Insert audit event with tenant_id
  INSERT INTO audit_events (
    id, at, actor_id, action, target_type, target_id, detail, prev_hash, hash, session_id, is_simulated, tenant_id
  ) VALUES (
    p_audit->>'id',
    (p_audit->>'at')::TIMESTAMPTZ,
    p_audit->>'actor_id',
    p_audit->>'action',
    p_audit->>'target_type',
    p_audit->>'target_id',
    p_audit->>'detail',
    p_audit->>'prev_hash',
    p_audit->>'hash',
    p_audit->>'session_id',
    (p_audit->>'is_simulated')::BOOLEAN,
    p_tenant_id
  );

  -- Return success
  v_result := jsonb_build_object(
    'success', true,
    'snapshot_id', p_snapshot->>'id',
    'sync_run_id', p_run->>'id',
    'tenant_id', p_tenant_id
  );

  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Duplicate record during sync: %', SQLERRM;
  WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'Foreign key violation during sync: %', SQLERRM;
END;
$$;

-- Grant execute to service_role only
GRANT EXECUTE ON FUNCTION persist_sync TO service_role;

-- create_tenant: Create a new tenant
CREATE OR REPLACE FUNCTION create_tenant(p_name TEXT) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id TEXT;
BEGIN
  v_tenant_id := 'tenant-' || encode(gen_random_bytes(16), 'hex');

  INSERT INTO tenants (id, name)
  VALUES (v_tenant_id, p_name);

  RETURN jsonb_build_object('success', true, 'tenant_id', v_tenant_id);
END;
$$;

-- Grant execute to service_role only
GRANT EXECUTE ON FUNCTION create_tenant TO service_role;

-- upsert_provider_connection: Create or update provider connection
CREATE OR REPLACE FUNCTION upsert_provider_connection(
  p_tenant_id TEXT,
  p_provider TEXT,
  p_account_login TEXT,
  p_account_id TEXT,
  p_status TEXT,
  p_scopes_note TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_connection_id TEXT;
BEGIN
  v_connection_id := p_provider || '-' || p_account_id;

  INSERT INTO provider_connections (
    id, tenant_id, provider, account_login, account_id, status, scopes_note, last_success_at
  ) VALUES (
    v_connection_id, p_tenant_id, p_provider, p_account_login, p_account_id, p_status, p_scopes_note, NOW()
  )
  ON CONFLICT (tenant_id, provider, account_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    scopes_note = COALESCE(EXCLUDED.scopes_note, provider_connections.scopes_note),
    last_success_at = CASE WHEN EXCLUDED.status = 'connected' THEN NOW() ELSE provider_connections.last_success_at END,
    last_error = CASE WHEN EXCLUDED.status != 'connected' THEN EXCLUDED.status ELSE NULL END,
    updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'connection_id', v_connection_id);
END;
$$;

-- Grant execute to service_role only
GRANT EXECUTE ON FUNCTION upsert_provider_connection TO service_role;
