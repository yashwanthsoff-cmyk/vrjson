import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
console.log("SUPABASE_URL host:", new URL(url).host);
console.log("service key set:", Boolean(key));

const sb = createClient(url, key, { auth: { persistSession: false } });
const { error, count } = await sb.from("users").select("*", { count: "exact", head: true });
if (error) { console.log("users table query failed:", error.code, error.message); process.exit(1); }
console.log("users rows:", count);
