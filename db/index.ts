// The production application now uses Supabase PostgreSQL.
// Kept as a compatibility entrypoint for older imports.
export { createClient as getDb } from "@/lib/supabase/server";
