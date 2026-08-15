// Live sanity check after bootstrap + seed:
//   1. as an ANONYMOUS client (publishable key) every sensitive table must
//      read back as [] — RLS is forced, anon has no policies;
//   2. as service_role: row counts per table, plus an assertion that the
//      stored Gemini key looks right (hint present, ciphertext is a v1
//      envelope) — the ciphertext itself is never printed.
//
// Run: node saas/scripts/verify-live.mjs

import { loadEnv, restClient, fail } from "./env.mjs";

// Publishable keys are public by design (they ship in the browser bundle);
// the literal here is the project's published anon key.
const PUBLISHABLE_FALLBACK = "sb_publishable_F4whCRaKdrKFBtv2kevG5A_tcM1k3iS";

const ANON_TABLES = ["organizations", "memberships", "calls", "transcripts", "analyses", "org_ai_keys"];
const COUNT_TABLES = [
  "organizations", "memberships", "calls", "transcripts", "analyses",
  "checklists", "usage_counters", "org_ai_keys", "integrations", "audit_log",
];

const env = loadEnv(["SUPABASE_URL", "SUPABASE_SECRET_KEY"]);
const anon = restClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY || PUBLISHABLE_FALLBACK);
const service = restClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);

// --- Anonymous reads: anything but an empty array is a leak -----------------
const anonResults = new Map();
const leaking = [];
for (const table of ANON_TABLES) {
  const res = await anon("GET", `${table}?select=*&limit=5`);
  const rows = Array.isArray(res.data) ? res.data.length : null;
  if (res.ok && rows === 0) {
    anonResults.set(table, "[] ok");
  } else if (res.ok) {
    anonResults.set(table, `${rows} rows LEAK`);
    leaking.push(table);
  } else {
    // A denied request also means anon saw nothing, but flag it: the spec is
    // "returns []", so an HTTP error is worth a human look.
    anonResults.set(table, `HTTP ${res.status}`);
  }
}

// --- Service-role counts ----------------------------------------------------
const counts = new Map();
for (const table of COUNT_TABLES) {
  const res = await service("HEAD", `${table}?select=id`, { prefer: "count=exact" });
  const range = res.headers.get("content-range") || "";
  const total = range.includes("/") ? range.split("/")[1] : "?";
  counts.set(table, res.ok ? total : `HTTP ${res.status}`);
}

// --- Stored key shape (hint + envelope version only, never the ciphertext) --
const akRes = await service("GET", "org_ai_keys?select=provider,key_hint,key_ciphertext");
if (!akRes.ok) fail(`org_ai_keys read: HTTP ${akRes.status}`);
const keyLines = [];
let keysOk = (akRes.data || []).length > 0;
for (const row of akRes.data || []) {
  const hintOk = typeof row.key_hint === "string" && row.key_hint.length > 0;
  const ctOk = typeof row.key_ciphertext === "string" && row.key_ciphertext.startsWith("v1.");
  if (!hintOk || !ctOk) keysOk = false;
  keyLines.push(`  ${row.provider}: hint=${hintOk ? row.key_hint : "MISSING"} ciphertext=${ctOk ? "v1.* ok" : "BAD"}`);
}

// --- Report -----------------------------------------------------------------
console.log("═══ VERIFY: live Supabase ═══");
console.log("table            | anon      | service rows");
console.log("-----------------+-----------+-------------");
for (const table of COUNT_TABLES) {
  const anonCell = anonResults.has(table) ? anonResults.get(table) : "—";
  console.log(`${table.padEnd(17)}| ${String(anonCell).padEnd(10)}| ${counts.get(table)}`);
}
console.log("org_ai_keys shape:");
for (const line of keyLines) console.log(line);
if (!keysOk) console.log("  WARN: key hint/ciphertext assertion failed");

console.log(leaking.length === 0 ? "RLS-ANON-LEAK: no" : `RLS-ANON-LEAK: ${leaking.join(", ")}`);
if (leaking.length > 0 || !keysOk) process.exit(1);
