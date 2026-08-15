// Single shared Supabase client for the cabinet.
//
// Session persistence and token auto-refresh are supabase-js defaults — the
// cabinet relies on them and stores nothing itself. All direct table reads
// and writes from the browser go through this client and are scoped by RLS
// (see saas/migrations/0001_core.sql); anything RLS cannot be trusted with
// goes through the Worker API instead (see ./api.js).
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
