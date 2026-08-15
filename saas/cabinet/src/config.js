// Public runtime configuration for the cabinet.
//
// Both values are PUBLIC by design: the URL is in every request anyway, and
// the publishable key only grants what Row Level Security allows — the RLS
// suite (saas/test/01_rls_isolation.sql) is what actually protects data.
// Secrets (service key, org encryption key) live only in Worker env and must
// never appear in this bundle.
export const SUPABASE_URL = "https://vuzzrcydgjtaxoamykjt.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_F4whCRaKdrKFBtv2kevG5A_tcM1k3iS";

// Same-origin Worker API (see saas/worker/api.js). Relative on purpose —
// works on workers.dev today and on a custom domain tomorrow without edits.
export const API_BASE = "/api/app";
