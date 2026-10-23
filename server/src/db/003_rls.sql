-- 003_rls.sql: Row Level Security

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_summaries ENABLE ROW LEVEL SECURITY;

-- Anon gets SELECT only on users, entitlements, grants, snapshots, sync_runs, sync_schedules, role_changes
CREATE POLICY "Anon can select users" ON users FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can select entitlements" ON entitlements FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can select grants" ON grants FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can select snapshots" ON snapshots FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can select sync_runs" ON sync_runs FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can select sync_schedules" ON sync_schedules FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can select role_changes" ON role_changes FOR SELECT TO anon USING (true);

-- Deny all other anon operations
CREATE POLICY "Anon cannot insert users" ON users FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "Anon cannot update users" ON users FOR UPDATE TO anon USING (false);
CREATE POLICY "Anon cannot delete users" ON users FOR DELETE TO anon USING (false);

CREATE POLICY "Anon cannot insert entitlements" ON entitlements FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "Anon cannot update entitlements" ON entitlements FOR UPDATE TO anon USING (false);
CREATE POLICY "Anon cannot delete entitlements" ON entitlements FOR DELETE TO anon USING (false);

CREATE POLICY "Anon cannot insert grants" ON grants FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "Anon cannot update grants" ON grants FOR UPDATE TO anon USING (false);
CREATE POLICY "Anon cannot delete grants" ON grants FOR DELETE TO anon USING (false);

CREATE POLICY "Anon cannot insert snapshots" ON snapshots FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "Anon cannot update snapshots" ON snapshots FOR UPDATE TO anon USING (false);
CREATE POLICY "Anon cannot delete snapshots" ON snapshots FOR DELETE TO anon USING (false);

CREATE POLICY "Anon cannot insert sync_runs" ON sync_runs FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "Anon cannot update sync_runs" ON sync_runs FOR UPDATE TO anon USING (false);
CREATE POLICY "Anon cannot delete sync_runs" ON sync_runs FOR DELETE TO anon USING (false);

CREATE POLICY "Anon cannot insert sync_schedules" ON sync_schedules FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "Anon cannot update sync_schedules" ON sync_schedules FOR UPDATE TO anon USING (false);
CREATE POLICY "Anon cannot delete sync_schedules" ON sync_schedules FOR DELETE TO anon USING (false);

CREATE POLICY "Anon cannot insert role_changes" ON role_changes FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "Anon cannot update role_changes" ON role_changes FOR UPDATE TO anon USING (false);
CREATE POLICY "Anon cannot delete role_changes" ON role_changes FOR DELETE TO anon USING (false);

-- Deny all anon access to other tables
CREATE POLICY "Anon no access reviewers" ON reviewers FOR ALL TO anon USING (false);
CREATE POLICY "Anon no access connectors" ON connectors FOR ALL TO anon USING (false);
CREATE POLICY "Anon no access dev_flags" ON dev_flags FOR ALL TO anon USING (false);
CREATE POLICY "Anon no access evidence" ON evidence FOR ALL TO anon USING (false);
CREATE POLICY "Anon no access manual_findings" ON manual_findings FOR ALL TO anon USING (false);
CREATE POLICY "Anon no access audit_events" ON audit_events FOR ALL TO anon USING (false);
CREATE POLICY "Anon no access drift_summaries" ON drift_summaries FOR ALL TO anon USING (false);

-- Service role has full access (bypasses RLS by default, but explicitly stated for clarity)
-- Note: Service role bypasses RLS automatically, so we don't need policies for it
