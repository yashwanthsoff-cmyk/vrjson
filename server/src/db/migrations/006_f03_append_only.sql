-- Migration 006: F-03 Append-Only Triggers

CREATE OR REPLACE FUNCTION enforce_activity_events_append_only()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'activity_events is append-only: UPDATE is forbidden'
      USING ERRCODE = '42501';
  ELSIF TG_OP = 'DELETE' THEN
    -- Allow deletion only when is_simulated = true (for dev reset)
    IF OLD.is_simulated = true THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'activity_events is append-only: DELETE of non-simulated records is forbidden'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_activity_events_append_only ON activity_events;
CREATE TRIGGER trg_activity_events_append_only
  BEFORE UPDATE OR DELETE ON activity_events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_activity_events_append_only();

CREATE OR REPLACE FUNCTION enforce_ingest_runs_append_only()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'ingest_runs is append-only: UPDATE is forbidden'
      USING ERRCODE = '42501';
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.is_simulated = true THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'ingest_runs is append-only: DELETE of non-simulated records is forbidden'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ingest_runs_append_only ON ingest_runs;
CREATE TRIGGER trg_ingest_runs_append_only
  BEFORE UPDATE OR DELETE ON ingest_runs
  FOR EACH ROW
  EXECUTE FUNCTION enforce_ingest_runs_append_only();
