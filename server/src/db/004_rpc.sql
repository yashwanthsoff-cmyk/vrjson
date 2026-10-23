-- 004_rpc.sql: RPC functions (security definer)

-- Revoke execute from public, anon, authenticated
REVOKE EXECUTE ON FUNCTION pg_advisory_xact_lock(bigint) FROM public, anon, authenticated;

-- append_sync: Atomic sync operation with advisory lock
CREATE OR REPLACE FUNCTION append_sync(
  p_snapshot JSONB,
  p_run JSONB,
  p_grants JSONB,
  p_audit JSONB,
  p_schedule JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sim_index INTEGER;
BEGIN
  -- Take advisory lock to prevent concurrent sync conflicts
  PERFORM pg_advisory_xact_lock(hashtext('sync'));

  -- Extract sim_index if present
  v_sim_index := (p_run->>'sim_index')::INTEGER;

  -- Insert snapshot
  INSERT INTO snapshots (
    id, app, taken_at, complete, member_count, content_hash, sync_run_id, is_simulated
  ) VALUES (
    p_snapshot->>'id',
    p_snapshot->>'app',
    (p_snapshot->>'taken_at')::TIMESTAMPTZ,
    (p_snapshot->>'complete')::BOOLEAN,
    (p_snapshot->>'member_count')::INTEGER,
    p_snapshot->>'content_hash',
    p_snapshot->>'sync_run_id',
    (p_snapshot->>'is_simulated')::BOOLEAN
  );

  -- Insert sync run
  INSERT INTO sync_runs (
    id, app, status, trigger, started_at, completed_at,
    grants_added, grants_removed, snapshot_id, is_simulated, sim_index, created_by
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
    v_sim_index,
    p_run->>'created_by'
  );

  -- Insert grants (batch)
  INSERT INTO grants (
    id, user_id, entitlement_id, app, granted_at, removed_at,
    source, first_seen_snapshot_id, last_seen_snapshot_id, is_simulated, created_at
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
    (grant_data->>'created_at')::TIMESTAMPTZ
  FROM jsonb_array_elements(p_grants) AS grant_data;

  -- Insert audit event
  INSERT INTO audit_events (
    id, at, actor_id, action, target_type, target_id, detail, prev_hash, hash, session_id, is_simulated
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
    (p_audit->>'is_simulated')::BOOLEAN
  );

  -- Update sync schedule
  INSERT INTO sync_schedules (app, frequency, enabled, last_run_at, next_run_at, actor_id, updated_at)
  VALUES (
    p_schedule->>'app',
    p_schedule->>'frequency',
    (p_schedule->>'enabled')::BOOLEAN,
    (p_schedule->>'last_run_at')::TIMESTAMPTZ,
    (p_schedule->>'next_run_at')::TIMESTAMPTZ,
    p_schedule->>'actor_id',
    (p_schedule->>'updated_at')::TIMESTAMPTZ
  )
  ON CONFLICT (app) DO UPDATE SET
    frequency = EXCLUDED.frequency,
    enabled = EXCLUDED.enabled,
    last_run_at = EXCLUDED.last_run_at,
    next_run_at = EXCLUDED.next_run_at,
    actor_id = EXCLUDED.actor_id,
    updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object(
    'success', true,
    'snapshot_id', p_snapshot->>'id',
    'sync_run_id', p_run->>'id'
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Sim index conflict: %', SQLERRM;
END;
$$;

-- Grant execute to service_role only
GRANT EXECUTE ON FUNCTION append_sync TO service_role;

-- dev_reset_simulated: Reset simulated data
CREATE OR REPLACE FUNCTION dev_reset_simulated() RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted JSONB;
BEGIN
  -- Set dev reset flag
  SET LOCAL app.dev_reset = 'on';

  -- Delete simulated grants
  DELETE FROM grants WHERE is_simulated = TRUE;

  -- Delete simulated snapshots
  DELETE FROM snapshots WHERE is_simulated = TRUE;

  -- Delete simulated sync runs
  DELETE FROM sync_runs WHERE is_simulated = TRUE;

  -- Delete simulated audit events
  DELETE FROM audit_events WHERE is_simulated = TRUE;

  -- Delete simulated manual findings
  DELETE FROM manual_findings WHERE is_simulated = TRUE;

  -- Return counts
  SELECT jsonb_build_object(
    'grants', (SELECT COUNT(*) FROM grants WHERE is_simulated = FALSE),
    'snapshots', (SELECT COUNT(*) FROM snapshots WHERE is_simulated = FALSE),
    'sync_runs', (SELECT COUNT(*) FROM sync_runs WHERE is_simulated = FALSE),
    'audit_events', (SELECT COUNT(*) FROM audit_events WHERE is_simulated = FALSE),
    'manual_findings', (SELECT COUNT(*) FROM manual_findings WHERE is_simulated = FALSE)
  ) INTO v_deleted;

  RETURN v_deleted;
END;
$$;

-- Grant execute to service_role only
GRANT EXECUTE ON FUNCTION dev_reset_simulated TO service_role;
