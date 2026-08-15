// Live bootstrap of the pilot organization (slug "callcontrol") in the real
// Supabase project:
//   1. store the org's own Gemini key, encrypted with ORG_SECRET_KEY;
//   2. point the org at gemini / gemini-flash-latest / own key;
//   3. make sure both telephony integrations exist and print their webhook URLs.
//
// Idempotent: upserts everywhere, and existing integrations keep their
// webhook_token (ignore-duplicates), so re-running never rotates the URLs a
// telephony provider is already configured with.
//
// Run: node saas/scripts/bootstrap-org.mjs

import { encryptSecret, keyHint } from "../worker/crypto.js";
import { loadEnv, restClient, fail } from "./env.mjs";

const WORKER_BASE = "https://callcontrol-ai-demo.manukianartur1997.workers.dev";

const env = loadEnv(["SUPABASE_URL", "SUPABASE_SECRET_KEY", "ORG_SECRET_KEY", "GEMINI_API_KEY"]);
const rest = restClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);

// 1. The org must already exist — this script configures, it does not create.
const orgRes = await rest("GET", "organizations?slug=eq.callcontrol&select=id,name,slug");
if (!orgRes.ok) fail(`organizations read: HTTP ${orgRes.status} ${JSON.stringify(orgRes.data)}`);
const org = Array.isArray(orgRes.data) ? orgRes.data[0] : null;
if (!org) fail("organization with slug 'callcontrol' not found — create it first");

// 2. Encrypt the Gemini key and upsert it as the org's own key. Only the
// ciphertext and the 4-char hint ever leave this process.
const ciphertext = await encryptSecret(env.GEMINI_API_KEY, env.ORG_SECRET_KEY);
const hint = keyHint(env.GEMINI_API_KEY);
const keyRes = await rest("POST", "org_ai_keys?on_conflict=org_id,provider", {
  prefer: "resolution=merge-duplicates",
  body: { org_id: org.id, provider: "gemini", key_ciphertext: ciphertext, key_hint: hint },
});
if (!keyRes.ok) fail(`org_ai_keys upsert: HTTP ${keyRes.status} ${JSON.stringify(keyRes.data)}`);

// 3. Point the org at Gemini running on its own key.
const orgPatch = await rest("PATCH", `organizations?id=eq.${org.id}`, {
  body: { ai_provider: "gemini", ai_model: "gemini-flash-latest", ai_key_source: "own" },
});
if (!orgPatch.ok) fail(`organizations patch: HTTP ${orgPatch.status} ${JSON.stringify(orgPatch.data)}`);

// 4. Integrations: insert-if-missing. webhook_token has a DB default
// (gen_random_bytes), so a fresh row gets its token from Postgres and an
// existing row is left untouched.
const insRes = await rest("POST", "integrations?on_conflict=org_id,kind", {
  prefer: "resolution=ignore-duplicates",
  body: [
    { org_id: org.id, kind: "ringostat", enabled: true },
    { org_id: org.id, kind: "binotel", enabled: true },
  ],
});
if (!insRes.ok) fail(`integrations insert: HTTP ${insRes.status} ${JSON.stringify(insRes.data)}`);

const intRes = await rest(
  "GET",
  `integrations?org_id=eq.${org.id}&select=kind,webhook_token,enabled&order=kind`
);
if (!intRes.ok) fail(`integrations read: HTTP ${intRes.status} ${JSON.stringify(intRes.data)}`);
const integrations = intRes.data || [];
if (integrations.length < 2) fail(`expected 2 integrations, got ${integrations.length}`);

console.log("═══ BOOTSTRAP: пилотная организация ═══");
console.log("Org:", org.id, `(${org.slug} — ${org.name})`);
console.log("Gemini key:", hint, "→ org_ai_keys, шифртекст v1.*");
console.log("AI: gemini / gemini-flash-latest / ключ организации (own)");
for (const row of integrations) {
  console.log(`Webhook ${row.kind}: ${WORKER_BASE}/api/telephony/${row.kind}/${row.webhook_token}`);
}
