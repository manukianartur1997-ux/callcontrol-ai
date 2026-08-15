// Seeds one fully analyzed demo call into the live pilot org, end to end:
// call row → transcript → real Gemini analysis (org's own encrypted key) →
// analyses row → usage counter. Idempotency key: (source='manual',
// external_id='demo-igor-001') — if that call already has an analysis, the
// script does nothing.
//
// Run: node saas/scripts/seed-demo-call.mjs (after bootstrap-org.mjs)

import { analyzeCall } from "../worker/ai.js";
import { decryptSecret } from "../worker/crypto.js";
import { loadEnv, restClient, fail } from "./env.mjs";

const EXTERNAL_ID = "demo-igor-001";

// Реалистичный слабый звонок — тот же фикстур, на котором прогонялся весь
// пайплайн: менеджер не квалифицировал и не зафиксировал следующий шаг.
const TRANSCRIPT = `Менеджер: Алло, добрый день, компания "Онлайн-школа Профи", меня Игорь зовут.
Клиент: Да, здравствуйте, я оставлял заявку на курс по программированию.
Менеджер: Ага, отлично. У нас есть курс Python, стоит 25 тысяч, длится 4 месяца, там всё с нуля.
Клиент: А на кого рассчитано? Я вообще с гуманитарным образованием.
Менеджер: Ну на всех, там с самых основ идёт. Записываю вас?
Клиент: Ну я не знаю, надо подумать, дороговато.
Менеджер: Хорошо, думайте, если что звоните. Всего доброго.
Клиент: Ага, до свидания.`;

const env = loadEnv(["SUPABASE_URL", "SUPABASE_SECRET_KEY", "ORG_SECRET_KEY"]);
const rest = restClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);

const orgRes = await rest("GET", "organizations?slug=eq.callcontrol&select=id");
if (!orgRes.ok) fail(`organizations read: HTTP ${orgRes.status} ${JSON.stringify(orgRes.data)}`);
const org = Array.isArray(orgRes.data) ? orgRes.data[0] : null;
if (!org) fail("organization with slug 'callcontrol' not found — run bootstrap-org.mjs first");

// --- Idempotency: does the demo call already exist, and is it analyzed? -----
const callQuery = `calls?org_id=eq.${org.id}&source=eq.manual&external_id=eq.${EXTERNAL_ID}&select=id,status`;
const existingRes = await rest("GET", callQuery);
if (!existingRes.ok) fail(`calls read: HTTP ${existingRes.status} ${JSON.stringify(existingRes.data)}`);
let call = Array.isArray(existingRes.data) ? existingRes.data[0] : null;

if (call) {
  const anRes = await rest("GET", `analyses?call_id=eq.${call.id}&select=id,score&limit=1`);
  if (!anRes.ok) fail(`analyses read: HTTP ${anRes.status} ${JSON.stringify(anRes.data)}`);
  if (Array.isArray(anRes.data) && anRes.data.length > 0) {
    console.log(`already seeded — call ${call.id}, score ${anRes.data[0].score}`);
    process.exit(0);
  }
  // Call exists but a previous run died before the analysis — resume from here.
}

// --- Call + transcript ------------------------------------------------------
if (!call) {
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const insRes = await rest("POST", "calls", {
    prefer: "return=representation",
    body: {
      org_id: org.id,
      source: "manual",
      external_id: EXTERNAL_ID,
      direction: "inbound",
      manager_label: "Игорь",
      customer_phone: "380671112233",
      started_at: yesterday,
      duration_sec: 95,
      status: "pending",
    },
  });
  if (!insRes.ok) fail(`calls insert: HTTP ${insRes.status} ${JSON.stringify(insRes.data)}`);
  call = insRes.data[0];
}

// Transcript is 1:1 with the call; ignore-duplicates makes the resume path safe.
const trRes = await rest("POST", "transcripts?on_conflict=call_id", {
  prefer: "resolution=ignore-duplicates",
  body: { org_id: org.id, call_id: call.id, text: TRANSCRIPT, lang: "ru", provider: "manual" },
});
if (!trRes.ok) fail(`transcripts insert: HTTP ${trRes.status} ${JSON.stringify(trRes.data)}`);

