-- Migration 008: F-03 Stored Procedures & RPCs

-- Atomic append ingest run with its activity events
CREATE OR REPLACE FUNCTION append_ingest(
  run_data JSONB,
  events_data JSONB
)
RETURNS JSONB AS $$
DECLARE
  run_id TEXT;
  events_count INTEGER;
BEGIN
  -- Insert ingest run
  INSERT INTO ingest_runs (
    id, app, at, window_from, window_to, events_pulled, unmapped, status, ing_index, is_simulated, created_at
  ) VALUES (
    run_data->>'id',
    run_data->>'app',
    (run_data->>'at')::TIMESTAMPTZ,
    (run_data->>'windowFrom')::TIMESTAMPTZ,
    (run_data->>'windowTo')::TIMESTAMPTZ,
    (run_data->>'eventsPulled')::INTEGER,
    (run_data->>'unmapped')::INTEGER,
    COALESCE(run_data->>'status', 'completed'),
    (run_data->>'ingIndex')::INTEGER,
    COALESCE((run_data->>'isSimulated')::BOOLEAN, false),
    NOW()
  ) RETURNING id INTO run_id;

  -- Insert activity events
  INSERT INTO activity_events (
    id, user_id, app, at, action, resource, action_class, is_simulated, ingest_run_id, created_at
  )
  SELECT
    (elem->>'id'),
    (elem->>'userId'),
    (elem->>'app'),
    (elem->>'at')::TIMESTAMPTZ,
    (elem->>'action'),
    COALESCE(elem->>'resource', ''),
    COALESCE(elem->>'actionClass', 'read'),
    COALESCE((elem->>'isSimulated')::BOOLEAN, false),
    run_id,
    NOW()
  FROM jsonb_array_elements(events_data) AS elem;

  GET DIAGNOSTICS events_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'runId', run_id,
    'eventsInserted', events_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reset simulated records for development/demo resets
CREATE OR REPLACE FUNCTION dev_reset_simulated()
RETURNS JSONB AS $$
DECLARE
  deleted_activities INTEGER := 0;
  deleted_ingests INTEGER := 0;
  deleted_grants INTEGER := 0;
  deleted_snapshots INTEGER := 0;
BEGIN
  DELETE FROM activity_events WHERE is_simulated = true;
  GET DIAGNOSTICS deleted_activities = ROW_COUNT;

  DELETE FROM ingest_runs WHERE is_simulated = true;
  GET DIAGNOSTICS deleted_ingests = ROW_COUNT;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'grants') THEN
    DELETE FROM grants WHERE is_simulated = true;
    GET DIAGNOSTICS deleted_grants = ROW_COUNT;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'snapshots') THEN
    DELETE FROM snapshots WHERE is_simulated = true;
    GET DIAGNOSTICS deleted_snapshots = ROW_COUNT;
  END IF;

  DELETE FROM usage_summaries;

  RETURN jsonb_build_object(
    'activityEvents', deleted_activities,
    'ingestRuns', deleted_ingests,
    'grants', deleted_grants,
    'snapshots', deleted_snapshots
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
