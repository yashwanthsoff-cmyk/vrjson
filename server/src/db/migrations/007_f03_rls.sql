-- Migration 007: F-03 Row-Level Security

ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_mapping_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_summaries ENABLE ROW LEVEL SECURITY;

-- Activity Events Policies
DROP POLICY IF EXISTS "Allow anon read activity_events" ON activity_events;
CREATE POLICY "Allow anon read activity_events" ON activity_events
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow service_role insert activity_events" ON activity_events;
CREATE POLICY "Allow service_role insert activity_events" ON activity_events
  FOR INSERT TO anon, authenticated, service_role WITH CHECK (true);

-- Event Mapping Rules Policies
DROP POLICY IF EXISTS "Allow anon read event_mapping_rules" ON event_mapping_rules;
CREATE POLICY "Allow anon read event_mapping_rules" ON event_mapping_rules
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated modify event_mapping_rules" ON event_mapping_rules;
CREATE POLICY "Allow authenticated modify event_mapping_rules" ON event_mapping_rules
  FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

-- Ingest Runs Policies
DROP POLICY IF EXISTS "Allow anon read ingest_runs" ON ingest_runs;
CREATE POLICY "Allow anon read ingest_runs" ON ingest_runs
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow service_role insert ingest_runs" ON ingest_runs;
CREATE POLICY "Allow service_role insert ingest_runs" ON ingest_runs
  FOR INSERT TO anon, authenticated, service_role WITH CHECK (true);

-- Usage Summaries Policies
DROP POLICY IF EXISTS "Allow anon read usage_summaries" ON usage_summaries;
CREATE POLICY "Allow anon read usage_summaries" ON usage_summaries
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated upsert usage_summaries" ON usage_summaries;
CREATE POLICY "Allow authenticated upsert usage_summaries" ON usage_summaries
  FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