// --- Checklist + the org's own Gemini key -----------------------------------
const clRes = await rest(
  "GET",
  `checklists?org_id=eq.${org.id}&is_default=eq.true&select=id,items&limit=1`
);
if (!clRes.ok) fail(`checklists read: HTTP ${clRes.status} ${JSON.stringify(clRes.data)}`);
const checklist = Array.isArray(clRes.data) ? clRes.data[0] : null;
if (!checklist) fail("no default checklist for the org — onboarding migration missing?");

const akRes = await rest(
  "GET",
  `org_ai_keys?org_id=eq.${org.id}&provider=eq.gemini&select=key_ciphertext&limit=1`
);
if (!akRes.ok) fail(`org_ai_keys read: HTTP ${akRes.status} ${JSON.stringify(akRes.data)}`);
const keyRow = Array.isArray(akRes.data) ? akRes.data[0] : null;
if (!keyRow) fail("no gemini key for the org — run bootstrap-org.mjs first");
const apiKey = await decryptSecret(keyRow.key_ciphertext, env.ORG_SECRET_KEY);

// --- Live analysis ----------------------------------------------------------
let result;
try {
  result = await analyzeCall({
    provider: "gemini",
    apiKey,
    model: "gemini-flash-latest",
    transcript: TRANSCRIPT,
    checklist: { items: checklist.items },
    context: { managerName: "Игорь", direction: "inbound", durationSec: 95 },
  });
} catch (err) {
  // Leave a diagnosable trail in the DB, then fail with the provider's code.
  await rest("PATCH", `calls?id=eq.${call.id}`, {
    body: { status: "failed", error: String(err.message) },
  });
  fail(`gemini analysis failed: ${err.message}`);
}

// --- Persist: analysis, call status, usage counter --------------------------
const anIns = await rest("POST", "analyses", {
  prefer: "return=representation",
  body: {
    org_id: org.id,
    call_id: call.id,
    checklist_id: checklist.id,
    score: result.score,
    findings: result,
    provider: result.provider,
    model: result.model,
    tokens_in: result.tokensIn || 0,
    tokens_out: result.tokensOut || 0,
  },
});
if (!anIns.ok) fail(`analyses insert: HTTP ${anIns.status} ${JSON.stringify(anIns.data)}`);

const stRes = await rest("PATCH", `calls?id=eq.${call.id}`, {
  body: { status: "analyzed", error: null },
});
if (!stRes.ok) fail(`calls patch: HTTP ${stRes.status} ${JSON.stringify(stRes.data)}`);

// usage_counters: read-then-upsert for the current UTC month. A single seed
// script has no concurrency to worry about; the Worker path does this in SQL.
const now = new Date();
const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
const ucRes = await rest(
  "GET",
  `usage_counters?org_id=eq.${org.id}&period=eq.${period}&select=id,calls_analyzed,tokens_in,tokens_out`
);
if (!ucRes.ok) fail(`usage_counters read: HTTP ${ucRes.status} ${JSON.stringify(ucRes.data)}`);
const counter = Array.isArray(ucRes.data) ? ucRes.data[0] : null;
const ucWrite = counter
  ? await rest("PATCH", `usage_counters?id=eq.${counter.id}`, {
      body: {
        calls_analyzed: counter.calls_analyzed + 1,
        tokens_in: counter.tokens_in + (result.tokensIn || 0),
        tokens_out: counter.tokens_out + (result.tokensOut || 0),
      },
    })
  : await rest("POST", "usage_counters?on_conflict=org_id,period", {
      prefer: "resolution=merge-duplicates",
      body: {
        org_id: org.id,
        period,
        calls_analyzed: 1,
        tokens_in: result.tokensIn || 0,
        tokens_out: result.tokensOut || 0,
      },
    });
if (!ucWrite.ok) fail(`usage_counters write: HTTP ${ucWrite.status} ${JSON.stringify(ucWrite.data)}`);

console.log("═══ SEED: демо-звонок разобран ═══");
console.log("Call:", call.id);
console.log("Score:", result.score, "/ 100");
console.log("Tokens:", result.tokensIn, "in /", result.tokensOut, "out");
