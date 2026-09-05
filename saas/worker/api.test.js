// Tests for the SaaS HTTP layer.
//
// Everything outbound goes through a router-style fetch mock that records
// every request, so the assertions cover the two things that matter most
// here: who is allowed to reach what (auth / IDOR / role checks), and what
// exactly leaves the worker (decrypted key only to the provider, ciphertext
// only to the DB, hints only to the browser).
//
//   node --test saas/worker/api.test.js
//
// All key/token values below are synthetic test fixtures, not real secrets.

import test from "node:test";
import assert from "node:assert/strict";
import { createApi, dailyDigest, purgeExpiredData } from "./api.js";
import { encryptSecret } from "./crypto.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MASTER_KEY = Buffer.from(new Uint8Array(32).fill(7)).toString("base64");

const ENV = {
  SUPABASE_URL: "https://sb.example.test",
  SUPABASE_SECRET_KEY: "sb_secret_fake_for_tests",
  ORG_SECRET_KEY: MASTER_KEY
};

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const CALL_ID = "33333333-3333-4333-8333-333333333333";
const CHECKLIST_ID = "44444444-4444-4444-8444-444444444444";
const KEY_ID = "55555555-5555-4555-8555-555555555555";
const INTEGRATION_ID = "66666666-6666-4666-8666-666666666666";
const NEW_USER_ID = "77777777-7777-4777-8777-777777777777";
const DEPARTMENT_ID = "88888888-8888-4888-8888-888888888888";

const INVITE_ID = "99999999-9999-4999-8999-999999999999";
const NEW_ORG_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const GOOD_TOKEN = "good-jwt-token-for-tests";
const INVITE_TOKEN = "abcdef0123456789abcdef0123456789abcdef0123456789"; // 48 hex — matches the DB generator exactly
const SIGNUP_CODE = "fake-pilot-signup-code"; // synthetic — never the real gate
const PUBLISHABLE = "sb_publishable_fake_for_tests";
const ENV_SIGNUP = { ...ENV, SIGNUP_CODE, SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE };
const GEMINI_PLAIN_KEY = "AIzaFakePilotKey0001"; // synthetic — never a real key
const RINGO_TOKEN = "ringotokenaaaa1111";
const BINO_TOKEN = "binotokenbbbb2222";

const CHECKLIST_ITEMS = [
  { key: "greeting", weight: 20, label: "Приветствие", hint: "Назвал компанию" },
  { key: "needs", weight: 80, label: "Потребность", hint: "Открытые вопросы" }
];

const TRANSCRIPT =
  "Менеджер: Добрый день, это Пётр из CallControl. Клиент: Здравствуйте, расскажите про тарифы.";

const GEMINI_ANALYSIS = {
  score: 42,
  summary: "Менеджер представился и выяснил задачу.",
  items: [
    { key: "greeting", score: 100, evidence: "это Пётр из CallControl", comment: "Назвал компанию" },
    { key: "needs", score: 50, evidence: "", comment: "Неглубоко" }
  ],
  leaks: [],
  coaching: [],
  next_step: { present: false, detail: "" }
};

const GEMINI_OK = {
  candidates: [
    { finishReason: "STOP", content: { parts: [{ text: JSON.stringify(GEMINI_ANALYSIS) }] } }
  ],
  usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 210 }
};

const RINGOSTAT_COMPLETED = {
  call_id: "3333333333.3333333",
  caller: '"Ivan" <380671234567>',
  callee: "380441112233",
  status: "ANSWERED",
  date: "2026-08-08 11:11:11",
  call_duration: 50,
  waiting: 27,
  dialog: 23,
  type: "out",
  recording_wav: "https://app.ringostat.test/recordings/x.wav",
  has_recording: "1",
  employee_fio: "Иван Иванов",
  department: "Отдел продаж",
  staffid: "1111"
};

const BINOTEL_COMPLETED = {
  requestType: "apiCallCompleted",
  callDetails: {
    generalCallID: "1754650000.98765",
    startTime: "2026-08-08 14:20:00",
    callType: 0,
    internalNumber: "205",
    externalNumber: "380509998877",
    employeeName: "Петро Коваль",
    waitsec: 12,
    billsec: 187,
    disposition: "ANSWER"
  }
};

// ---------------------------------------------------------------------------
// Fetch mock: match method + URL substring -> canned reply, record everything
// ---------------------------------------------------------------------------

function createFetchMock() {
  const requests = [];
  const routes = [];

  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    const method = (init.method || "GET").toUpperCase();
    let body = null;
    if (typeof init.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch (_) {
        body = init.body;
      }
    }
    const record = { method, url, init, headers: init.headers || {}, body };
    requests.push(record);

    const route = routes.find((r) => r.method === method && url.includes(r.match));
    const reply = route
      ? typeof route.reply === "function"
        ? route.reply(record)
        : route.reply
      : { status: 404, body: { message: `no mock for ${method} ${url}` } };

    const status = reply.status ?? 200;
    const payload = reply.body;
    // Optional response headers (e.g. Content-Range for count=exact reads).
    // Existing routes omit them; a real Headers object keeps .get() working.
    const headers = new Headers(reply.headers || {});
    return {
      ok: status >= 200 && status < 300,
      status,
      headers,
      json: async () => payload,
      text: async () => (payload === undefined ? "" : JSON.stringify(payload))
    };
  };

  fetchImpl.on = (method, match, reply) => {
    routes.push({ method: method.toUpperCase(), match, reply });
    return fetchImpl;
  };
  fetchImpl.requests = requests;
  return fetchImpl;
}

function makeApi(mock, env = ENV) {
  return createApi({ env, fetchImpl: mock });
}

function get(path, token) {
  return new Request(`https://worker.test${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {}
  });
}

function send(method, path, body, token, contentType = "application/json") {
  return new Request(`https://worker.test${path}`, {
    method,
    headers: {
      "content-type": contentType,
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: typeof body === "string" ? body : JSON.stringify(body)
  });
}

function seedAuth(mock) {
  mock.on("GET", "/auth/v1/user", (record) =>
    record.headers.authorization === `Bearer ${GOOD_TOKEN}`
      ? {
          status: 200,
          body: { id: USER_ID, email: "owner@pilot.test", user_metadata: { full_name: "Артур" } }
        }
      : { status: 401, body: { msg: "invalid jwt" } }
  );
}

// The IDOR-guard query carries both org_id and user_id; anything else that
// reads memberships in these tests gets its own route registered later.
function seedMembership(mock, role) {
  mock.on("GET", "/rest/v1/memberships", (record) =>
    record.url.includes(`org_id=eq.${ORG_ID}`) && record.url.includes(`user_id=eq.${USER_ID}`)
      ? {
          body: [
            { id: "m-1", user_id: USER_ID, role, full_name: "Тест", extension: null, department_id: null }
          ]
        }
      : { body: [] }
  );
}

async function seedAnalyze(mock, { role = "owner", usageRow = null, quota = 500, gemini } = {}) {
  seedAuth(mock);
  seedMembership(mock, role);
  mock.on("GET", "/rest/v1/organizations", {
    body: [{ id: ORG_ID, name: "Pilot Co", monthly_call_quota: quota, timezone: "Europe/Kyiv", ai_provider: "gemini", ai_model: null }]
  });
  mock.on("GET", "/rest/v1/usage_counters", { body: usageRow ? [usageRow] : [] });
  mock.on("GET", "/rest/v1/calls", {
    body: [{ id: CALL_ID, org_id: ORG_ID, manager_label: "Іван Іванов", direction: "outbound", duration_sec: 187 }]
  });
  mock.on("GET", "/rest/v1/transcripts", { body: [{ id: "t-1", text: TRANSCRIPT, lang: "ru" }] });
  mock.on("GET", "/rest/v1/checklists", { body: [{ id: CHECKLIST_ID, items: CHECKLIST_ITEMS }] });
  mock.on("GET", "/rest/v1/org_ai_keys", {
    body: [{ id: KEY_ID, key_ciphertext: await encryptSecret(GEMINI_PLAIN_KEY, MASTER_KEY) }]
  });
  mock.on("POST", "generativelanguage.googleapis.com", gemini || { status: 200, body: GEMINI_OK });
  mock.on("POST", "/rest/v1/analyses", { status: 201 });
  mock.on("PATCH", "/rest/v1/calls", { status: 204 });
  // CAS contract: creates and updates ask for return=representation and treat
  // an empty array as "lost the race", so the mock echoes the written row.
  mock.on("POST", "/rest/v1/usage_counters", (record) => ({ status: 201, body: [record.body] }));
  mock.on("PATCH", "/rest/v1/usage_counters", (record) => ({ status: 200, body: [record.body] }));
  mock.on("PATCH", "/rest/v1/org_ai_keys", { status: 204 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });
}

const ENV_TG = { ...ENV, TELEGRAM_BOT_TOKEN: "fake-tg-bot-token" }; // synthetic

const AUDIO_B64 = "QUJDREVGRw=="; // tiny synthetic "audio" payload

const STT_TEXT =
  "Менеджер: Добрый день, это Пётр из CallControl.\nКлиент: Здравствуйте, расскажите про тарифы.";

const GEMINI_STT = {
  candidates: [
    { finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ lang: "ru", text: STT_TEXT }) }] } }
  ],
  usageMetadata: { promptTokenCount: 5000, candidatesTokenCount: 300 }
};

// Recordings hit Gemini twice (STT with an inlineData audio part, then the
// analysis); ONE route tells them apart by the request body.
async function seedRecordings(mock, {
  role = "owner",
  usageRow = { calls_analyzed: 3, tokens_in: 10, tokens_out: 10 },
  quota = 500,
  stt,
  analysis
} = {}) {
  seedAuth(mock);
  seedMembership(mock, role);
  mock.on("GET", "/rest/v1/organizations", {
    body: [{ id: ORG_ID, name: "Pilot Co", monthly_call_quota: quota, timezone: "Europe/Kyiv", ai_provider: "gemini", ai_model: null }]
  });
  mock.on("GET", "/rest/v1/usage_counters", { body: usageRow ? [usageRow] : [] });
  mock.on("GET", "/rest/v1/checklists", { body: [{ id: CHECKLIST_ID, items: CHECKLIST_ITEMS }] });
  mock.on("GET", "/rest/v1/org_ai_keys", {
    body: [{ id: KEY_ID, key_ciphertext: await encryptSecret(GEMINI_PLAIN_KEY, MASTER_KEY) }]
  });
  mock.on("POST", "generativelanguage.googleapis.com", (record) => {
    const isStt = Boolean(record.body?.contents?.[0]?.parts?.some((part) => part.inlineData));
    return isStt ? (stt || { status: 200, body: GEMINI_STT }) : (analysis || { status: 200, body: GEMINI_OK });
  });
  mock.on("GET", "/rest/v1/calls", {
    body: [{ id: CALL_ID, org_id: ORG_ID, manager_label: "Іван Іванов", direction: "outbound", duration_sec: 187, status: "pending" }]
  });
  mock.on("POST", "/rest/v1/calls", (record) => ({ status: 201, body: [{ id: CALL_ID, ...record.body }] }));
  mock.on("PATCH", "/rest/v1/calls", { status: 204 });
  mock.on("POST", "/rest/v1/transcripts", { status: 201 });
  mock.on("POST", "/rest/v1/analyses", { status: 201 });
  mock.on("POST", "/rest/v1/usage_counters", (record) => ({ status: 201, body: [record.body] }));
  mock.on("PATCH", "/rest/v1/usage_counters", (record) => ({ status: 200, body: [record.body] }));
  mock.on("PATCH", "/rest/v1/org_ai_keys", { status: 204 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });
}

// A pending invite; overrides let each test break exactly one validity rule.
function seedInvite(mock, overrides = {}) {
  const invite = {
    id: INVITE_ID,
    org_id: ORG_ID,
    email: "new@pilot.test",
    role: "manager",
    department_id: DEPARTMENT_ID,
    token: INVITE_TOKEN,
    invited_by: USER_ID,
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    accepted_at: null,
    ...overrides
  };
  mock.on("GET", "/rest/v1/invites", (record) =>
    record.url.includes(`token=eq.${INVITE_TOKEN}`) ? { body: [invite] } : { body: [] }
  );
  return invite;
}

// Everything createOrganization() writes; the org insert echoes the row back
// (return=representation) so the worker can read the new id.
function seedOrgCreation(mock) {
  mock.on("POST", "/rest/v1/organizations", (record) => ({
    status: 201,
    body: [{ ...record.body, id: NEW_ORG_ID }]
  }));
  mock.on("POST", "/rest/v1/memberships", { status: 201 });
  mock.on("POST", "/rest/v1/checklists", { status: 201 });
  mock.on("POST", "/rest/v1/integrations", { status: 201 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });
}

function seedWebhook(mock, kind, token) {
  mock.on("GET", "/rest/v1/integrations", (record) =>
    record.url.includes(`webhook_token=eq.${token}`) && record.url.includes(`kind=eq.${kind}`)
      ? { body: [{ id: INTEGRATION_ID, org_id: ORG_ID, kind, enabled: true }] }
      : { body: [] }
  );
  mock.on("GET", "/rest/v1/organizations", { body: [{ id: ORG_ID, timezone: "Europe/Kyiv" }] });
  mock.on("GET", "/rest/v1/memberships", {
    body: [
      { user_id: USER_ID, extension: "1111", full_name: "Иван Иванов", department_id: DEPARTMENT_ID },
      { user_id: NEW_USER_ID, extension: "205", full_name: "Петро Коваль", department_id: null }
    ]
  });
  mock.on("POST", "/rest/v1/calls", { status: 201 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });
  mock.on("PATCH", "/rest/v1/integrations", { status: 204 });
}

// ---------------------------------------------------------------------------
// Contract with the host worker
// ---------------------------------------------------------------------------

test("paths outside /api/app and /api/telephony return null for the host worker", async () => {
  const api = makeApi(createFetchMock());
  assert.equal(await api.handle(get("/api/health")), null);
  assert.equal(await api.handle(get("/api/leads")), null);
  assert.equal(await api.handle(get("/")), null);
});

test("missing env bindings answer 503 instead of throwing", async () => {
  const api = makeApi(createFetchMock(), { SUPABASE_URL: "https://sb.example.test" });
  const res = await api.handle(get("/api/app/me", GOOD_TOKEN));
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: "saas_not_configured" });

  const hook = await api.handle(send("POST", `/api/telephony/ringostat/${RINGO_TOKEN}`, {}));
  assert.equal(hook.status, 503);
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

test("no bearer token is 401", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  const res = await makeApi(mock).handle(get("/api/app/me"));
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: "unauthorized" });
  // Without a token there is nothing to validate — auth was never consulted.
  assert.equal(mock.requests.some((r) => r.url.includes("/auth/v1/user")), false);
});

test("a bad token is 401 after the auth endpoint rejects it", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  const res = await makeApi(mock).handle(get("/api/app/me", "forged-token"));
  assert.equal(res.status, 401);
  assert.equal(mock.requests.filter((r) => r.url.includes("/auth/v1/user")).length, 1);
});

test("a validated token is cached: two requests, one auth round-trip", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  mock.on("GET", "/rest/v1/memberships", { body: [] });
  const api = makeApi(mock);
  await api.handle(get("/api/app/me", GOOD_TOKEN));
  await api.handle(get("/api/app/me", GOOD_TOKEN));
  assert.equal(mock.requests.filter((r) => r.url.includes("/auth/v1/user")).length, 1);
});

// ---------------------------------------------------------------------------
// /me
// ---------------------------------------------------------------------------

test("/me returns the user plus memberships with the embedded organization", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  mock.on("GET", "/rest/v1/memberships", {
    body: [
      {
        org_id: ORG_ID,
        role: "owner",
        extension: "101",
        full_name: "Артур",
        department_id: null,
        organization: {
          id: ORG_ID,
          name: "Pilot Co",
          slug: "pilot-co",
          plan: "pilot",
          monthly_call_quota: 500,
          timezone: "Europe/Kyiv",
          ai_provider: "gemini",
          ai_model: null
        }
      }
    ]
  });

  const res = await makeApi(mock).handle(get("/api/app/me", GOOD_TOKEN));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = await res.json();
  // user_metadata now rides along — the cabinet header needs full_name/avatar.
  assert.deepEqual(body.user, {
    id: USER_ID,
    email: "owner@pilot.test",
    user_metadata: { full_name: "Артур" }
  });
  assert.equal(body.memberships[0].role, "owner");
  assert.equal(body.memberships[0].organization.slug, "pilot-co");

  // One embedded select, filtered to this user's active memberships.
  const query = decodeURIComponent(
    mock.requests.find((r) => r.url.includes("/rest/v1/memberships")).url
  );
  assert.match(query, /organization:organizations\(/);
  assert.match(query, new RegExp(`user_id=eq\\.${USER_ID}`));
  assert.match(query, /status=eq\.active/);
});

// ---------------------------------------------------------------------------
// Org middleware: UUID validation + IDOR guard
// ---------------------------------------------------------------------------

test("a non-UUID org id is 400 before any org data is read", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  const res = await makeApi(mock).handle(get("/api/app/orgs/1;or=(id.gt.0)/members", GOOD_TOKEN));
  assert.equal(res.status, 400);
  assert.equal(mock.requests.some((r) => r.url.includes("/rest/v1/")), false);
});

test("a non-member is 403 on every org route (IDOR guard)", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  mock.on("GET", "/rest/v1/memberships", { body: [] });
  const res = await makeApi(mock).handle(get(`/api/app/orgs/${ORG_ID}/members`, GOOD_TOKEN));
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: "not_a_member" });
});

// ---------------------------------------------------------------------------
// Analyze
// ---------------------------------------------------------------------------

test("analyze: a non-UUID call_id is 400", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/analyze`, { call_id: "1 or 1=1" }, GOOD_TOKEN)
  );
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "bad_call_id" });
});

test("analyze: viewers are read-only", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "viewer");
  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/analyze`, { call_id: CALL_ID }, GOOD_TOKEN)
  );
  assert.equal(res.status, 403);
});

test("analyze: quota reached is 429 and the provider is never called", async () => {
  const mock = createFetchMock();
  await seedAnalyze(mock, { quota: 5, usageRow: { id: "u-1", calls_analyzed: 5, tokens_in: 1, tokens_out: 1 } });
  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/analyze`, { call_id: CALL_ID }, GOOD_TOKEN)
  );
  assert.equal(res.status, 429);
  assert.deepEqual(await res.json(), { error: "quota_exceeded" });
  assert.equal(mock.requests.some((r) => r.url.includes("generativelanguage")), false);
});

test("analyze happy path: decrypted key to the provider, everything persisted", async () => {
  const mock = createFetchMock();
  await seedAnalyze(mock);
  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/analyze`, { call_id: CALL_ID }, GOOD_TOKEN)
  );

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.analysis.provider, "gemini");
  assert.equal(body.analysis.score, 60, "weighted: (100×20 + 50×80) / 100");

  // The DECRYPTED key went to Gemini and nowhere else.
  const gemini = mock.requests.find((r) => r.url.includes("generativelanguage"));
  assert.equal(gemini.headers["x-goog-api-key"], GEMINI_PLAIN_KEY);
  for (const r of mock.requests) {
    if (r === gemini) continue;
    assert.equal(String(r.init.body || "").includes(GEMINI_PLAIN_KEY), false, `key leaked to ${r.url}`);
  }

  const analysis = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/analyses"));
  assert.equal(analysis.body.org_id, ORG_ID);
  assert.equal(analysis.body.call_id, CALL_ID);
  assert.equal(analysis.body.checklist_id, CHECKLIST_ID);
  assert.equal(analysis.body.score, 60);
  assert.equal(analysis.body.findings.items.length, 2);
  assert.equal(analysis.body.tokens_in, 900);
  assert.equal(analysis.body.tokens_out, 210);

  // No usage row existed, so the quota slot was claimed by CREATING the month
  // row before the provider ran (ignore-duplicates + representation = CAS).
  const usage = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/usage_counters"));
  assert.equal(usage.body.calls_analyzed, 1);
  assert.match(usage.headers.prefer, /ignore-duplicates/);
  assert.match(usage.headers.prefer, /return=representation/);
  assert.match(decodeURIComponent(usage.url), /on_conflict=org_id,period/);
  const geminiAt = mock.requests.indexOf(mock.requests.find((r) => r.url.includes("generativelanguage")));
  assert.ok(mock.requests.indexOf(usage) < geminiAt, "slot must be reserved BEFORE the provider call");

  const callPatch = mock.requests.find((r) => r.method === "PATCH" && r.url.includes("/rest/v1/calls"));
  assert.equal(callPatch.body.status, "analyzed");
  assert.equal(callPatch.body.error, null);
  assert.match(decodeURIComponent(callPatch.url), new RegExp(`id=eq\\.${CALL_ID}`));

  const keyPatch = mock.requests.find((r) => r.method === "PATCH" && r.url.includes("/rest/v1/org_ai_keys"));
  assert.ok(keyPatch.body.last_ok_at);
  assert.equal(keyPatch.body.last_error, null);

  const audit = mock.requests.find(
    (r) => r.method === "POST" && r.url.includes("/rest/v1/audit_log")
  );
  assert.equal(audit.body.action, "call.analyzed");
  assert.equal(audit.body.actor_id, USER_ID);
  assert.deepEqual(audit.body.meta, { score: 60, tokens_in: 900, tokens_out: 210 });
});

test("analyze failure: call marked failed, 502, no key material in the response", async () => {
  const mock = createFetchMock();
  await seedAnalyze(mock, {
    usageRow: { calls_analyzed: 3, tokens_in: 0, tokens_out: 0 },
    gemini: { status: 500, body: { error: { message: "backend boom" } } }
  });
  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/analyze`, { call_id: CALL_ID }, GOOD_TOKEN)
  );

  assert.equal(res.status, 502);
  const body = await res.json();
  assert.equal(body.error, "analysis_failed");
  assert.match(body.detail, /gemini_http_500/);
  assert.equal(JSON.stringify(body).includes(GEMINI_PLAIN_KEY), false);

  const callPatch = mock.requests.find((r) => r.method === "PATCH" && r.url.includes("/rest/v1/calls"));
  assert.equal(callPatch.body.status, "failed");
  assert.match(callPatch.body.error, /gemini_http_500/);

  const keyPatch = mock.requests.find((r) => r.method === "PATCH" && r.url.includes("/rest/v1/org_ai_keys"));
  assert.match(keyPatch.body.last_error, /gemini_http_500/);

  const audit = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/audit_log"));
  assert.equal(audit.body.action, "call.analyze_failed");

  // The slot was reserved before the provider ran (CAS 3 -> 4)…
  const patches = mock.requests.filter(
    (r) => r.method === "PATCH" && r.url.includes("/rest/v1/usage_counters")
  );
  assert.equal(patches[0].body.calls_analyzed, 4);
  assert.match(decodeURIComponent(patches[0].url), /calls_analyzed=eq\.3/);
  // …and released after the failure (3 - 1 on the re-read of the static row).
  assert.equal(patches[patches.length - 1].body.calls_analyzed, 2);
});

test("analyze: concurrent CAS loser retries the reservation and still succeeds", async () => {
  const mock = createFetchMock();
  // Routes match in registration order, so the stateful CAS route must be
  // registered BEFORE seedAnalyze's static one to actually be hit.
  let patchCalls = 0;
  mock.on("PATCH", "/rest/v1/usage_counters", (record) => {
    patchCalls += 1;
    // First CAS attempt loses (someone else advanced the counter), then wins.
    return patchCalls === 1 ? { status: 200, body: [] } : { status: 200, body: [record.body] };
  });
  await seedAnalyze(mock, { usageRow: { calls_analyzed: 3, tokens_in: 0, tokens_out: 0 } });

  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/analyze`, { call_id: CALL_ID }, GOOD_TOKEN)
  );
  assert.equal(res.status, 200);
  assert.ok(patchCalls >= 2, `retry never happened (patchCalls=${patchCalls})`);
});

test("webhook: binotel is acked with the literal {status:success} body", async () => {
  const mock = createFetchMock();
  seedWebhook(mock, "binotel", RINGO_TOKEN);
  const res = await makeApi(mock).handle(
    send("POST", `/api/telephony/binotel/${RINGO_TOKEN}`, BINOTEL_COMPLETED)
  );
  assert.equal(res.status, 200);
  // Official doc: anything except {"status":"success"} triggers 7 redeliveries.
  assert.equal((await res.json()).status, "success");
});

test("webhook: new kinds (phonet/unitalk/streamtele) are routed, unknown still 404", async () => {
  const mock = createFetchMock();
  mock.on("GET", "/rest/v1/integrations", { body: [] });
  for (const kind of ["phonet", "unitalk", "streamtele"]) {
    const res = await makeApi(mock).handle(
      send("POST", `/api/telephony/${kind}/${RINGO_TOKEN}`, {})
    );
    // Route accepted (token miss -> 404 {ok:false}), NOT an unknown-kind 404
    assert.deepEqual(await res.json(), { ok: false }, kind);
  }
  const res = await makeApi(mock).handle(send("POST", `/api/telephony/asterisk/${RINGO_TOKEN}`, {}));
  assert.equal((await res.json()).error, "not_found");
});

test("webhook: a disabled integration is indistinguishable from a token miss", async () => {
  const mock = createFetchMock();
  mock.on("GET", "/rest/v1/integrations", {
    body: [{ id: INTEGRATION_ID, org_id: ORG_ID, kind: "ringostat", enabled: false }]
  });
  const res = await makeApi(mock).handle(
    send("POST", `/api/telephony/ringostat/${RINGO_TOKEN}`, RINGOSTAT_COMPLETED)
  );
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { ok: false });
  assert.equal(
    mock.requests.some((r) => r.method === "POST" && r.url.includes("/rest/v1/calls")),
    false,
    "a disabled integration must not store anything"
  );
});

test("webhook: an oversized body is rejected before parsing", async () => {
  const mock = createFetchMock();
  seedWebhook(mock, "ringostat", RINGO_TOKEN);
  const res = await makeApi(mock).handle(
    send("POST", `/api/telephony/ringostat/${RINGO_TOKEN}`, "a=".repeat(40_000), undefined, "application/x-www-form-urlencoded")
  );
  assert.equal(res.status, 413);
  assert.equal(
    mock.requests.some((r) => r.method === "POST" && r.url.includes("/rest/v1/calls")),
    false
  );
});

// ---------------------------------------------------------------------------
// Webhook rate limit (migration 0008) — a courtesy backstop, not the hard
// boundary (that stays monthly_call_quota). Fails OPEN on any error.
// ---------------------------------------------------------------------------

test("webhook rate limit: under the cap, the event is stored and the bucket increments", async () => {
  const mock = createFetchMock();
  seedWebhook(mock, "ringostat", RINGO_TOKEN);
  mock.on("GET", "/rest/v1/webhook_rate_limits", { body: [{ count: 5 }] });
  mock.on("PATCH", "/rest/v1/webhook_rate_limits", { status: 204 });

  const res = await makeApi(mock).handle(
    send("POST", `/api/telephony/ringostat/${RINGO_TOKEN}`, RINGOSTAT_COMPLETED)
  );
  assert.equal(res.status, 200);
  assert.ok(mock.requests.some((r) => r.method === "POST" && r.url.includes("/rest/v1/calls")), "event stored");
  const patch = mock.requests.find((r) => r.method === "PATCH" && r.url.includes("/rest/v1/webhook_rate_limits"));
  assert.equal(patch.body.count, 6);
});

test("webhook rate limit: the FIRST event of a minute creates the bucket row", async () => {
  const mock = createFetchMock();
  seedWebhook(mock, "ringostat", RINGO_TOKEN);
  mock.on("GET", "/rest/v1/webhook_rate_limits", { body: [] });
  mock.on("POST", "/rest/v1/webhook_rate_limits", { status: 201 });

  const res = await makeApi(mock).handle(
    send("POST", `/api/telephony/ringostat/${RINGO_TOKEN}`, RINGOSTAT_COMPLETED)
  );
  assert.equal(res.status, 200);
  const created = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/webhook_rate_limits"));
  assert.equal(created.body.count, 1);
  assert.equal(created.body.integration_id, INTEGRATION_ID);
  assert.match(decodeURIComponent(created.url), /on_conflict=integration_id,minute_bucket/);
  assert.match(String(created.headers.prefer || ""), /ignore-duplicates/);
});

test("webhook rate limit: at the cap, the event is acked but NOTHING is stored", async () => {
  const mock = createFetchMock();
  seedWebhook(mock, "ringostat", RINGO_TOKEN);
  mock.on("GET", "/rest/v1/webhook_rate_limits", { body: [{ count: 120 }] });

  const res = await makeApi(mock).handle(
    send("POST", `/api/telephony/ringostat/${RINGO_TOKEN}`, RINGOSTAT_COMPLETED)
  );
  assert.equal(res.status, 200, "still acked — never signals 'blocked' to the sender");
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(mock.requests.some((r) => r.method === "POST" && r.url.includes("/rest/v1/calls")), false);
  assert.equal(mock.requests.some((r) => r.method === "POST" && r.url.includes("/rest/v1/audit_log")), false);
  assert.equal(mock.requests.some((r) => r.method === "PATCH" && r.url.includes("/rest/v1/webhook_rate_limits")), false);
});

test("webhook rate limit: binotel over the cap still gets its literal ack (no 7x redelivery storm)", async () => {
  const mock = createFetchMock();
  seedWebhook(mock, "binotel", RINGO_TOKEN);
  mock.on("GET", "/rest/v1/webhook_rate_limits", { body: [{ count: 999 }] });

  const res = await makeApi(mock).handle(
    send("POST", `/api/telephony/binotel/${RINGO_TOKEN}`, BINOTEL_COMPLETED)
  );
  assert.deepEqual(await res.json(), { status: "success" });
});

test("webhook rate limit: pre-0008 (missing table) fails OPEN — the event still goes through", async () => {
  const mock = createFetchMock();
  seedWebhook(mock, "ringostat", RINGO_TOKEN);
  mock.on("GET", "/rest/v1/webhook_rate_limits", {
    status: 404,
    body: { code: "PGRST205", message: "Could not find the table 'public.webhook_rate_limits'" }
  });

  const res = await makeApi(mock).handle(
    send("POST", `/api/telephony/ringostat/${RINGO_TOKEN}`, RINGOSTAT_COMPLETED)
  );
  assert.equal(res.status, 200);
  assert.ok(mock.requests.some((r) => r.method === "POST" && r.url.includes("/rest/v1/calls")), "event still stored");
});

// A ctx whose waitUntil captures the backgrounded promise — the production
// path the old tests never exercised (no ctx was ever passed, and the calls
// insert returned no representation body, so the fire gate could not run).
function ctxSpy() {
  const captured = [];
  return { ctx: { waitUntil: (p) => captured.push(p) }, captured };
}

test("webhook e2e: a fresh ANSWERED call fires the pipeline via ctx.waitUntil, after acking", async () => {
  const mock = createFetchMock();
  // The insert MUST echo a representation row (registered first so it wins) so
  // the worker can tell a fresh insert from a redelivered duplicate.
  mock.on("POST", "/rest/v1/calls", (record) => ({ status: 201, body: [{ id: CALL_ID, ...record.body }] }));
  seedWebhook(mock, "ringostat", RINGO_TOKEN);

  const { ctx, captured } = ctxSpy();
  const res = await makeApi(mock).handle(
    send("POST", `/api/telephony/ringostat/${RINGO_TOKEN}`, RINGOSTAT_COMPLETED),
    ctx
  );

  // The ack is returned immediately; the pipeline was handed to waitUntil, not
  // awaited — so the PBX never blocks on the multi-second analysis.
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(captured.length, 1, "the answered call scheduled exactly one background pipeline");

  // Draining it must not reject (runIngestPipeline swallows its own errors).
  await Promise.allSettled(captured);
});

test("webhook e2e: an UNANSWERED call is acked but never fires the pipeline", async () => {
  const mock = createFetchMock();
  mock.on("POST", "/rest/v1/calls", (record) => ({ status: 201, body: [{ id: CALL_ID, ...record.body }] }));
  seedWebhook(mock, "ringostat", RINGO_TOKEN);

  const { ctx, captured } = ctxSpy();
  const res = await makeApi(mock).handle(
    send("POST", `/api/telephony/ringostat/${RINGO_TOKEN}`, { ...RINGOSTAT_COMPLETED, status: "NO ANSWER" }),
    ctx
  );
  assert.equal(res.status, 200);
  assert.equal(captured.length, 0, "an unanswered call wastes no STT/quota");
});

test("webhook e2e: a redelivered duplicate (empty representation) does not re-fire the pipeline", async () => {
  const mock = createFetchMock();
  // ignore-duplicates → the second insert returns an EMPTY representation array.
  mock.on("POST", "/rest/v1/calls", { status: 201, body: [] });
  seedWebhook(mock, "ringostat", RINGO_TOKEN);

  const { ctx, captured } = ctxSpy();
  const res = await makeApi(mock).handle(
    send("POST", `/api/telephony/ringostat/${RINGO_TOKEN}`, RINGOSTAT_COMPLETED),
    ctx
  );
  assert.equal(res.status, 200);
  assert.equal(captured.length, 0, "a duplicate delivery must fire the pipeline exactly zero extra times");
});

// ---------------------------------------------------------------------------
// AI key management
// ---------------------------------------------------------------------------

test("ai-key GET: hint and status only, never the ciphertext", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "admin");
  mock.on("GET", "/rest/v1/organizations", {
    body: [{ id: ORG_ID, monthly_call_quota: 500, timezone: "Europe/Kyiv", ai_provider: "gemini", ai_model: "gemini-flash-latest" }]
  });
  mock.on("GET", "/rest/v1/org_ai_keys", {
    body: [{ key_hint: "…0001", last_ok_at: "2026-08-13T10:00:00Z", last_error: null }]
  });

  const res = await makeApi(mock).handle(get(`/api/app/orgs/${ORG_ID}/ai-key`, GOOD_TOKEN));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    provider: "gemini",
    model: "gemini-flash-latest",
    hint: "…0001",
    last_ok_at: "2026-08-13T10:00:00Z",
    last_error: null
  });
});

test("ai-key PUT: an admin is refused — owner only", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "admin");
  const res = await makeApi(mock).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/ai-key`, { provider: "gemini", api_key: "sk-test-x" }, GOOD_TOKEN)
  );
  assert.equal(res.status, 403);
  assert.equal(mock.requests.some((r) => r.url.includes("org_ai_keys")), false);
});

test("ai-key PUT: owner stores ciphertext, response carries only the hint", async () => {
  const PLAINTEXT = "sk-test-plain-key-000";
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("POST", "/rest/v1/org_ai_keys", { status: 201 });
  mock.on("PATCH", "/rest/v1/organizations", { status: 204 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });

  const res = await makeApi(mock).handle(
    send(
      "PUT",
      `/api/app/orgs/${ORG_ID}/ai-key`,
      { provider: "gemini", api_key: PLAINTEXT, model: "gemini-flash-latest" },
      GOOD_TOKEN
    )
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, hint: "…-000" });

  const upsert = mock.requests.find((r) => r.method === "POST" && r.url.includes("org_ai_keys"));
  assert.match(upsert.headers.prefer, /merge-duplicates/);
  assert.match(decodeURIComponent(upsert.url), /on_conflict=org_id,provider/);
  assert.match(upsert.body.key_ciphertext, /^v1\./);
  assert.equal(upsert.init.body.includes(PLAINTEXT), false, "plaintext must never reach PostgREST");
  assert.equal(upsert.body.key_hint, "…-000");

  const orgPatch = mock.requests.find((r) => r.method === "PATCH" && r.url.includes("organizations"));
  assert.deepEqual(orgPatch.body, { ai_provider: "gemini", ai_model: "gemini-flash-latest" });

  const audit = mock.requests.find((r) => r.method === "POST" && r.url.includes("audit_log"));
  assert.equal(audit.body.action, "org.ai_key_set");
  assert.deepEqual(audit.body.meta, { provider: "gemini", hint: "…-000" });
  assert.equal(audit.init.body.includes(PLAINTEXT), false);
});

test("ai-key PUT: an unsupported provider is rejected before encryption", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  const res = await makeApi(mock).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/ai-key`, { provider: "llama", api_key: "x-y-z" }, GOOD_TOKEN)
  );
  assert.equal(res.status, 400);
});

// ---------------------------------------------------------------------------
// STT provider config (migration 0007)
// ---------------------------------------------------------------------------

// Answers the organizations read with STT columns when the select asks for
// stt_provider, and the plain org row otherwise. deepgramCipher pre-encrypted
// (the mock responder must be synchronous).
function seedSttOrg(mock, { provider = "gemini", deepgramCipher = null, deepgramHint = null, missing = false } = {}) {
  mock.on("GET", "/rest/v1/organizations", (record) => {
    if (record.url.includes("stt_provider")) {
      if (missing) {
        return { status: 400, body: { code: "42703", message: "column organizations.stt_provider does not exist" } };
      }
      return { body: [{ stt_provider: provider, stt_deepgram_key_ciphertext: deepgramCipher, stt_deepgram_key_hint: deepgramHint }] };
    }
    return { body: [{ id: ORG_ID, name: "Pilot Co", monthly_call_quota: 500, timezone: "Europe/Kyiv", ai_provider: "gemini", ai_model: null }] };
  });
}

test("stt GET: returns the provider and whether Deepgram is configured (never the key)", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  seedSttOrg(mock, { provider: "deepgram", deepgramCipher: "cipher-xyz", deepgramHint: "…dktk" });

  const res = await makeApi(mock).handle(get(`/api/app/orgs/${ORG_ID}/stt`, GOOD_TOKEN));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.provider, "deepgram");
  assert.equal(body.deepgram_configured, true);
  assert.equal(body.deepgram_hint, "…dktk");
  assert.deepEqual(body.providers, ["gemini", "deepgram"]);
  assert.equal("stt_deepgram_key_ciphertext" in body, false, "the ciphertext never reaches the browser");
});

test("stt GET: 503 migration_required before 0007, 403 for a viewer", async () => {
  const pre = createFetchMock();
  seedAuth(pre);
  seedMembership(pre, "owner");
  seedSttOrg(pre, { missing: true });
  const res = await makeApi(pre).handle(get(`/api/app/orgs/${ORG_ID}/stt`, GOOD_TOKEN));
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: "migration_required" });

  const viewer = createFetchMock();
  seedAuth(viewer);
  seedMembership(viewer, "viewer");
  const res2 = await makeApi(viewer).handle(get(`/api/app/orgs/${ORG_ID}/stt`, GOOD_TOKEN));
  assert.equal(res2.status, 403);
});

test("stt PUT: switching to gemini patches the provider (owner only)", async () => {
  const denied = createFetchMock();
  seedAuth(denied);
  seedMembership(denied, "admin");
  const forbidden = await makeApi(denied).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/stt`, { provider: "gemini" }, GOOD_TOKEN)
  );
  assert.equal(forbidden.status, 403, "STT spends money — owner only, like the AI key");

  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("PATCH", "/rest/v1/organizations", { status: 204 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });
  const ok = await makeApi(mock).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/stt`, { provider: "gemini" }, GOOD_TOKEN)
  );
  assert.equal(ok.status, 200);
  const patch = mock.requests.find((r) => r.method === "PATCH" && r.url.includes("/rest/v1/organizations"));
  assert.deepEqual(patch.body, { stt_provider: "gemini" });
});

test("stt PUT: selecting Deepgram stores the key ENCRYPTED and records only a hint", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("PATCH", "/rest/v1/organizations", { status: 204 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });
  const DEEPGRAM_KEY = "dg-secret-key-0001";

  const res = await makeApi(mock).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/stt`, { provider: "deepgram", key: DEEPGRAM_KEY }, GOOD_TOKEN)
  );
  assert.equal(res.status, 200);
  const patch = mock.requests.find((r) => r.method === "PATCH" && r.url.includes("/rest/v1/organizations"));
  assert.equal(patch.body.stt_provider, "deepgram");
  assert.ok(patch.body.stt_deepgram_key_ciphertext, "a ciphertext is stored");
  assert.notEqual(patch.body.stt_deepgram_key_ciphertext, DEEPGRAM_KEY, "the raw key is never stored");
  assert.ok(patch.body.stt_deepgram_key_hint, "a hint is stored");
  // the raw key must not appear anywhere in the outbound requests
  for (const r of mock.requests) {
    assert.equal(JSON.stringify(r.body || "").includes(DEEPGRAM_KEY), false, `key leaked to ${r.url}`);
  }
});

test("stt PUT: Deepgram without a key (and none stored) is refused", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  seedSttOrg(mock, { provider: "gemini", deepgramCipher: null }); // nothing stored
  const res = await makeApi(mock).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/stt`, { provider: "deepgram" }, GOOD_TOKEN)
  );
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "deepgram_key_required");
  assert.equal(mock.requests.some((r) => r.method === "PATCH"), false, "no provider switch without a usable key");
});

test("stt PUT: an unsupported provider is rejected", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  const res = await makeApi(mock).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/stt`, { provider: "whisper" }, GOOD_TOKEN)
  );
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "unsupported_provider");
});

test("stt pipeline: a Deepgram-configured org transcribes on Deepgram", async () => {
  const mock = createFetchMock();
  const cipher = await encryptSecret("dg-key-live", MASTER_KEY);
  // org read must answer BOTH the loadOrg select and the stt_provider select.
  mock.on("GET", "/rest/v1/organizations", (record) =>
    record.url.includes("stt_provider")
      ? { body: [{ stt_provider: "deepgram", stt_deepgram_key_ciphertext: cipher, stt_deepgram_key_hint: "…live" }] }
      : { body: [{ id: ORG_ID, name: "Pilot Co", monthly_call_quota: 500, timezone: "Europe/Kyiv", ai_provider: "gemini", ai_model: null }] }
  );
  await seedRecordings(mock);
  mock.on("POST", "api.deepgram.com", {
    status: 200,
    body: {
      metadata: { duration: 42 },
      results: {
        channels: [{ detected_language: "ru", alternatives: [{ words: [] }] }],
        utterances: [
          { speaker: 0, transcript: "Здравствуйте, чем могу помочь?" },
          { speaker: 1, transcript: "Хочу узнать цену." }
        ]
      }
    }
  });
  mock.on("POST", "/rest/v1/usage_ledger", { status: 201 });

  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/recordings`, recordingBody(), GOOD_TOKEN)
  );
  assert.equal(res.status, 200);
  assert.ok(mock.requests.some((r) => r.url.includes("api.deepgram.com")), "Deepgram was actually called");
  const transcript = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/transcripts"));
  assert.equal(transcript.body.provider, "deepgram", "the transcript records the real STT provider");
});

test("stt pipeline: a failing Deepgram falls back to Gemini", async () => {
  const mock = createFetchMock();
  const cipher = await encryptSecret("dg-key-live", MASTER_KEY);
  mock.on("GET", "/rest/v1/organizations", (record) =>
    record.url.includes("stt_provider")
      ? { body: [{ stt_provider: "deepgram", stt_deepgram_key_ciphertext: cipher, stt_deepgram_key_hint: "…live" }] }
      : { body: [{ id: ORG_ID, name: "Pilot Co", monthly_call_quota: 500, timezone: "Europe/Kyiv", ai_provider: "gemini", ai_model: null }] }
  );
  await seedRecordings(mock);
  mock.on("POST", "api.deepgram.com", { status: 500, body: { err: "deepgram down" } });
  mock.on("POST", "/rest/v1/usage_ledger", { status: 201 });

  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/recordings`, recordingBody(), GOOD_TOKEN)
  );
  assert.equal(res.status, 200, "the Gemini fallback carries the call to success");
  assert.ok(mock.requests.some((r) => r.url.includes("api.deepgram.com")), "Deepgram was tried first");
  assert.ok(mock.requests.some((r) => r.url.includes("generativelanguage")), "then Gemini ran as fallback");
  const transcript = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/transcripts"));
  assert.equal(transcript.body.provider, "gemini-audio", "the fallback provider is recorded");
});

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

test("members POST: an admin cannot create another admin", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "admin");
  const res = await makeApi(mock).handle(
    send(
      "POST",
      `/api/app/orgs/${ORG_ID}/members`,
      { email: "new@pilot.test", password: "fake-test-pass-1", full_name: "X", role: "admin" },
      GOOD_TOKEN
    )
  );
  assert.equal(res.status, 403);
  assert.equal(mock.requests.some((r) => r.url.includes("/auth/v1/admin/users")), false);
});

test("members POST: owner creates a manager; password stays out of the audit", async () => {
  const PASSWORD = "fake-test-pass-2";
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("POST", "/auth/v1/admin/users", { status: 200, body: { id: NEW_USER_ID } });
  mock.on("POST", "/rest/v1/memberships", { status: 201 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });

  const res = await makeApi(mock).handle(
    send(
      "POST",
      `/api/app/orgs/${ORG_ID}/members`,
      { email: "manager@pilot.test", password: PASSWORD, full_name: "Новий Менеджер", role: "manager", extension: "301" },
      GOOD_TOKEN
    )
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, user_id: NEW_USER_ID });

  const authCreate = mock.requests.find((r) => r.url.includes("/auth/v1/admin/users"));
  assert.equal(authCreate.body.email, "manager@pilot.test");
  assert.equal(authCreate.body.email_confirm, true);

  const insert = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/memberships"));
  assert.equal(insert.body.org_id, ORG_ID);
  assert.equal(insert.body.user_id, NEW_USER_ID);
  assert.equal(insert.body.role, "manager");
  assert.equal(insert.body.extension, "301");
  assert.equal(insert.body.status, "active");

  const audit = mock.requests.find((r) => r.method === "POST" && r.url.includes("audit_log"));
  assert.equal(audit.body.action, "member.added");
  assert.deepEqual(audit.body.meta, { role: "manager" });
  assert.equal(audit.init.body.includes(PASSWORD), false);
});

test("members POST: a duplicate email maps 422 to 409 email_exists", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("POST", "/auth/v1/admin/users", { status: 422, body: { msg: "already registered" } });

  const res = await makeApi(mock).handle(
    send(
      "POST",
      `/api/app/orgs/${ORG_ID}/members`,
      { email: "dup@pilot.test", password: "fake-test-pass-3", full_name: "X", role: "viewer" },
      GOOD_TOKEN
    )
  );
  assert.equal(res.status, 409);
  assert.deepEqual(await res.json(), { error: "email_exists" });
  assert.equal(mock.requests.some((r) => r.method === "POST" && r.url.includes("/rest/v1/memberships")), false);
});

// ---------------------------------------------------------------------------
// Integrations listing
// ---------------------------------------------------------------------------

test("integrations GET builds the ready-to-paste webhook path", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("GET", "/rest/v1/integrations", {
    body: [{ kind: "ringostat", enabled: true, webhook_token: RINGO_TOKEN, last_event_at: null }]
  });

  const res = await makeApi(mock).handle(get(`/api/app/orgs/${ORG_ID}/integrations`, GOOD_TOKEN));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), [
    {
      kind: "ringostat",
      enabled: true,
      webhook_path: `/api/telephony/ringostat/${RINGO_TOKEN}`,
      last_event_at: null
    }
  ]);
});

// ---------------------------------------------------------------------------
// Telephony webhooks
// ---------------------------------------------------------------------------

test("webhook: an unknown token is 404 with no oracle detail", async () => {
  const mock = createFetchMock();
  seedWebhook(mock, "ringostat", RINGO_TOKEN);
  const res = await makeApi(mock).handle(
    send("POST", "/api/telephony/ringostat/wrong-token-0000", RINGOSTAT_COMPLETED)
  );
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { ok: false });
  assert.equal(mock.requests.some((r) => r.method === "POST" && r.url.includes("/rest/v1/calls")), false);
});

test("webhook: an unknown kind is 404 before any lookup", async () => {
  const mock = createFetchMock();
  const res = await makeApi(mock).handle(send("POST", `/api/telephony/asterisk/${RINGO_TOKEN}`, {}));
  assert.equal(res.status, 404);
  assert.equal(mock.requests.length, 0);
});

test("webhook: ringostat completed call is stored idempotently with tz-corrected time", async () => {
  const mock = createFetchMock();
  seedWebhook(mock, "ringostat", RINGO_TOKEN);
  const res = await makeApi(mock).handle(
    send("POST", `/api/telephony/ringostat/${RINGO_TOKEN}`, RINGOSTAT_COMPLETED)
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });

  const insert = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/calls"));
  assert.match(insert.headers.prefer, /ignore-duplicates/);
  assert.match(decodeURIComponent(insert.url), /on_conflict=org_id,source,external_id/);
  assert.equal(insert.body.org_id, ORG_ID);
  assert.equal(insert.body.source, "ringostat");
  assert.equal(insert.body.external_id, "3333333333.3333333");
  assert.equal(insert.body.direction, "outbound");
  assert.equal(insert.body.customer_phone, "380441112233");
  assert.equal(insert.body.manager_id, USER_ID, "resolved by extension 1111");
  assert.equal(insert.body.department_id, DEPARTMENT_ID);
  assert.equal(insert.body.duration_sec, 23);
  assert.equal(insert.body.status, "pending");
  // Kyiv is UTC+3 in August: 11:11 local -> 08:11Z.
  assert.equal(insert.body.started_at, "2026-08-08T08:11:11.000Z");

  const audit = mock.requests.find((r) => r.method === "POST" && r.url.includes("audit_log"));
  assert.equal(audit.body.action, "telephony.event");
  assert.equal(audit.body.target, "3333333333.3333333");
  assert.equal(audit.body.meta.kind, "ringostat");
  assert.ok(audit.body.meta.raw.length <= 8000);

  const patch = mock.requests.find((r) => r.method === "PATCH" && r.url.includes("integrations"));
  assert.ok(patch.body.last_event_at);
});

test("webhook: a ringostat non-completed event is acknowledged and ignored", async () => {
  const mock = createFetchMock();
  seedWebhook(mock, "ringostat", RINGO_TOKEN);
  const res = await makeApi(mock).handle(
    send("POST", `/api/telephony/ringostat/${RINGO_TOKEN}`, { call_id: "1.2", type: "in", status: "CALLING" })
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, ignored: true });
  assert.equal(mock.requests.some((r) => r.method === "POST" && r.url.includes("/rest/v1/calls")), false);
});

test("webhook: a form-urlencoded ringostat body is parsed like JSON", async () => {
  const mock = createFetchMock();
  seedWebhook(mock, "ringostat", RINGO_TOKEN);
  const form = new URLSearchParams({
    call_id: "42.1",
    caller: '"Client" <380671112233>',
    status: "ANSWERED",
    date: "2026-08-08 11:11:11",
    call_duration: "50",
    dialog: "23",
    type: "in",
    has_recording: "0",
    employee_fio: "Иван Иванов",
    staffid: "1111"
  }).toString();

  const res = await makeApi(mock).handle(
    send("POST", `/api/telephony/ringostat/${RINGO_TOKEN}`, form, null, "application/x-www-form-urlencoded")
  );
  assert.equal(res.status, 200);

  const insert = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/calls"));
  assert.equal(insert.body.external_id, "42.1");
  assert.equal(insert.body.direction, "inbound");
  assert.equal(insert.body.customer_phone, "380671112233");
  assert.equal(insert.body.duration_sec, 23);
  assert.equal(insert.body.manager_id, USER_ID);
});

test("webhook: binotel apiCallCompleted is parsed and stored", async () => {
  const mock = createFetchMock();
  seedWebhook(mock, "binotel", BINO_TOKEN);
  const res = await makeApi(mock).handle(
    send("POST", `/api/telephony/binotel/${BINO_TOKEN}`, BINOTEL_COMPLETED)
  );
  assert.equal(res.status, 200);

  const insert = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/calls"));
  assert.equal(insert.body.source, "binotel");
  assert.equal(insert.body.external_id, "1754650000.98765");
  assert.equal(insert.body.direction, "inbound");
  assert.equal(insert.body.customer_phone, "380509998877");
  assert.equal(insert.body.manager_id, NEW_USER_ID, "resolved by extension 205");
  assert.equal(insert.body.duration_sec, 187);
  assert.equal(insert.body.started_at, "2026-08-08T11:20:00.000Z");
});

test("webhook: a binotel non-completed requestType is ignored", async () => {
  const mock = createFetchMock();
  seedWebhook(mock, "binotel", BINO_TOKEN);
  const res = await makeApi(mock).handle(
    send("POST", `/api/telephony/binotel/${BINO_TOKEN}`, { requestType: "apiCallSettings" })
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "success", ignored: true });
  assert.equal(mock.requests.some((r) => r.method === "POST" && r.url.includes("/rest/v1/calls")), false);
});

// ---------------------------------------------------------------------------
// Onboarding: /join (public, invite + fresh account)
// ---------------------------------------------------------------------------

test("join: a valid invite creates the confirmed account and the membership", async () => {
  const mock = createFetchMock();
  seedInvite(mock);
  mock.on("POST", "/auth/v1/admin/users", { status: 200, body: { id: NEW_USER_ID } });
  mock.on("POST", "/rest/v1/memberships", { status: 201 });
  mock.on("PATCH", "/rest/v1/invites", { status: 204 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });

  // Mixed-case email on purpose: the invite says new@pilot.test.
  const res = await makeApi(mock).handle(
    send("POST", "/api/app/join", {
      token: INVITE_TOKEN,
      email: "New@pilot.test",
      password: "fake-join-pass-1",
      full_name: "Новый Менеджер"
    })
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });

  const authCreate = mock.requests.find((r) => r.url.includes("/auth/v1/admin/users"));
  assert.equal(authCreate.body.email, "New@pilot.test");
  assert.equal(authCreate.body.email_confirm, true);
  assert.deepEqual(authCreate.body.user_metadata, { full_name: "Новый Менеджер" });

  const membership = mock.requests.find(
    (r) => r.method === "POST" && r.url.includes("/rest/v1/memberships")
  );
  assert.equal(membership.body.org_id, ORG_ID);
  assert.equal(membership.body.user_id, NEW_USER_ID);
  assert.equal(membership.body.role, "manager", "role comes from the invite");
  assert.equal(membership.body.department_id, DEPARTMENT_ID, "department comes from the invite");
  assert.equal(membership.body.status, "active");
  assert.equal(membership.body.invited_by, USER_ID);

  const invitePatch = mock.requests.find(
    (r) => r.method === "PATCH" && r.url.includes("/rest/v1/invites")
  );
  assert.match(decodeURIComponent(invitePatch.url), new RegExp(`id=eq\\.${INVITE_ID}`));
  assert.ok(invitePatch.body.accepted_at);
  assert.equal(invitePatch.body.accepted_by, NEW_USER_ID);

  const audit = mock.requests.find((r) => r.method === "POST" && r.url.includes("audit_log"));
  assert.equal(audit.body.action, "invite.accepted");
  assert.equal(audit.body.org_id, ORG_ID);
  assert.deepEqual(audit.body.meta, { role: "manager" });
  assert.equal(audit.init.body.includes("fake-join-pass-1"), false, "password stays out of the audit");
});

test("join: missing, used, expired and wrong-email invites are ONE generic invite_invalid", async () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  const cases = [
    { name: "unknown token", email: "new@pilot.test", overrides: {}, token: "0123456789abcdef0123456789abcdef" },
    { name: "wrong email", email: "other@pilot.test", overrides: {} },
    { name: "already used", email: "new@pilot.test", overrides: { accepted_at: "2026-08-01T00:00:00Z" } },
    { name: "expired", email: "new@pilot.test", overrides: { expires_at: past } }
  ];

  for (const c of cases) {
    const mock = createFetchMock();
    seedInvite(mock, c.overrides);
    // If the worker ever got this far, the leak would be visible below.
    mock.on("POST", "/auth/v1/admin/users", { status: 200, body: { id: NEW_USER_ID } });

    const res = await makeApi(mock).handle(
      send("POST", "/api/app/join", {
        token: c.token || INVITE_TOKEN,
        email: c.email,
        password: "fake-join-pass-1"
      })
    );
    assert.equal(res.status, 404, c.name);
    assert.deepEqual(await res.json(), { error: "invite_invalid" }, c.name);
    assert.equal(
      mock.requests.some((r) => r.url.includes("/auth/v1/admin/users")),
      false,
      `${c.name}: no auth user may be created for an invalid invite`
    );
  }
});

test("join: a short password is 400 before anything leaves the worker", async () => {
  const mock = createFetchMock();
  seedInvite(mock);
  const res = await makeApi(mock).handle(
    send("POST", "/api/app/join", { token: INVITE_TOKEN, email: "new@pilot.test", password: "short" })
  );
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "weak_password" });
  assert.equal(mock.requests.length, 0);
});

test("join: an already-registered email answers 409 with the sign-in hint", async () => {
  const mock = createFetchMock();
  seedInvite(mock);
  mock.on("POST", "/auth/v1/admin/users", { status: 422, body: { msg: "already registered" } });

  const res = await makeApi(mock).handle(
    send("POST", "/api/app/join", { token: INVITE_TOKEN, email: "new@pilot.test", password: "fake-join-pass-1" })
  );
  assert.equal(res.status, 409);
  assert.deepEqual(await res.json(), { error: "email_exists", hint: "sign_in_then_join" });
  // The invite stays spendable for the authed retry.
  assert.equal(mock.requests.some((r) => r.method === "POST" && r.url.includes("/rest/v1/memberships")), false);
  assert.equal(mock.requests.some((r) => r.method === "PATCH" && r.url.includes("/rest/v1/invites")), false);
});

// ---------------------------------------------------------------------------
// Onboarding: /join-authed (existing account joins by invite)
// ---------------------------------------------------------------------------

test("join-authed: the signed-in user joins the org their email was invited to", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  // Mixed case vs the authed owner@pilot.test — matching is case-insensitive.
  seedInvite(mock, { email: "Owner@pilot.test" });
  mock.on("POST", "/rest/v1/memberships", { status: 201 });
  mock.on("PATCH", "/rest/v1/invites", { status: 204 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });

  const res = await makeApi(mock).handle(
    send("POST", "/api/app/join-authed", { token: INVITE_TOKEN }, GOOD_TOKEN)
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, org_id: ORG_ID });

  // No account creation on this path — the user already exists.
  assert.equal(mock.requests.some((r) => r.url.includes("/auth/v1/admin/users")), false);

  const membership = mock.requests.find(
    (r) => r.method === "POST" && r.url.includes("/rest/v1/memberships")
  );
  assert.equal(membership.body.user_id, USER_ID);
  assert.equal(membership.body.role, "manager");
  assert.equal(membership.body.status, "active");

  const invitePatch = mock.requests.find(
    (r) => r.method === "PATCH" && r.url.includes("/rest/v1/invites")
  );
  assert.equal(invitePatch.body.accepted_by, USER_ID);

  const audit = mock.requests.find((r) => r.method === "POST" && r.url.includes("audit_log"));
  assert.equal(audit.body.action, "invite.accepted");
  assert.deepEqual(audit.body.meta, { role: "manager" });
});

test("join-authed: an invite for another email is the same generic invite_invalid", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedInvite(mock); // invite targets new@pilot.test, the caller is owner@pilot.test
  const res = await makeApi(mock).handle(
    send("POST", "/api/app/join-authed", { token: INVITE_TOKEN }, GOOD_TOKEN)
  );
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: "invite_invalid" });
  assert.equal(mock.requests.some((r) => r.method === "POST" && r.url.includes("/rest/v1/memberships")), false);
});

test("join-authed: a duplicate membership is 409 already_member and the invite survives", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedInvite(mock, { email: "owner@pilot.test" });
  // PostgREST answers 409 on the (org_id, user_id) unique index.
  mock.on("POST", "/rest/v1/memberships", {
    status: 409,
    body: { message: "duplicate key value violates unique constraint" }
  });

  const res = await makeApi(mock).handle(
    send("POST", "/api/app/join-authed", { token: INVITE_TOKEN }, GOOD_TOKEN)
  );
  assert.equal(res.status, 409);
  assert.deepEqual(await res.json(), { error: "already_member" });
  assert.equal(
    mock.requests.some((r) => r.method === "PATCH" && r.url.includes("/rest/v1/invites")),
    false,
    "a failed join must not burn the invite"
  );
});

// ---------------------------------------------------------------------------
// Onboarding: /register-org and POST /orgs (signup-code gated)
// ---------------------------------------------------------------------------

test("register-org: a wrong signup code is 403 and the real code never leaks", async () => {
  const mock = createFetchMock();
  const res = await makeApi(mock, ENV_SIGNUP).handle(
    send("POST", "/api/app/register-org", {
      signup_code: "wrong-guess",
      org_name: "Pilot Co",
      email: "boss@pilot.test",
      password: "fake-reg-pass-1"
    })
  );
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.deepEqual(body, { error: "bad_signup_code" });
  assert.equal(JSON.stringify(body).includes(SIGNUP_CODE), false, "expected code must never be echoed");
  assert.equal(mock.requests.length, 0, "a rejected code makes no outbound calls");
});

test("register-org: without env SIGNUP_CODE signup is closed with 503", async () => {
  const mock = createFetchMock();
  const res = await makeApi(mock, ENV).handle(
    send("POST", "/api/app/register-org", {
      signup_code: "anything",
      org_name: "Pilot Co",
      email: "boss@pilot.test",
      password: "fake-reg-pass-1"
    })
  );
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: "signup_closed" });
  assert.equal(mock.requests.length, 0);
});

test("register-org happy path: account, org, owner, checklist and both integrations", async () => {
  const mock = createFetchMock();
  mock.on("POST", "/auth/v1/signup", {
    status: 200,
    body: { user: { id: NEW_USER_ID, identities: [{ id: "i-1" }] }, session: { access_token: "sess" } }
  });
  seedOrgCreation(mock);

  const res = await makeApi(mock, ENV_SIGNUP).handle(
    send("POST", "/api/app/register-org", {
      signup_code: SIGNUP_CODE,
      org_name: "ТОВ Ромашка!!",
      email: "boss@pilot.test",
      password: "fake-reg-pass-1",
      full_name: "Директор"
    })
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, org_id: NEW_ORG_ID, email_confirmation_required: false });

  // Self-serve signups go through the PUBLIC endpoint with the publishable
  // key — the admin API would mint a CONFIRMED account for an unproven email.
  const signup = mock.requests.find((r) => r.url.includes("/auth/v1/signup"));
  assert.equal(signup.headers.apikey, PUBLISHABLE);
  assert.deepEqual(signup.body.data, { full_name: "Директор" });
  assert.equal(mock.requests.some((r) => r.url.includes("/auth/v1/admin/users")), false);

  const org = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/organizations"));
  assert.match(org.headers.prefer, /return=representation/);
  assert.equal(org.body.name, "ТОВ Ромашка!!");
  assert.equal(org.body.plan, "pilot");
  assert.equal(org.body.monthly_call_quota, 500);
  assert.equal(org.body.timezone, "Europe/Kyiv");
  assert.equal(org.body.ai_provider, "gemini");
  assert.equal(org.body.ai_key_source, "own");
  assert.equal(org.body.created_by, NEW_USER_ID);
  // Translit base + mandatory 6-hex suffix, valid against the DB check regex.
  assert.match(org.body.slug, /^tov-romashka-[0-9a-f]{6}$/);
  assert.match(org.body.slug, /^[a-z0-9-]+-[0-9a-f]{6}$/);
  assert.match(org.body.slug, /^[a-z0-9][a-z0-9-]{1,48}$/);

  const membership = mock.requests.find(
    (r) => r.method === "POST" && r.url.includes("/rest/v1/memberships")
  );
  assert.equal(membership.body.org_id, NEW_ORG_ID);
  assert.equal(membership.body.user_id, NEW_USER_ID);
  assert.equal(membership.body.role, "owner");
  assert.equal(membership.body.full_name, "Директор");
  assert.equal(membership.body.status, "active");

  const checklist = mock.requests.find(
    (r) => r.method === "POST" && r.url.includes("/rest/v1/checklists")
  );
  assert.equal(checklist.body.name, "Базовый чек-лист");
  assert.equal(checklist.body.is_default, true);
  assert.equal(checklist.body.items.length, 7, "the 7 items from 0002_onboarding.sql");
  assert.deepEqual(checklist.body.items.map((i) => i.key), [
    "greeting", "needs", "qualification", "pitch", "objections", "next_step", "tone"
  ]);
  assert.equal(checklist.body.items.reduce((sum, i) => sum + i.weight, 0), 100);

  const integrations = mock.requests.find(
    (r) => r.method === "POST" && r.url.includes("/rest/v1/integrations")
  );
  assert.match(integrations.headers.prefer, /ignore-duplicates/);
  assert.match(decodeURIComponent(integrations.url), /on_conflict=org_id,kind/);
  assert.equal(integrations.body.length, 5);
  assert.deepEqual(
    integrations.body.map((row) => row.kind).sort(),
    ["binotel", "phonet", "ringostat", "streamtele", "unitalk"]
  );
  for (const row of integrations.body) {
    assert.equal(row.org_id, NEW_ORG_ID);
    assert.equal(row.enabled, true);
    // Explicit 24-byte token — the DB default only fires on an absent column.
    assert.match(row.webhook_token, /^[0-9a-f]{48}$/);
  }
  assert.notEqual(integrations.body[0].webhook_token, integrations.body[1].webhook_token);

  const audit = mock.requests.find((r) => r.method === "POST" && r.url.includes("audit_log"));
  assert.equal(audit.body.action, "org.created");
  assert.equal(audit.body.actor_id, NEW_USER_ID);
  assert.equal(audit.body.target, NEW_ORG_ID);
  assert.equal(audit.init.body.includes("fake-reg-pass-1"), false);
});

test("org seeding falls back to the legacy two kinds while the DB check predates 0004", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  let integrationPosts = 0;
  mock.on("POST", "/rest/v1/integrations", (record) => {
    integrationPosts += 1;
    return integrationPosts === 1
      ? { status: 400, body: { message: 'new row violates check constraint "integrations_kind_check"' } }
      : { status: 201 };
  });
  seedOrgCreation(mock);
  const res = await makeApi(mock, ENV_SIGNUP).handle(
    send("POST", "/api/app/orgs", { signup_code: SIGNUP_CODE, org_name: "Legacy DB Co" }, GOOD_TOKEN)
  );
  assert.equal(res.status, 200);
  const posts = mock.requests.filter((r) => r.method === "POST" && r.url.includes("/rest/v1/integrations"));
  assert.equal(posts.length, 2);
  assert.equal(posts[0].body.length, 5, "first try seeds all five");
  assert.deepEqual(posts[1].body.map((row) => row.kind).sort(), ["binotel", "ringostat"]);
});

test("register-org: confirmations-on signup returns the confirmation flag", async () => {
  const mock = createFetchMock();
  // No session in the reply = the project requires email confirmation.
  mock.on("POST", "/auth/v1/signup", {
    status: 200,
    body: { user: { id: NEW_USER_ID, identities: [{ id: "i-1" }] }, session: null }
  });
  seedOrgCreation(mock);
  const res = await makeApi(mock, ENV_SIGNUP).handle(
    send("POST", "/api/app/register-org", {
      signup_code: SIGNUP_CODE, org_name: "Ромашка", email: "boss@pilot.test",
      password: "fake-reg-pass-1", full_name: "Директор"
    })
  );
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.email_confirmation_required, true);
});

test("register-org: GoTrue email_address_invalid maps to bad_email, not email_exists", async () => {
  const mock = createFetchMock();
  mock.on("POST", "/auth/v1/signup", {
    status: 400,
    body: { code: 400, error_code: "email_address_invalid", msg: "Email address is invalid" }
  });
  const res = await makeApi(mock, ENV_SIGNUP).handle(
    send("POST", "/api/app/register-org", {
      signup_code: SIGNUP_CODE, org_name: "Ромашка", email: "x@invalid.test",
      password: "fake-reg-pass-1"
    })
  );
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "bad_email");
});

test("register-org: an existing email is GoTrue's empty-identities reply, no org is created", async () => {
  const mock = createFetchMock();
  mock.on("POST", "/auth/v1/signup", {
    status: 200,
    body: { user: { id: "fake-obfuscated", identities: [] }, session: null }
  });
  const res = await makeApi(mock, ENV_SIGNUP).handle(
    send("POST", "/api/app/register-org", {
      signup_code: SIGNUP_CODE, org_name: "Ромашка", email: "taken@pilot.test",
      password: "fake-reg-pass-1"
    })
  );
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, "email_exists");
  assert.equal(mock.requests.some((r) => r.url.includes("/rest/v1/organizations")), false);
});

test("register-org: a failed org bootstrap deletes the fresh account instead of squatting the email", async () => {
  const mock = createFetchMock();
  mock.on("POST", "/auth/v1/signup", {
    status: 200,
    body: { user: { id: NEW_USER_ID, identities: [{ id: "i-1" }] }, session: { access_token: "s" } }
  });
  // Org insert fails hard (not a slug 409) on every retry.
  mock.on("POST", "/rest/v1/organizations", { status: 500, body: { message: "boom" } });
  mock.on("DELETE", "/auth/v1/admin/users", { status: 200, body: {} });
  const res = await makeApi(mock, ENV_SIGNUP).handle(
    send("POST", "/api/app/register-org", {
      signup_code: SIGNUP_CODE, org_name: "Ромашка", email: "boss@pilot.test",
      password: "fake-reg-pass-1"
    })
  );
  assert.equal(res.status, 502);
  assert.equal((await res.json()).error, "org_create_failed");
  const del = mock.requests.find((r) => r.method === "DELETE" && r.url.includes("/auth/v1/admin/users"));
  assert.match(del.url, new RegExp(NEW_USER_ID));
});

test("createOrganization retries the slug on a unique violation", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  let orgPosts = 0;
  mock.on("POST", "/rest/v1/organizations", (record) => {
    orgPosts += 1;
    return orgPosts === 1
      ? { status: 409, body: { message: "duplicate key value violates unique constraint" } }
      : { status: 201, body: [{ id: NEW_ORG_ID }] };
  });
  seedOrgCreation(mock);
  const res = await makeApi(mock, ENV_SIGNUP).handle(
    send("POST", "/api/app/orgs", { signup_code: SIGNUP_CODE, org_name: "Pilot Two" }, GOOD_TOKEN)
  );
  assert.equal(res.status, 200);
  assert.equal(orgPosts, 2, "second slug attempt after the collision");
});

test("orgs POST (authed): a signed-in user creates a company with the code", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedOrgCreation(mock);

  const res = await makeApi(mock, ENV_SIGNUP).handle(
    send("POST", "/api/app/orgs", { signup_code: SIGNUP_CODE, org_name: "Pilot Two" }, GOOD_TOKEN)
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, org_id: NEW_ORG_ID });

  // The account already exists (e.g. Google): no admin user creation here.
  assert.equal(mock.requests.some((r) => r.url.includes("/auth/v1/admin/users")), false);

  const org = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/organizations"));
  assert.equal(org.body.created_by, USER_ID);
  assert.match(org.body.slug, /^pilot-two-[0-9a-f]{6}$/);

  const membership = mock.requests.find(
    (r) => r.method === "POST" && r.url.includes("/rest/v1/memberships")
  );
  assert.equal(membership.body.user_id, USER_ID);
  assert.equal(membership.body.role, "owner");
  assert.equal(membership.body.full_name, "Артур", "owner name comes from user_metadata");
});

// ---------------------------------------------------------------------------
// Recordings: audio upload -> STT -> analysis
// ---------------------------------------------------------------------------

function recordingBody(overrides = {}) {
  return { audio_b64: AUDIO_B64, mime: "audio/mpeg", direction: "inbound", ...overrides };
}

test("recordings: a manager cannot overwrite a peer's call transcript", async () => {
  const mock = createFetchMock();
  await seedRecordings(mock, { role: "manager" });
  // The target call belongs to someone else.
  mock.on("GET", "/rest/v1/calls", {
    body: [{ id: CALL_ID, org_id: ORG_ID, manager_id: NEW_USER_ID, department_id: null, status: "analyzed" }]
  });
  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/recordings`,
      { call_id: CALL_ID, mime: "audio/mpeg", audio_b64: "QUJD" }, GOOD_TOKEN)
  );
  // Same opaque 404 as a foreign call — no ownership oracle.
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, "call_not_found");
  assert.equal(mock.requests.some((r) => r.url.includes("generativelanguage")), false);
});

test("recordings: a huge declared Content-Length is rejected before buffering", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  const req = new Request(`https://worker.test/api/app/orgs/${ORG_ID}/recordings`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": "99000000",
      authorization: `Bearer ${GOOD_TOKEN}`
    },
    body: JSON.stringify({ mime: "audio/mpeg", audio_b64: "QUJD" })
  });
  const res = await makeApi(mock).handle(req);
  assert.equal(res.status, 413);
});

test("recordings: viewers are read-only", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "viewer");
  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/recordings`, recordingBody(), GOOD_TOKEN)
  );
  assert.equal(res.status, 403);
});

test("recordings: an unsupported mime and missing audio are rejected before any read", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  const api = makeApi(mock);

  const badMime = await api.handle(
    send("POST", `/api/app/orgs/${ORG_ID}/recordings`, recordingBody({ mime: "audio/flac" }), GOOD_TOKEN)
  );
  assert.equal(badMime.status, 400);
  assert.deepEqual(await badMime.json(), { error: "bad_mime" });

  const noAudio = await api.handle(
    send("POST", `/api/app/orgs/${ORG_ID}/recordings`, recordingBody({ audio_b64: "" }), GOOD_TOKEN)
  );
  assert.equal(noAudio.status, 400);
  assert.deepEqual(await noAudio.json(), { error: "audio_required" });

  assert.equal(mock.requests.some((r) => r.url.includes("/rest/v1/organizations")), false);
});

test("recordings: the ~15MB base64 size cap answers 413 before anything is spent", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  const res = await makeApi(mock).handle(
    send(
      "POST",
      `/api/app/orgs/${ORG_ID}/recordings`,
      recordingBody({ audio_b64: "a".repeat(20_000_001) }),
      GOOD_TOKEN
    )
  );
  assert.equal(res.status, 413);
  assert.deepEqual(await res.json(), { error: "audio_too_large" });
  assert.equal(mock.requests.some((r) => r.url.includes("generativelanguage")), false);
});

test("recordings: quota reached is 429 and Gemini is never called", async () => {
  const mock = createFetchMock();
  await seedRecordings(mock, { quota: 5, usageRow: { calls_analyzed: 5, tokens_in: 0, tokens_out: 0 } });
  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/recordings`, recordingBody(), GOOD_TOKEN)
  );
  assert.equal(res.status, 429);
  assert.deepEqual(await res.json(), { error: "quota_exceeded" });
  assert.equal(mock.requests.some((r) => r.url.includes("generativelanguage")), false);
});

test("recordings happy path: one slot, STT + analysis, transcript persisted with STT tokens counted", async () => {
  const mock = createFetchMock();
  await seedRecordings(mock);
  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/recordings`, recordingBody(), GOOD_TOKEN)
  );

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.call_id, CALL_ID);
  assert.equal(body.analysis.score, 60);
  assert.equal(body.analysis.lead_quality, "unclear");

  // Two Gemini calls: STT (inline audio) first, then the analysis.
  const gemini = mock.requests.filter((r) => r.url.includes("generativelanguage"));
  assert.equal(gemini.length, 2);
  const sttParts = gemini[0].body.contents[0].parts;
  const audioPart = sttParts.find((part) => part.inlineData);
  assert.equal(audioPart.inlineData.mimeType, "audio/mpeg");
  assert.equal(audioPart.inlineData.data, AUDIO_B64);
  assert.equal(gemini[0].headers["x-goog-api-key"], GEMINI_PLAIN_KEY);

  // ONE slot, reserved BEFORE any provider spend (CAS 3 -> 4).
  const reserve = mock.requests.find(
    (r) => r.method === "PATCH" && r.url.includes("/rest/v1/usage_counters")
  );
  assert.equal(reserve.body.calls_analyzed, 4);
  assert.ok(
    mock.requests.indexOf(reserve) < mock.requests.indexOf(gemini[0]),
    "slot must be reserved before STT runs"
  );

  // A fresh call row: source upload, minted external id, transcribed status.
  const callInsert = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/calls"));
  assert.match(callInsert.headers.prefer, /return=representation/);
  assert.equal(callInsert.body.source, "upload");
  assert.match(callInsert.body.external_id, /^upload-[0-9a-f-]{36}$/);
  assert.equal(callInsert.body.direction, "inbound");
  assert.equal(callInsert.body.status, "transcribed");
  assert.equal(callInsert.body.manager_id, null, "no manager picked = unassigned");

  // The transcript row is an upsert keyed on call_id, provider gemini-audio.
  const transcript = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/transcripts"));
  assert.match(decodeURIComponent(transcript.url), /on_conflict=call_id/);
  assert.match(transcript.headers.prefer, /merge-duplicates/);
  assert.equal(transcript.body.call_id, CALL_ID);
  assert.equal(transcript.body.text, STT_TEXT);
  assert.equal(transcript.body.lang, "ru");
  assert.equal(transcript.body.provider, "gemini-audio");

  // The analysis row counts analysis tokens; usage counts STT + analysis.
  const analysis = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/analyses"));
  assert.equal(analysis.body.score, 60);
  assert.equal(analysis.body.tokens_in, 900);
  assert.equal(analysis.body.tokens_out, 210);

  const usagePatches = mock.requests.filter(
    (r) => r.method === "PATCH" && r.url.includes("/rest/v1/usage_counters")
  );
  const tokens = usagePatches[usagePatches.length - 1].body;
  assert.equal(tokens.calls_analyzed, 3, "the single reserved slot stays consumed");
  assert.equal(tokens.tokens_in, 10 + 900 + 5000, "STT tokens are billed too");
  assert.equal(tokens.tokens_out, 10 + 210 + 300);

  const callPatch = mock.requests.find((r) => r.method === "PATCH" && r.url.includes("/rest/v1/calls"));
  assert.equal(callPatch.body.status, "analyzed");

  // The raw audio never lands in the database.
  for (const r of mock.requests) {
    if (r.url.includes("/rest/v1/")) {
      assert.equal(String(r.init.body || "").includes(AUDIO_B64), false, `audio leaked to ${r.url}`);
    }
  }
});

test("recordings: a manager always uploads for themself, whatever manager_id says", async () => {
  const mock = createFetchMock();
  await seedRecordings(mock, { role: "manager" });
  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/recordings`, recordingBody({ manager_id: NEW_USER_ID }), GOOD_TOKEN)
  );
  assert.equal(res.status, 200);
  const callInsert = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/calls"));
  assert.equal(callInsert.body.manager_id, USER_ID);
  assert.equal(callInsert.body.manager_label, "Тест");
});

test("recordings: owner assigns a member; the member's department rides along", async () => {
  const mock = createFetchMock();
  mock.on("GET", "/rest/v1/memberships", (record) => {
    if (record.url.includes(`user_id=eq.${USER_ID}`)) {
      return { body: [{ id: "m-1", user_id: USER_ID, role: "owner", full_name: "Тест", extension: null, department_id: null }] };
    }
    if (record.url.includes(`user_id=eq.${NEW_USER_ID}`)) {
      return { body: [{ user_id: NEW_USER_ID, role: "manager", full_name: "Петро Коваль", department_id: DEPARTMENT_ID }] };
    }
    return { body: [] };
  });
  await seedRecordings(mock);
  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/recordings`, recordingBody({ manager_id: NEW_USER_ID }), GOOD_TOKEN)
  );
  assert.equal(res.status, 200);
  const callInsert = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/calls"));
  assert.equal(callInsert.body.manager_id, NEW_USER_ID);
  assert.equal(callInsert.body.manager_label, "Петро Коваль");
  assert.equal(callInsert.body.department_id, DEPARTMENT_ID);
});

test("recordings: a lead cannot assign a manager outside their department", async () => {
  const mock = createFetchMock();
  mock.on("GET", "/rest/v1/memberships", (record) => {
    if (record.url.includes(`user_id=eq.${USER_ID}`)) {
      return { body: [{ id: "m-1", user_id: USER_ID, role: "lead", full_name: "Лід", extension: null, department_id: null }] };
    }
    if (record.url.includes(`user_id=eq.${NEW_USER_ID}`)) {
      return { body: [{ user_id: NEW_USER_ID, role: "manager", full_name: "Петро Коваль", department_id: DEPARTMENT_ID }] };
    }
    return { body: [] };
  });
  await seedRecordings(mock);
  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/recordings`, recordingBody({ manager_id: NEW_USER_ID }), GOOD_TOKEN)
  );
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "bad_manager_id" });
  assert.equal(mock.requests.some((r) => r.url.includes("generativelanguage")), false);
});

test("recordings: STT failure marks the call failed, refunds the slot, saves nothing", async () => {
  const mock = createFetchMock();
  await seedRecordings(mock, { stt: { status: 500, body: { error: { message: "stt boom" } } } });
  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/recordings`, recordingBody({ call_id: CALL_ID }), GOOD_TOKEN)
  );

  assert.equal(res.status, 502);
  const body = await res.json();
  assert.equal(body.error, "transcription_failed");
  assert.match(body.detail, /gemini_http_500/);

  assert.equal(mock.requests.filter((r) => r.url.includes("generativelanguage")).length, 1);
  assert.equal(mock.requests.some((r) => r.method === "POST" && r.url.includes("/rest/v1/transcripts")), false);
  assert.equal(mock.requests.some((r) => r.method === "POST" && r.url.includes("/rest/v1/analyses")), false);

  const callPatch = mock.requests.find((r) => r.method === "PATCH" && r.url.includes("/rest/v1/calls"));
  assert.equal(callPatch.body.status, "failed");

  // Reserved (3 -> 4), then refunded (re-read 3 -> 2): the failed upload is free.
  const patches = mock.requests.filter(
    (r) => r.method === "PATCH" && r.url.includes("/rest/v1/usage_counters")
  );
  assert.equal(patches[0].body.calls_analyzed, 4);
  assert.equal(patches[patches.length - 1].body.calls_analyzed, 2);

  const audit = mock.requests.find((r) => r.method === "POST" && r.url.includes("audit_log"));
  assert.equal(audit.body.action, "call.transcribe_failed");
});

test("recordings: analysis failure KEEPS the transcript so a retry pays no second STT", async () => {
  const mock = createFetchMock();
  await seedRecordings(mock, { analysis: { status: 500, body: { error: { message: "llm boom" } } } });
  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/recordings`, recordingBody(), GOOD_TOKEN)
  );

  assert.equal(res.status, 502);
  assert.equal((await res.json()).error, "analysis_failed");

  // The transcript row landed before the analysis stage ran.
  const transcript = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/transcripts"));
  assert.equal(transcript.body.text, STT_TEXT);

  // The call stays `transcribed` (NOT failed) — plain /analyze can retry it.
  const callPatch = mock.requests.find((r) => r.method === "PATCH" && r.url.includes("/rest/v1/calls"));
  assert.equal(callPatch.body.status, "transcribed");
  assert.match(callPatch.body.error, /gemini_http_500/);

  // Slot refunded, but the STT tokens that were genuinely spent stay counted.
  const patches = mock.requests.filter(
    (r) => r.method === "PATCH" && r.url.includes("/rest/v1/usage_counters")
  );
  const refund = patches[patches.length - 1].body;
  assert.equal(refund.calls_analyzed, 2);
  assert.equal(refund.tokens_in, 10 + 5000);
  assert.equal(refund.tokens_out, 10 + 300);
});

// ---------------------------------------------------------------------------
// Integration credentials
// ---------------------------------------------------------------------------

test("credentials PUT: owner only, kind must exist in the provider manifest", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "admin");
  const admin = await makeApi(mock).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/integrations/binotel/credentials`, { fields: { apiKey: "x" } }, GOOD_TOKEN)
  );
  assert.equal(admin.status, 403);

  const mock2 = createFetchMock();
  seedAuth(mock2);
  seedMembership(mock2, "owner");
  const unknown = await makeApi(mock2).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/integrations/asterisk/credentials`, { fields: { apiKey: "x" } }, GOOD_TOKEN)
  );
  assert.equal(unknown.status, 404);
  assert.deepEqual(await unknown.json(), { error: "unknown_kind" });
  assert.equal(mock2.requests.some((r) => r.url.includes("integration_secrets")), false);
});

test("credentials PUT: no integrations row for that kind yet is 404", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  // `phonet` passing kind validation proves the PROVIDERS manifest is wired in.
  mock.on("GET", "/rest/v1/integrations", { body: [] });
  const res = await makeApi(mock).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/integrations/phonet/credentials`, { fields: { apiKey: "x" } }, GOOD_TOKEN)
  );
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: "integration_not_found" });
});

test("credentials PUT: values are encrypted, audited by NAME only, never echoed", async () => {
  const SECRET_VALUE = "fake-binotel-secret-000"; // synthetic
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("GET", "/rest/v1/integrations", { body: [{ id: INTEGRATION_ID }] });
  mock.on("POST", "/rest/v1/integration_secrets", { status: 201 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });

  const res = await makeApi(mock).handle(
    send(
      "PUT",
      `/api/app/orgs/${ORG_ID}/integrations/binotel/credentials`,
      { fields: { apiKey: "fake-binotel-key-000", apiSecret: SECRET_VALUE } },
      GOOD_TOKEN
    )
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, field_names: ["apiKey", "apiSecret"] });

  const upsert = mock.requests.find((r) => r.method === "POST" && r.url.includes("integration_secrets"));
  assert.match(decodeURIComponent(upsert.url), /on_conflict=integration_id/);
  assert.match(upsert.headers.prefer, /merge-duplicates/);
  assert.equal(upsert.body.integration_id, INTEGRATION_ID);
  assert.equal(upsert.body.org_id, ORG_ID);
  assert.match(upsert.body.secret_ciphertext, /^v1\./);
  assert.equal(upsert.init.body.includes(SECRET_VALUE), false, "plaintext must never reach PostgREST");

  const audit = mock.requests.find((r) => r.method === "POST" && r.url.includes("audit_log"));
  assert.equal(audit.body.action, "integration.credentials_set");
  assert.deepEqual(audit.body.meta, { kind: "binotel", fields: ["apiKey", "apiSecret"] });
  assert.equal(audit.init.body.includes(SECRET_VALUE), false);
});

test("credentials PUT: malformed fields are rejected before touching the DB", async () => {
  const cases = [
    { fields: null },
    { fields: {} },
    { fields: { apiKey: 42 } },
    { fields: { "bad key!": "x" } },
    { fields: { apiKey: "x".repeat(501) } },
    {}
  ];
  for (const body of cases) {
    const mock = createFetchMock();
    seedAuth(mock);
    seedMembership(mock, "owner");
    const res = await makeApi(mock).handle(
      send("PUT", `/api/app/orgs/${ORG_ID}/integrations/binotel/credentials`, body, GOOD_TOKEN)
    );
    assert.equal(res.status, 400, JSON.stringify(body).slice(0, 60));
    assert.equal(mock.requests.some((r) => r.url.includes("/rest/v1/integrations")), false);
  }
});

test("credentials GET: configured -> field names only, never a value", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "admin");
  mock.on("GET", "/rest/v1/integrations", { body: [{ id: INTEGRATION_ID }] });
  mock.on("GET", "/rest/v1/integration_secrets", {
    body: [{
      secret_ciphertext: await encryptSecret(
        JSON.stringify({ apiKey: "fake-key-value-000", apiSecret: "fake-secret-value-000" }),
        MASTER_KEY
      )
    }]
  });

  const res = await makeApi(mock).handle(
    get(`/api/app/orgs/${ORG_ID}/integrations/binotel/credentials`, GOOD_TOKEN)
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body, { configured: true, field_names: ["apiKey", "apiSecret"] });
  assert.equal(JSON.stringify(body).includes("fake-key-value-000"), false);
  assert.equal(JSON.stringify(body).includes("fake-secret-value-000"), false);
});

test("credentials GET: not configured yet", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("GET", "/rest/v1/integrations", { body: [{ id: INTEGRATION_ID }] });
  mock.on("GET", "/rest/v1/integration_secrets", { body: [] });
  const res = await makeApi(mock).handle(
    get(`/api/app/orgs/${ORG_ID}/integrations/ringostat/credentials`, GOOD_TOKEN)
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { configured: false, field_names: [] });
});

// ---------------------------------------------------------------------------
// Telegram recipients
// ---------------------------------------------------------------------------

test("telegram GET: owner/admin only", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "manager");
  const res = await makeApi(mock).handle(get(`/api/app/orgs/${ORG_ID}/telegram`, GOOD_TOKEN));
  assert.equal(res.status, 403);
});

test("telegram GET: rows come back; a missing table is 503 migration_required", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  const rows = [
    { id: "tr-1", chat_id: "-100777888999", kind: "per_call", label: "РОП", created_at: "2026-08-14T00:00:00Z" }
  ];
  mock.on("GET", "/rest/v1/telegram_recipients", { body: rows });
  const ok = await makeApi(mock).handle(get(`/api/app/orgs/${ORG_ID}/telegram`, GOOD_TOKEN));
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { recipients: rows });

  const mock2 = createFetchMock();
  seedAuth(mock2);
  seedMembership(mock2, "owner");
  mock2.on("GET", "/rest/v1/telegram_recipients", {
    status: 404,
    body: { code: "PGRST205", message: "Could not find the table 'public.telegram_recipients'" }
  });
  const missing = await makeApi(mock2).handle(get(`/api/app/orgs/${ORG_ID}/telegram`, GOOD_TOKEN));
  assert.equal(missing.status, 503);
  assert.deepEqual(await missing.json(), { error: "migration_required" });
});

test("telegram PUT replaces the whole set: delete first, then insert", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "admin");
  mock.on("DELETE", "/rest/v1/telegram_recipients", { status: 204 });
  mock.on("POST", "/rest/v1/telegram_recipients", { status: 201 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });

  const res = await makeApi(mock).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/telegram`, {
      recipients: [
        { chat_id: "-100777888999", kind: "per_call", label: "РОП" },
        { chat_id: "987654321", kind: "daily" }
      ]
    }, GOOD_TOKEN)
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, count: 2 });

  const del = mock.requests.find((r) => r.method === "DELETE" && r.url.includes("telegram_recipients"));
  const insert = mock.requests.find((r) => r.method === "POST" && r.url.includes("telegram_recipients"));
  assert.match(decodeURIComponent(del.url), new RegExp(`org_id=eq\\.${ORG_ID}`));
  assert.ok(mock.requests.indexOf(del) < mock.requests.indexOf(insert), "replace = delete before insert");
  assert.deepEqual(insert.body, [
    { org_id: ORG_ID, chat_id: "-100777888999", kind: "per_call", label: "РОП" },
    { org_id: ORG_ID, chat_id: "987654321", kind: "daily", label: null }
  ]);
});

test("telegram PUT: chat_id regex, kind whitelist and the 10-row cap are enforced", async () => {
  const cases = [
    { body: { recipients: [{ chat_id: "abc", kind: "daily" }] }, error: "bad_chat_id" },
    { body: { recipients: [{ chat_id: "1234", kind: "daily" }] }, error: "bad_chat_id" },
    { body: { recipients: [{ chat_id: "@channel", kind: "daily" }] }, error: "bad_chat_id" },
    { body: { recipients: [{ chat_id: "123456789", kind: "weekly" }] }, error: "bad_kind" },
    {
      body: { recipients: Array.from({ length: 11 }, () => ({ chat_id: "123456789", kind: "daily" })) },
      error: "too_many_recipients"
    },
    { body: { recipients: "nope" }, error: "bad_recipients" }
  ];
  for (const c of cases) {
    const mock = createFetchMock();
    seedAuth(mock);
    seedMembership(mock, "owner");
    const res = await makeApi(mock).handle(
      send("PUT", `/api/app/orgs/${ORG_ID}/telegram`, c.body, GOOD_TOKEN)
    );
    assert.equal(res.status, 400, c.error);
    assert.deepEqual(await res.json(), { error: c.error });
    assert.equal(mock.requests.some((r) => r.url.includes("telegram_recipients")), false);
  }
});

test("telegram PUT: a missing table is 503 migration_required", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("DELETE", "/rest/v1/telegram_recipients", { status: 404, body: { code: "PGRST205" } });
  const res = await makeApi(mock).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/telegram`, {
      recipients: [{ chat_id: "123456789", kind: "daily" }]
    }, GOOD_TOKEN)
  );
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: "migration_required" });
});

// ---------------------------------------------------------------------------
// Per-call Telegram notifications
// ---------------------------------------------------------------------------

test("analyze: per_call recipients get a transcript-free summary", async () => {
  const mock = createFetchMock();
  await seedAnalyze(mock);
  mock.on("GET", "/rest/v1/telegram_recipients", { body: [{ chat_id: "-100777888999" }] });
  mock.on("POST", "api.telegram.org", { status: 200, body: { ok: true } });

  const res = await makeApi(mock, ENV_TG).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/analyze`, { call_id: CALL_ID }, GOOD_TOKEN)
  );
  assert.equal(res.status, 200);

  const recipientsRead = mock.requests.find((r) => r.url.includes("telegram_recipients"));
  assert.match(decodeURIComponent(recipientsRead.url), /kind=eq\.per_call/);

  const tg = mock.requests.find((r) => r.url.includes("api.telegram.org"));
  assert.ok(tg, "sendMessage must be called");
  assert.match(tg.url, /\/sendMessage$/);
  assert.equal(tg.body.chat_id, "-100777888999");
  assert.match(tg.body.text, /Pilot Co/);
  assert.match(tg.body.text, /Іван Іванов/);
  assert.match(tg.body.text, /60\/100/);
  // Privacy: not a word of the conversation leaves the org's database.
  assert.equal(tg.body.text.includes("тарифы"), false);
  assert.equal(tg.body.text.includes(TRANSCRIPT), false);

  // The bot token goes to Telegram only — never into the database.
  for (const r of mock.requests) {
    if (r.url.includes("api.telegram.org")) continue;
    assert.equal(r.url.includes("fake-tg-bot-token"), false);
    assert.equal(String(r.init.body || "").includes("fake-tg-bot-token"), false);
  }
});

test("analyze: a missing telegram table (or absent token) never breaks the analysis", async () => {
  const mock = createFetchMock();
  await seedAnalyze(mock);
  mock.on("GET", "/rest/v1/telegram_recipients", { status: 404, body: { code: "PGRST205" } });
  const res = await makeApi(mock, ENV_TG).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/analyze`, { call_id: CALL_ID }, GOOD_TOKEN)
  );
  assert.equal(res.status, 200);
  assert.equal(mock.requests.some((r) => r.url.includes("api.telegram.org")), false);

  // No token at all: telegram_recipients is not even read.
  const mock2 = createFetchMock();
  await seedAnalyze(mock2);
  const res2 = await makeApi(mock2, ENV).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/analyze`, { call_id: CALL_ID }, GOOD_TOKEN)
  );
  assert.equal(res2.status, 200);
  assert.equal(mock2.requests.some((r) => r.url.includes("telegram_recipients")), false);
});

test("recordings: a successful upload also pings the per_call recipients", async () => {
  const mock = createFetchMock();
  await seedRecordings(mock);
  mock.on("GET", "/rest/v1/telegram_recipients", { body: [{ chat_id: "555556666" }] });
  mock.on("POST", "api.telegram.org", { status: 200, body: { ok: true } });
  const res = await makeApi(mock, ENV_TG).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/recordings`, recordingBody(), GOOD_TOKEN)
  );
  assert.equal(res.status, 200);
  const tg = mock.requests.find((r) => r.url.includes("api.telegram.org"));
  assert.equal(tg.body.chat_id, "555556666");
  assert.equal(tg.body.text.includes(STT_TEXT), false, "no transcript in the ping");
});

// ---------------------------------------------------------------------------
// Org settings (avg_deal_amount — migration 0004)
// ---------------------------------------------------------------------------

test("org-settings PUT: owner only", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "admin");
  const res = await makeApi(mock).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/org-settings`, { avg_deal_amount: 1000 }, GOOD_TOKEN)
  );
  assert.equal(res.status, 403);
});

test("org-settings PUT: stores a number, clears with null, rejects garbage", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("PATCH", "/rest/v1/organizations", { status: 204 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });
  const api = makeApi(mock);

  const set = await api.handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/org-settings`, { avg_deal_amount: 25000 }, GOOD_TOKEN)
  );
  assert.equal(set.status, 200);
  const patch = mock.requests.find((r) => r.method === "PATCH" && r.url.includes("organizations"));
  assert.deepEqual(patch.body, { avg_deal_amount: 25000 });

  const clear = await api.handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/org-settings`, { avg_deal_amount: null }, GOOD_TOKEN)
  );
  assert.equal(clear.status, 200);
  const patches = mock.requests.filter((r) => r.method === "PATCH" && r.url.includes("organizations"));
  assert.deepEqual(patches[patches.length - 1].body, { avg_deal_amount: null });

  // NaN is absent on purpose: JSON cannot express it (it serializes to null).
  for (const bad of ["25000", -1, 1e13]) {
    const res = await api.handle(
      send("PUT", `/api/app/orgs/${ORG_ID}/org-settings`, { avg_deal_amount: bad }, GOOD_TOKEN)
    );
    assert.equal(res.status, 400, String(bad));
  }
});

test("org-settings PUT: a pre-0004 database answers 503 migration_required", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("PATCH", "/rest/v1/organizations", {
    status: 400,
    body: { code: "PGRST204", message: "Could not find the 'avg_deal_amount' column of 'organizations'" }
  });
  const res = await makeApi(mock).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/org-settings`, { avg_deal_amount: 25000 }, GOOD_TOKEN)
  );
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: "migration_required" });
});

test("org-settings PUT: ui_language is settable and validated (was read-only before)", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("PATCH", "/rest/v1/organizations", { status: 204 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });
  const ok = await makeApi(mock).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/org-settings`, { ui_language: "en" }, GOOD_TOKEN)
  );
  assert.equal(ok.status, 200);
  const patch = mock.requests.find((r) => r.method === "PATCH" && r.url.includes("/rest/v1/organizations"));
  assert.deepEqual(patch.body, { ui_language: "en" });

  // both fields at once are allowed
  const both = createFetchMock();
  seedAuth(both);
  seedMembership(both, "owner");
  both.on("PATCH", "/rest/v1/organizations", { status: 204 });
  both.on("POST", "/rest/v1/audit_log", { status: 201 });
  const res2 = await makeApi(both).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/org-settings`, { avg_deal_amount: 1000, ui_language: "ru" }, GOOD_TOKEN)
  );
  assert.equal(res2.status, 200);
  const p2 = both.requests.find((r) => r.method === "PATCH" && r.url.includes("/rest/v1/organizations"));
  assert.deepEqual(p2.body, { avg_deal_amount: 1000, ui_language: "ru" });

  // an unsupported language is rejected
  const bad = createFetchMock();
  seedAuth(bad);
  seedMembership(bad, "owner");
  const res3 = await makeApi(bad).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/org-settings`, { ui_language: "de" }, GOOD_TOKEN)
  );
  assert.equal(res3.status, 400);
  assert.equal((await res3.json()).error, "bad_ui_language");
});

test("/me merges avg_deal_amount and ui_language from the defensive second query", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  mock.on("GET", "/rest/v1/memberships", {
    body: [{
      org_id: ORG_ID,
      role: "owner",
      extension: null,
      full_name: "Артур",
      department_id: null,
      organization: { id: ORG_ID, name: "Pilot Co", slug: "pilot-co", plan: "pilot" }
    }]
  });
  mock.on("GET", "/rest/v1/organizations", {
    body: [{ id: ORG_ID, avg_deal_amount: 50000, ui_language: "uk" }]
  });

  const res = await makeApi(mock).handle(get("/api/app/me", GOOD_TOKEN));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.memberships[0].organization.avg_deal_amount, 50000);
  assert.equal(body.memberships[0].organization.ui_language, "uk");

  // The extras ride a SEPARATE organizations query (a missing column inside
  // the embedded select would fail the whole /me read).
  const extras = mock.requests.find((r) => r.url.includes("/rest/v1/organizations"));
  const query = decodeURIComponent(extras.url);
  assert.match(query, /select=id,avg_deal_amount,ui_language/);
  assert.match(query, new RegExp(`id=in\\.\\(${ORG_ID}\\)`));
});

test("/me on a pre-0004 database: extras query fails, /me still answers", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  mock.on("GET", "/rest/v1/memberships", {
    body: [{
      org_id: ORG_ID,
      role: "owner",
      extension: null,
      full_name: "Артур",
      department_id: null,
      organization: { id: ORG_ID, name: "Pilot Co", slug: "pilot-co", plan: "pilot" }
    }]
  });
  mock.on("GET", "/rest/v1/organizations", {
    status: 400,
    body: { code: "42703", message: "column organizations.avg_deal_amount does not exist" }
  });

  const res = await makeApi(mock).handle(get("/api/app/me", GOOD_TOKEN));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.memberships[0].organization.slug, "pilot-co");
  assert.equal("avg_deal_amount" in body.memberships[0].organization, false);
});

// ---------------------------------------------------------------------------
// Daily digest (cron)
// ---------------------------------------------------------------------------

test("dailyDigest: no-op without the bot token or without the table", async () => {
  const mock = createFetchMock();
  await dailyDigest(ENV, mock); // no TELEGRAM_BOT_TOKEN
  assert.equal(mock.requests.length, 0);

  const mock2 = createFetchMock();
  mock2.on("GET", "/rest/v1/telegram_recipients", { status: 404, body: { code: "PGRST205" } });
  await dailyDigest(ENV_TG, mock2); // table not migrated yet
  assert.equal(mock2.requests.some((r) => r.url.includes("api.telegram.org")), false);
});

test("dailyDigest: yesterday's UTC window, stats and the manager top-3", async () => {
  const mock = createFetchMock();
  mock.on("GET", "/rest/v1/telegram_recipients", {
    body: [
      { org_id: ORG_ID, chat_id: "111112222" },
      { org_id: ORG_ID, chat_id: "333334444" }
    ]
  });
  mock.on("GET", "/rest/v1/organizations", { body: [{ id: ORG_ID, name: "Pilot Co" }] });
  mock.on("GET", "/rest/v1/analyses", {
    body: [
      { score: 80, call_id: "c-1", call: { manager_label: "Іван" } },
      { score: 40, call_id: "c-2", call: { manager_label: "Петро" } },
      { score: 60, call_id: "c-3", call: { manager_label: "Іван" } }
    ]
  });
  mock.on("POST", "api.telegram.org", { status: 200, body: { ok: true } });

  await dailyDigest(ENV_TG, mock);

  // Yesterday as a whole UTC day.
  const now = new Date();
  const endMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const analysesQuery = decodeURIComponent(
    mock.requests.find((r) => r.url.includes("/rest/v1/analyses")).url
  );
  assert.match(analysesQuery, new RegExp(`org_id=eq\\.${ORG_ID}`));
  assert.ok(analysesQuery.includes(`created_at=gte.${new Date(endMs - 86_400_000).toISOString()}`));
  assert.ok(analysesQuery.includes(`created_at=lt.${new Date(endMs).toISOString()}`));

  const sends = mock.requests.filter((r) => r.url.includes("api.telegram.org"));
  assert.equal(sends.length, 2, "every daily recipient gets the digest");
  assert.deepEqual(sends.map((r) => r.body.chat_id).sort(), ["111112222", "333334444"]);

  const text = sends[0].body.text;
  assert.match(text, /Pilot Co/);
  assert.match(text, /Проанализировано: 3/);
  assert.match(text, /Средний балл: 60\/100/);
  assert.match(text, /Лучший звонок: 80\/100 — Іван/);
  assert.match(text, /Худший звонок: 40\/100 — Петро/);
  assert.match(text, /1\. Іван — 70\/100 \(2 зв\.\)/);
  assert.match(text, /2\. Петро — 40\/100 \(1 зв\.\)/);
});

test("dailyDigest: an org with zero analyzed calls still gets an honest digest", async () => {
  const mock = createFetchMock();
  mock.on("GET", "/rest/v1/telegram_recipients", { body: [{ org_id: ORG_ID, chat_id: "111112222" }] });
  mock.on("GET", "/rest/v1/organizations", { body: [{ id: ORG_ID, name: "Pilot Co" }] });
  mock.on("GET", "/rest/v1/analyses", { body: [] });
  mock.on("POST", "api.telegram.org", { status: 200, body: { ok: true } });

  await dailyDigest(ENV_TG, mock);
  const tg = mock.requests.find((r) => r.url.includes("api.telegram.org"));
  assert.match(tg.body.text, /не было/);
});

// ---------------------------------------------------------------------------
// Webhook-token rotation
// ---------------------------------------------------------------------------

test("rotate-token: owner mints a fresh token, keeps enabled, returns the path", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("GET", "/rest/v1/integrations", { body: [{ id: INTEGRATION_ID, enabled: true }] });
  mock.on("PATCH", "/rest/v1/integrations", { status: 204 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });

  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/integrations/ringostat/rotate-token`, {}, GOOD_TOKEN)
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.match(body.webhook_token, /^[a-f0-9]{48}$/); // 24 bytes hex
  assert.equal(body.webhook_path, `/api/telephony/ringostat/${body.webhook_token}`);

  // PATCH writes only the token — the enabled flag is untouched.
  const patch = mock.requests.find((r) => r.method === "PATCH" && r.url.includes("/rest/v1/integrations"));
  assert.deepEqual(patch.body, { webhook_token: body.webhook_token });
  assert.equal("enabled" in patch.body, false);

  const audit = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/audit_log"));
  assert.equal(audit.body.action, "integration.token_rotated");
  assert.deepEqual(audit.body.meta, { kind: "ringostat" });
});

test("rotate-token: a manager and a viewer are refused (owner|admin only)", async () => {
  for (const role of ["manager", "viewer"]) {
    const mock = createFetchMock();
    seedAuth(mock);
    seedMembership(mock, role);
    const res = await makeApi(mock).handle(
      send("POST", `/api/app/orgs/${ORG_ID}/integrations/ringostat/rotate-token`, {}, GOOD_TOKEN)
    );
    assert.equal(res.status, 403);
    assert.equal(mock.requests.some((r) => r.method === "PATCH"), false);
  }
});

test("rotate-token: an unknown kind is 404 before any write", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/integrations/nope/rotate-token`, {}, GOOD_TOKEN)
  );
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: "unknown_kind" });
  // The membership IDOR guard reads memberships, but no integrations row is
  // ever touched for an unknown kind.
  assert.equal(mock.requests.some((r) => r.url.includes("/rest/v1/integrations")), false);
});

test("rotate-token: an absent integration row is created enabled", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "admin");
  mock.on("GET", "/rest/v1/integrations", { body: [] });
  mock.on("POST", "/rest/v1/integrations", { status: 201 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });

  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/integrations/phonet/rotate-token`, {}, GOOD_TOKEN)
  );
  assert.equal(res.status, 200);
  const created = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/integrations"));
  assert.equal(created.body.enabled, true);
  assert.equal(created.body.kind, "phonet");
  assert.match(created.body.webhook_token, /^[a-f0-9]{48}$/);
});

// ---------------------------------------------------------------------------
// Checklist editor
// ---------------------------------------------------------------------------

const GOOD_CHECKLIST_ITEMS = [
  { key: "greeting", label: "Приветствие", weight: 40, hint: "Назвал компанию" },
  { key: "needs", label: "Потребность", weight: 60, hint: "" }
];

test("checklists GET: any member reads the list with item_count and weight_total", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "viewer");
  mock.on("GET", "/rest/v1/checklists", {
    body: [
      { id: CHECKLIST_ID, name: "Базовый", is_default: true, items: GOOD_CHECKLIST_ITEMS, created_at: "2026-01-01T00:00:00Z" }
    ]
  });
  const res = await makeApi(mock).handle(get(`/api/app/orgs/${ORG_ID}/checklists`, GOOD_TOKEN));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), [
    { id: CHECKLIST_ID, name: "Базовый", is_default: true, item_count: 2, weight_total: 100 }
  ]);
});

test("checklists GET :id: returns the full items array", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "manager");
  mock.on("GET", "/rest/v1/checklists", {
    body: [{ id: CHECKLIST_ID, name: "Базовый", is_default: false, items: GOOD_CHECKLIST_ITEMS }]
  });
  const res = await makeApi(mock).handle(get(`/api/app/orgs/${ORG_ID}/checklists/${CHECKLIST_ID}`, GOOD_TOKEN));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.items.length, 2);
  assert.deepEqual(body.items[0], { key: "greeting", label: "Приветствие", weight: 40, hint: "Назвал компанию" });
});

test("checklists POST: owner creates a non-default checklist and gets its id", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("POST", "/rest/v1/checklists", (r) => ({ status: 201, body: [{ id: CHECKLIST_ID, ...r.body }] }));
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });

  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/checklists`, { name: "Продажи", items: GOOD_CHECKLIST_ITEMS }, GOOD_TOKEN)
  );
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { id: CHECKLIST_ID });
  const insert = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/checklists"));
  assert.equal(insert.body.is_default, false);
  assert.equal(insert.body.name, "Продажи");
});

test("checklists POST: weights that do not sum to 100 are rejected with the offending sum", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/checklists`, {
      name: "Кривой",
      items: [
        { key: "alpha", label: "A", weight: 30, hint: "" },
        { key: "beta", label: "B", weight: 30, hint: "" }
      ]
    }, GOOD_TOKEN)
  );
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "weights_must_sum_100", got: 60 });
  assert.equal(mock.requests.some((r) => r.method === "POST" && r.url.includes("/rest/v1/checklists")), false);
});

test("checklists POST: a manager and a viewer cannot write (owner|admin only)", async () => {
  for (const role of ["manager", "viewer"]) {
    const mock = createFetchMock();
    seedAuth(mock);
    seedMembership(mock, role);
    const res = await makeApi(mock).handle(
      send("POST", `/api/app/orgs/${ORG_ID}/checklists`, { name: "X", items: GOOD_CHECKLIST_ITEMS }, GOOD_TOKEN)
    );
    assert.equal(res.status, 403);
  }
});

test("checklists POST: bad keys, labels, weights and item counts are rejected", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  const api = makeApi(mock);
  const cases = [
    [{ name: "n", items: [] }, "bad_items"],
    [{ name: "n", items: [{ key: "1bad", label: "L", weight: 100, hint: "" }] }, "bad_item_key"],
    [{ name: "n", items: [{ key: "aa", label: "L", weight: 50, hint: "" }, { key: "aa", label: "L2", weight: 50, hint: "" }] }, "duplicate_item_key"],
    [{ name: "n", items: [{ key: "aa", label: "", weight: 100, hint: "" }] }, "bad_item_label"],
    [{ name: "n", items: [{ key: "aa", label: "L", weight: 50.5, hint: "" }] }, "bad_item_weight"],
    [{ name: "n", items: [{ key: "aa", label: "L", weight: 100, hint: "x".repeat(301) }] }, "bad_item_hint"],
    [{ name: "", items: GOOD_CHECKLIST_ITEMS }, "bad_name"]
  ];
  for (const [payload, expected] of cases) {
    const res = await api.handle(send("POST", `/api/app/orgs/${ORG_ID}/checklists`, payload, GOOD_TOKEN));
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, expected);
  }
});

test("checklists PUT: updates name and items, never touches is_default", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "admin");
  mock.on("GET", "/rest/v1/checklists", { body: [{ id: CHECKLIST_ID }] });
  mock.on("PATCH", "/rest/v1/checklists", { status: 204 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });

  const res = await makeApi(mock).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/checklists/${CHECKLIST_ID}`, {
      name: "Обновлён",
      items: GOOD_CHECKLIST_ITEMS,
      is_default: true // must be ignored
    }, GOOD_TOKEN)
  );
  assert.equal(res.status, 200);
  const patch = mock.requests.find((r) => r.method === "PATCH" && r.url.includes("/rest/v1/checklists"));
  assert.equal(patch.body.name, "Обновлён");
  assert.equal("is_default" in patch.body, false);
});

test("checklists PUT: the weights-sum-100 rule still applies", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("GET", "/rest/v1/checklists", { body: [{ id: CHECKLIST_ID }] });
  const res = await makeApi(mock).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/checklists/${CHECKLIST_ID}`, {
      items: [{ key: "alpha", label: "A", weight: 10, hint: "" }]
    }, GOOD_TOKEN)
  );
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "weights_must_sum_100", got: 10 });
});

test("checklists make-default clears the others FIRST, then sets this one", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("GET", "/rest/v1/checklists", { body: [{ id: CHECKLIST_ID }] });
  mock.on("PATCH", "/rest/v1/checklists", { status: 204 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });

  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/checklists/${CHECKLIST_ID}/make-default`, {}, GOOD_TOKEN)
  );
  assert.equal(res.status, 200);
  const patches = mock.requests.filter((r) => r.method === "PATCH" && r.url.includes("/rest/v1/checklists"));
  assert.equal(patches.length, 2);
  // First clears every current default, second promotes this checklist.
  assert.match(decodeURIComponent(patches[0].url), /is_default=eq\.true/);
  assert.equal(patches[0].body.is_default, false);
  assert.match(decodeURIComponent(patches[1].url), new RegExp(`id=eq\\.${CHECKLIST_ID}`));
  assert.equal(patches[1].body.is_default, true);
});

test("checklists make-default: a viewer is refused", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "viewer");
  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/checklists/${CHECKLIST_ID}/make-default`, {}, GOOD_TOKEN)
  );
  assert.equal(res.status, 403);
});

test("checklists DELETE: the default cannot be deleted", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("GET", "/rest/v1/checklists", { body: [{ id: CHECKLIST_ID, is_default: true }] });
  const res = await makeApi(mock).handle(
    send("DELETE", `/api/app/orgs/${ORG_ID}/checklists/${CHECKLIST_ID}`, undefined, GOOD_TOKEN)
  );
  assert.equal(res.status, 409);
  assert.deepEqual(await res.json(), { error: "cannot_delete_default" });
  assert.equal(mock.requests.some((r) => r.method === "DELETE"), false);
});

test("checklists DELETE: a non-default checklist is deleted", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("GET", "/rest/v1/checklists", { body: [{ id: CHECKLIST_ID, is_default: false }] });
  mock.on("DELETE", "/rest/v1/checklists", { status: 204 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });
  const res = await makeApi(mock).handle(
    send("DELETE", `/api/app/orgs/${ORG_ID}/checklists/${CHECKLIST_ID}`, undefined, GOOD_TOKEN)
  );
  assert.equal(res.status, 200);
  assert.equal(mock.requests.some((r) => r.method === "DELETE" && r.url.includes("/rest/v1/checklists")), true);
});

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

const CURRENT_PERIOD = `${new Date().toISOString().slice(0, 7)}-01`;

test("usage GET: owner sees quota, current month and a cost estimate per month", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("GET", "/rest/v1/organizations", {
    body: [{ id: ORG_ID, name: "Pilot Co", monthly_call_quota: 500, timezone: "Europe/Kyiv", ai_provider: "gemini", ai_model: null }]
  });
  mock.on("GET", "/rest/v1/usage_counters", {
    body: [
      { period: CURRENT_PERIOD, calls_analyzed: 12, tokens_in: 1_000_000, tokens_out: 500_000 },
      { period: "2026-01-01", calls_analyzed: 4, tokens_in: 0, tokens_out: 0 }
    ]
  });
  const res = await makeApi(mock).handle(get(`/api/app/orgs/${ORG_ID}/usage`, GOOD_TOKEN));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.quota, 500);
  assert.equal(body.period, CURRENT_PERIOD);
  assert.deepEqual(body.current, { calls_analyzed: 12, tokens_in: 1_000_000, tokens_out: 500_000 });
  assert.equal(body.history.length, 2);
  // 1M in * $0.10 + 0.5M out * $0.40 = 0.10 + 0.20 = 0.30
  assert.equal(body.history[0].cost_estimate, 0.3);
});

test("usage GET: a manager and a viewer are refused", async () => {
  for (const role of ["manager", "viewer"]) {
    const mock = createFetchMock();
    seedAuth(mock);
    seedMembership(mock, role);
    const res = await makeApi(mock).handle(get(`/api/app/orgs/${ORG_ID}/usage`, GOOD_TOKEN));
    assert.equal(res.status, 403);
  }
});

// ---------------------------------------------------------------------------
// Platform super-admin
// ---------------------------------------------------------------------------

const ENV_PLATFORM = { ...ENV, PLATFORM_ADMIN_IDS: `${USER_ID}, some-other-id` };

test("platform: a non-listed user is 403 on every platform route", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  const env = { ...ENV, PLATFORM_ADMIN_IDS: "someone-else-entirely" };
  const res = await makeApi(mock, env).handle(get("/api/app/platform/stats", GOOD_TOKEN));
  assert.equal(res.status, 403);
  assert.equal(mock.requests.some((r) => r.url.includes("/rest/v1/")), false);
});

test("platform: an empty PLATFORM_ADMIN_IDS grants nobody (fail closed)", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  const res = await makeApi(mock, ENV).handle(get("/api/app/platform/stats", GOOD_TOKEN));
  assert.equal(res.status, 403);
});

test("platform stats: exact totals plus bounded distinct/sum aggregates", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  mock.on("GET", "/rest/v1/organizations", { status: 206, headers: { "content-range": "0-0/5" }, body: [] });
  mock.on("GET", "/rest/v1/analyses", { status: 206, headers: { "content-range": "0-0/30" }, body: [] });
  // calls serves BOTH the exact count (header) and the 7-day distinct scan (body).
  mock.on("GET", "/rest/v1/calls", {
    status: 206,
    headers: { "content-range": "0-0/40" },
    body: [{ org_id: ORG_ID }, { org_id: NEW_ORG_ID }]
  });
  mock.on("GET", "/rest/v1/memberships", (r) =>
    r.url.includes("select=user_id")
      ? { body: [{ user_id: USER_ID }, { user_id: USER_ID }, { user_id: NEW_USER_ID }] }
      : { body: [] }
  );
  mock.on("GET", "/rest/v1/usage_counters", {
    body: [{ tokens_in: 1000, tokens_out: 500 }, { tokens_in: 200, tokens_out: 100 }]
  });

  const res = await makeApi(mock, ENV_PLATFORM).handle(get("/api/app/platform/stats", GOOD_TOKEN));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    orgs: 5, users: 2, calls: 40, analyzed: 30, tokens: 1800, active_7d: 2
  });
});

test("platform orgs: a bounded list with per-org member/call/analyzed counts", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  mock.on("GET", "/rest/v1/organizations", {
    body: [
      { id: ORG_ID, name: "Pilot Co", slug: "pilot-co", plan: "pilot", created_at: "2026-02-01T00:00:00Z" },
      { id: NEW_ORG_ID, name: "Second", slug: "second", plan: "pilot", created_at: "2026-03-01T00:00:00Z" }
    ]
  });
  mock.on("GET", "/rest/v1/memberships", {
    body: [{ org_id: ORG_ID }, { org_id: ORG_ID }, { org_id: NEW_ORG_ID }]
  });
  mock.on("GET", "/rest/v1/calls", {
    body: [
      { org_id: ORG_ID, created_at: "2026-08-01T10:00:00Z" },
      { org_id: ORG_ID, created_at: "2026-08-05T10:00:00Z" }
    ]
  });
  mock.on("GET", "/rest/v1/analyses", { body: [{ org_id: ORG_ID }] });

  const res = await makeApi(mock, ENV_PLATFORM).handle(get("/api/app/platform/orgs", GOOD_TOKEN));
  assert.equal(res.status, 200);
  const rows = await res.json();
  const first = rows.find((r) => r.id === ORG_ID);
  assert.equal(first.members, 2);
  assert.equal(first.calls, 2);
  assert.equal(first.analyzed, 1);
  assert.equal(first.last_activity, "2026-08-05T10:00:00Z");
  const second = rows.find((r) => r.id === NEW_ORG_ID);
  assert.equal(second.members, 1);
  assert.equal(second.calls, 0);
  assert.equal(second.last_activity, null);
});

test("platform org detail: members, usage and integrations WITHOUT any secret", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  mock.on("GET", "/rest/v1/organizations", {
    body: [{ id: ORG_ID, name: "Pilot Co", slug: "pilot-co", plan: "pilot", monthly_call_quota: 500, timezone: "Europe/Kyiv", ai_provider: "gemini", ai_model: null, created_at: "2026-02-01T00:00:00Z" }]
  });
  mock.on("GET", "/rest/v1/memberships", {
    body: [{ role: "owner", full_name: "Артур", extension: "101" }]
  });
  mock.on("GET", "/rest/v1/usage_counters", {
    body: [{ period: CURRENT_PERIOD, calls_analyzed: 3, tokens_in: 10, tokens_out: 5 }]
  });
  // The mock row carries a webhook_token to prove it is stripped from the reply.
  mock.on("GET", "/rest/v1/integrations", {
    body: [{ kind: "ringostat", enabled: true, last_event_at: "2026-08-10T00:00:00Z", webhook_token: "SECRET_SHOULD_NOT_LEAK" }]
  });
  mock.on("GET", "/rest/v1/calls", {
    body: [{ id: CALL_ID, direction: "outbound", manager_label: "Иван", started_at: "2026-08-10T00:00:00Z", duration_sec: 60, status: "analyzed", created_at: "2026-08-10T00:00:00Z" }]
  });

  const res = await makeApi(mock, ENV_PLATFORM).handle(get(`/api/app/platform/orgs/${ORG_ID}`, GOOD_TOKEN));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.org.id, ORG_ID);
  assert.deepEqual(body.integrations, [{ kind: "ringostat", enabled: true, last_event_at: "2026-08-10T00:00:00Z" }]);
  assert.equal(body.members[0].full_name, "Артур");
  assert.equal(body.recent_calls.length, 1);
  // No secret material anywhere in the serialized response.
  assert.equal(JSON.stringify(body).includes("SECRET_SHOULD_NOT_LEAK"), false);
  // Never selects the transcript for the recent-calls list.
  const callsReq = mock.requests.find((r) => r.url.includes("/rest/v1/calls"));
  assert.equal(/transcript/i.test(decodeURIComponent(callsReq.url)), false);
});

test("platform org detail: a non-UUID org id is 400", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  const res = await makeApi(mock, ENV_PLATFORM).handle(get("/api/app/platform/orgs/not-a-uuid", GOOD_TOKEN));
  assert.equal(res.status, 400);
});

// ---------------------------------------------------------------------------
// /me exposes the platform-admin flag
// ---------------------------------------------------------------------------

test("/me: is_platform_admin reflects the env allow list", async () => {
  const mkMock = () => {
    const mock = createFetchMock();
    seedAuth(mock);
    mock.on("GET", "/rest/v1/memberships", { body: [] });
    return mock;
  };
  const listed = await makeApi(mkMock(), ENV_PLATFORM).handle(get("/api/app/me", GOOD_TOKEN));
  assert.equal((await listed.json()).is_platform_admin, true);

  const plain = await makeApi(mkMock(), ENV).handle(get("/api/app/me", GOOD_TOKEN));
  assert.equal((await plain.json()).is_platform_admin, false);
});

// ---------------------------------------------------------------------------
// Per-minute billing meter + billing endpoints + retention purge (migration 0005)
// ---------------------------------------------------------------------------

// One organizations route serving BOTH the plain org read (loadOrg) and the
// defensive billing read (loadOrgBilling), told apart by the select. Registered
// BEFORE seed* so it wins (routes match in registration order). `missing`
// simulates a pre-0005 database where the billing select errors.
function seedBillingOrg(mock, { rate = null, currency = "UAH", plan = "payg", retention = 90, missing = false, quota = 500 } = {}) {
  mock.on("GET", "/rest/v1/organizations", (record) => {
    const wantsBilling = record.url.includes("billing_plan") || record.url.includes("rate_per_minute");
    if (wantsBilling) {
      if (missing) {
        return { status: 400, body: { code: "PGRST204", message: "column organizations.billing_plan does not exist" } };
      }
      return { body: [{ id: ORG_ID, billing_plan: plan, rate_per_minute: rate, billing_currency: currency, retention_days: retention }] };
    }
    return { body: [{ id: ORG_ID, name: "Pilot Co", monthly_call_quota: quota, timezone: "Europe/Kyiv", ai_provider: "gemini", ai_model: null }] };
  });
}

test("meter: analyze writes ONE ceil-minutes ledger line, idempotent by call_id", async () => {
  const mock = createFetchMock();
  seedBillingOrg(mock, { rate: null, currency: "UAH" }); // FIRST -> wins for org reads
  await seedAnalyze(mock);
  mock.on("POST", "/rest/v1/usage_ledger", { status: 201 });

  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/analyze`, { call_id: CALL_ID }, GOOD_TOKEN)
  );
  assert.equal(res.status, 200);

  const ledger = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/usage_ledger"));
  assert.ok(ledger, "a ledger line was written on the analyze path");
  assert.equal(ledger.body.org_id, ORG_ID);
  assert.equal(ledger.body.call_id, CALL_ID);
  assert.equal(ledger.body.minutes, 4, "ceil(187 talk-sec / 60) = 4");
  assert.equal(ledger.body.rate, 4, "no org rate -> PLATFORM_DEFAULT_RATE");
  assert.equal(ledger.body.currency, "UAH");
  assert.equal(ledger.body.cost, 16, "4 minutes * 4/min");
  assert.match(decodeURIComponent(ledger.url), /on_conflict=call_id/);
  assert.match(String(ledger.headers.prefer || ""), /ignore-duplicates/);
});

test("meter: recordings path bills 1 minute when talk-time is unknown, at the org rate", async () => {
  const mock = createFetchMock();
  seedBillingOrg(mock, { rate: 5, currency: "USD" });
  await seedRecordings(mock);
  mock.on("POST", "/rest/v1/usage_ledger", { status: 201 });

  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/recordings`, recordingBody(), GOOD_TOKEN)
  );
  assert.equal(res.status, 200);

  const ledger = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/usage_ledger"));
  assert.ok(ledger, "a ledger line was written on the recordings path too");
  assert.equal(ledger.body.minutes, 1, "null duration -> min 1 minute");
  assert.equal(ledger.body.rate, 5, "org override rate wins over the platform default");
  assert.equal(ledger.body.currency, "USD");
  assert.equal(ledger.body.cost, 5);
});

test("meter: a missing usage_ledger table is swallowed and the analysis still succeeds", async () => {
  const mock = createFetchMock();
  seedBillingOrg(mock, { rate: null });
  await seedAnalyze(mock);
  mock.on("POST", "/rest/v1/usage_ledger", {
    status: 404,
    body: { code: "PGRST205", message: "Could not find the table 'public.usage_ledger'" }
  });

  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/analyze`, { call_id: CALL_ID }, GOOD_TOKEN)
  );
  assert.equal(res.status, 200, "a billing failure never surfaces to the customer");
  assert.equal((await res.json()).ok, true);
  assert.ok(mock.requests.some((r) => r.method === "POST" && r.url.includes("/rest/v1/analyses")), "analysis was persisted");
  assert.ok(
    mock.requests.some((r) => r.method === "POST" && r.url.includes("/rest/v1/usage_ledger")),
    "the ledger insert WAS attempted (and swallowed)"
  );
});

test("meter: pre-0005 org (billing columns absent) skips the ledger entirely", async () => {
  const mock = createFetchMock();
  seedBillingOrg(mock, { missing: true }); // billing select errors -> loadOrgBilling null
  await seedAnalyze(mock);
  // Deliberately NO usage_ledger route: nothing must POST to it.

  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/analyze`, { call_id: CALL_ID }, GOOD_TOKEN)
  );
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ok, true);
  assert.equal(
    mock.requests.some((r) => r.url.includes("/rest/v1/usage_ledger")),
    false,
    "no ledger line even attempted before migration 0005"
  );
});

test("billing GET: resolves rate/currency/plan and aggregates the ledger by month", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("GET", "/rest/v1/organizations", {
    body: [{ id: ORG_ID, billing_plan: "payg", rate_per_minute: null, billing_currency: "UAH", retention_days: 90 }]
  });
  const thisMonth = new Date().toISOString().slice(0, 7);
  mock.on("GET", "/rest/v1/usage_ledger", {
    body: [
      { minutes: 4, cost: 16, created_at: `${thisMonth}-10T10:00:00Z` },
      { minutes: 2, cost: 8, created_at: `${thisMonth}-05T09:00:00Z` },
      { minutes: 3, cost: 12, created_at: "2026-01-15T09:00:00Z" }
    ]
  });

  const res = await makeApi(mock).handle(get(`/api/app/orgs/${ORG_ID}/billing`, GOOD_TOKEN));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.plan, "payg");
  assert.equal(body.rate_per_minute, 4, "null org rate resolves to the platform default");
  assert.equal(body.currency, "UAH");
  assert.equal(body.retention_days, 90);
  assert.equal(body.current_month.minutes, 6, "4 + 2 billed this month");
  assert.equal(body.current_month.cost, 24);
  assert.equal(body.current_month.calls, 2);
  assert.equal(body.history.length, 2, "two distinct calendar months");
  assert.equal(body.history[0].period, thisMonth, "newest month first");
});

test("billing GET: 503 migration_required when the billing columns are absent", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("GET", "/rest/v1/organizations", {
    status: 400,
    body: { code: "PGRST204", message: "column organizations.billing_plan does not exist" }
  });
  const res = await makeApi(mock).handle(get(`/api/app/orgs/${ORG_ID}/billing`, GOOD_TOKEN));
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: "migration_required" });
});

test("billing GET: viewer is forbidden", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "viewer");
  const res = await makeApi(mock).handle(get(`/api/app/orgs/${ORG_ID}/billing`, GOOD_TOKEN));
  assert.equal(res.status, 403);
});

test("billing PUT: owner only, validates, and patches organizations + audit", async () => {
  const denied = createFetchMock();
  seedAuth(denied);
  seedMembership(denied, "admin"); // an admin is NOT allowed to set the price
  const forbidden = await makeApi(denied).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/billing`, { rate_per_minute: 5 }, GOOD_TOKEN)
  );
  assert.equal(forbidden.status, 403);

  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("PATCH", "/rest/v1/organizations", { status: 204 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });
  const ok = await makeApi(mock).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/billing`, { rate_per_minute: 5, retention_days: 30, plan: "custom" }, GOOD_TOKEN)
  );
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { ok: true });

  const patch = mock.requests.find((r) => r.method === "PATCH" && r.url.includes("/rest/v1/organizations"));
  assert.deepEqual(patch.body, { rate_per_minute: 5, retention_days: 30, billing_plan: "custom" });
  const audit = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/audit_log"));
  assert.equal(audit.body.action, "org.billing_updated");
});

test("billing PUT: rejects bad rate/retention/plan and an empty body", async () => {
  const bad = async (payload) => {
    const mock = createFetchMock();
    seedAuth(mock);
    seedMembership(mock, "owner");
    const res = await makeApi(mock).handle(
      send("PUT", `/api/app/orgs/${ORG_ID}/billing`, payload, GOOD_TOKEN)
    );
    return res.status;
  };
  assert.equal(await bad({ rate_per_minute: -1 }), 400);
  assert.equal(await bad({ retention_days: 0 }), 400);
  assert.equal(await bad({ retention_days: 4000 }), 400);
  assert.equal(await bad({ retention_days: 30.5 }), 400);
  assert.equal(await bad({ plan: "enterprise" }), 400);
  assert.equal(await bad({}), 400, "no recognised field");
});

test("billing PUT: 503 migration_required when the columns are absent", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("PATCH", "/rest/v1/organizations", {
    status: 400,
    body: { code: "PGRST204", message: "column organizations.rate_per_minute does not exist" }
  });
  const res = await makeApi(mock).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/billing`, { rate_per_minute: 5 }, GOOD_TOKEN)
  );
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: "migration_required" });
});

test("billing GET: the ledger is time-bounded and paginated, so a >1000-row month is not truncated", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("GET", "/rest/v1/organizations", {
    body: [{ id: ORG_ID, billing_plan: "payg", rate_per_minute: 4, billing_currency: "UAH", retention_days: 90 }]
  });
  const thisMonth = new Date().toISOString().slice(0, 7);
  // 1500 calls this month => page 0 returns a FULL 1000, page 1 returns 500.
  // A flat newest-2000 scan would still catch this, but a newest-1000 (or any
  // month past the cap) would truncate; pagination must sum all 1500.
  const row = (i) => ({ minutes: 1, cost: 4, created_at: `${thisMonth}-15T10:00:${String(i % 60).padStart(2, "0")}Z` });
  const all = Array.from({ length: 1500 }, (_, i) => row(i));
  mock.on("GET", "/rest/v1/usage_ledger", (record) => {
    const m = decodeURIComponent(record.url).match(/offset=(\d+)/);
    const offset = m ? Number(m[1]) : 0;
    return { body: all.slice(offset, offset + 1000) };
  });

  const res = await makeApi(mock).handle(get(`/api/app/orgs/${ORG_ID}/billing`, GOOD_TOKEN));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.current_month.calls, 1500, "every row in the month is counted, not just the first page");
  assert.equal(body.current_month.cost, 6000, "1500 * 4");

  // The scan is bounded to the shown 6-month window (created_at >= start).
  const work = mock.requests.find((r) => r.method === "GET" && r.url.includes("/rest/v1/usage_ledger"));
  assert.match(decodeURIComponent(work.url), /created_at=gte\./);
  // Two pages were actually fetched.
  const pages = mock.requests.filter((r) => r.method === "GET" && r.url.includes("/rest/v1/usage_ledger"));
  assert.equal(pages.length, 2, "page 0 (full) then page 1 (partial), then stop");
});

test("billing PUT: currency is settable and validated", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("PATCH", "/rest/v1/organizations", { status: 204 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });
  const ok = await makeApi(mock).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/billing`, { currency: "USD" }, GOOD_TOKEN)
  );
  assert.equal(ok.status, 200);
  const patch = mock.requests.find((r) => r.method === "PATCH" && r.url.includes("/rest/v1/organizations"));
  assert.deepEqual(patch.body, { billing_currency: "USD" });

  // a currency outside the enum is rejected
  const bad = createFetchMock();
  seedAuth(bad);
  seedMembership(bad, "owner");
  const res = await makeApi(bad).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/billing`, { currency: "GBP" }, GOOD_TOKEN)
  );
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "bad_currency");
});

test("billing PUT: a persisted change survives an audit-log outage (no false 500)", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("PATCH", "/rest/v1/organizations", { status: 204 });
  mock.on("POST", "/rest/v1/audit_log", { status: 500, body: { message: "audit down" } });
  const res = await makeApi(mock).handle(
    send("PUT", `/api/app/orgs/${ORG_ID}/billing`, { rate_per_minute: 7 }, GOOD_TOKEN)
  );
  assert.equal(res.status, 200, "the billing change already persisted; audit is best-effort");
  assert.deepEqual(await res.json(), { ok: true });
});

test("purge: blanks an old transcript, stamps redacted_at, and nulls the recording_url", async () => {
  const mock = createFetchMock();
  // Orgs are paged; each org's due rows are filtered server-side by its own
  // window. This org's worklist query is answered with one stale transcript.
  mock.on("GET", "/rest/v1/organizations", { body: [{ id: ORG_ID, retention_days: 90 }] });
  mock.on("GET", "/rest/v1/transcripts", { body: [{ id: "t-1", call_id: CALL_ID }] });
  mock.on("PATCH", "/rest/v1/transcripts", { status: 204 });
  mock.on("PATCH", "/rest/v1/calls", { status: 204 });

  await purgeExpiredData(ENV, mock);

  // Orgs are read paginated (stable order, no fixed cap).
  const orgReq = mock.requests.find((r) => r.method === "GET" && r.url.includes("/rest/v1/organizations"));
  assert.ok(orgReq, "orgs are paged");
  assert.match(decodeURIComponent(orgReq.url), /order=id\.asc/);

  // The worklist is due-filtered IN THE QUERY (created_at < window), scoped to
  // the org, un-redacted only — not filtered in JS after a shared fetch.
  const work = mock.requests.find((r) => r.method === "GET" && r.url.includes("/rest/v1/transcripts"));
  assert.match(decodeURIComponent(work.url), /redacted_at=is\.null/);
  assert.match(decodeURIComponent(work.url), /created_at=lt\./);
  assert.match(decodeURIComponent(work.url), new RegExp(`org_id=eq\\.${ORG_ID}`));

  const tPatch = mock.requests.find((r) => r.method === "PATCH" && r.url.includes("/rest/v1/transcripts"));
  assert.ok(tPatch, "the stale transcript was scrubbed");
  assert.equal(tPatch.body.text, "", "raw conversation text is blanked");
  assert.ok(tPatch.body.redacted_at, "redacted_at is stamped");
  assert.match(decodeURIComponent(tPatch.url), /redacted_at=is\.null/, "re-checks the marker so a concurrent run cannot re-scrub");
  assert.match(decodeURIComponent(tPatch.url), /id=in\.\(t-1\)/);
  assert.match(decodeURIComponent(tPatch.url), new RegExp(`org_id=eq\\.${ORG_ID}`), "PATCH stays scoped to the org");

  const cPatch = mock.requests.find((r) => r.method === "PATCH" && r.url.includes("/rest/v1/calls"));
  assert.equal(cPatch.body.recording_url, null, "recording link dropped");
  assert.match(decodeURIComponent(cPatch.url), new RegExp(`id=in\\.\\(${CALL_ID}\\)`));
});

test("purge: the due window in the query is derived from the org's retention_days", async () => {
  const mock = createFetchMock();
  mock.on("GET", "/rest/v1/organizations", { body: [{ id: ORG_ID, retention_days: 30 }] });
  mock.on("GET", "/rest/v1/transcripts", { body: [] }); // nothing due -> no writes

  await purgeExpiredData(ENV, mock);

  const work = mock.requests.find((r) => r.method === "GET" && r.url.includes("/rest/v1/transcripts"));
  const m = decodeURIComponent(work.url).match(/created_at=lt\.([^&]+)/);
  assert.ok(m, "worklist carries a created_at upper bound");
  const cutoffDaysAgo = (Date.now() - new Date(m[1]).getTime()) / 86_400_000;
  assert.ok(cutoffDaysAgo > 29 && cutoffDaysAgo < 31, `cutoff ~30d ago, got ${cutoffDaysAgo.toFixed(1)}d`);
  assert.equal(mock.requests.some((r) => r.method === "PATCH"), false, "nothing due -> no PATCH");
});

test("purge: a long-retention org cannot starve a short-retention org's due rows", async () => {
  // The regression this guards against: with a shared global worklist ordered by
  // created_at, org LONG's old-but-not-due rows could fill the batch and org
  // SHORT's genuinely-due rows would never be scrubbed. Per-org due-filtering
  // makes that impossible — each org's query returns only ITS due rows.
  const ORG_LONG = "11111111-aaaa-4aaa-8aaa-111111111111";
  const ORG_SHORT = "22222222-bbbb-4bbb-8bbb-222222222222";
  const mock = createFetchMock();
  mock.on("GET", "/rest/v1/organizations", {
    body: [
      { id: ORG_LONG, retention_days: 3650 }, // processed FIRST (id.asc), nothing due
      { id: ORG_SHORT, retention_days: 30 }
    ]
  });
  // The DB applies created_at<cutoff: LONG returns none, SHORT returns a due row.
  mock.on("GET", "/rest/v1/transcripts", (req) =>
    req.url.includes(`org_id=eq.${ORG_SHORT}`)
      ? { body: [{ id: "t-short", call_id: "c-short" }] }
      : { body: [] }
  );
  mock.on("PATCH", "/rest/v1/transcripts", { status: 204 });
  mock.on("PATCH", "/rest/v1/calls", { status: 204 });

  await purgeExpiredData(ENV, mock);

  // Both orgs were queried, and the SHORT org's due row was scrubbed despite the
  // LONG org being processed first.
  assert.ok(mock.requests.some((r) => r.method === "GET" && r.url.includes(`org_id=eq.${ORG_LONG}`)), "long org queried");
  const tPatch = mock.requests.find((r) => r.method === "PATCH" && r.url.includes("/rest/v1/transcripts"));
  assert.ok(tPatch, "the short-retention org's due row was scrubbed (no starvation)");
  assert.match(decodeURIComponent(tPatch.url), /id=in\.\(t-short\)/);
  assert.match(decodeURIComponent(tPatch.url), new RegExp(`org_id=eq\\.${ORG_SHORT}`));
});

test("purge: an already-redacted transcript is skipped (empty worklist -> no writes)", async () => {
  const mock = createFetchMock();
  mock.on("GET", "/rest/v1/organizations", { body: [{ id: ORG_ID, retention_days: 90 }] });
  // redacted_at IS NULL matched nothing — the row was scrubbed on a prior run.
  mock.on("GET", "/rest/v1/transcripts", { body: [] });

  await purgeExpiredData(ENV, mock);
  assert.equal(mock.requests.some((r) => r.method === "PATCH"), false, "nothing stale -> no PATCH");
});

test("purge: no-ops before migration 0005 (retention_days column absent)", async () => {
  const mock = createFetchMock();
  // Pre-0005 the organizations.retention_days column does not exist -> the org
  // read fails and the whole job is a swallowed no-op.
  mock.on("GET", "/rest/v1/organizations", {
    status: 400,
    body: { code: "42703", message: "column organizations.retention_days does not exist" }
  });

  await purgeExpiredData(ENV, mock);
  assert.equal(mock.requests.some((r) => r.method === "PATCH"), false, "the missing column is swallowed, nothing scrubbed");
});

// ---------------------------------------------------------------------------
// POST /calls/:id/reingest — the stuck-call recovery route (was defined but
// never wired; these prove the route dispatches to reingestCall and gates).
// ---------------------------------------------------------------------------
function reingestReq(role, callResponse) {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, role);
  if (callResponse !== undefined) {
    mock.on("GET", "/rest/v1/calls", (record) =>
      record.url.includes(`id=eq.${CALL_ID}`) ? { body: callResponse } : { body: [] }
    );
  }
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });
  return mock;
}

test("reingest: a stuck telephony call is queued and audit-logged", async () => {
  const mock = reingestReq("owner", [
    { id: CALL_ID, source: "ringostat", status: "pending", manager_id: null, department_id: null }
  ]);
  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/calls/${CALL_ID}/reingest`, {}, GOOD_TOKEN)
  );
  assert.equal(res.status, 200, "route is wired and the guarded call is accepted");
  assert.equal((await res.json()).status, "queued");
  const audit = mock.requests.find(
    (r) => r.method === "POST" && r.url.includes("/rest/v1/audit_log")
  );
  assert.ok(audit, "the reingest is audit-logged");
  assert.equal(audit.body.action, "call.reingest");
  assert.equal(audit.body.target, CALL_ID);
});

test("reingest: a viewer is refused (403) before any lookup", async () => {
  const mock = reingestReq("viewer");
  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/calls/${CALL_ID}/reingest`, {}, GOOD_TOKEN)
  );
  assert.equal(res.status, 403);
  assert.equal(mock.requests.some((r) => r.method === "POST" && r.url.includes("/rest/v1/audit_log")), false);
});

test("reingest: an already-analyzed call is not reingestable (409)", async () => {
  const mock = reingestReq("owner", [
    { id: CALL_ID, source: "ringostat", status: "analyzed", manager_id: null, department_id: null }
  ]);
  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/calls/${CALL_ID}/reingest`, {}, GOOD_TOKEN)
  );
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, "not_reingestable");
});

test("reingest: a non-telephony (manual) call is not reingestable (409)", async () => {
  const mock = reingestReq("owner", [
    { id: CALL_ID, source: "manual", status: "failed", manager_id: null, department_id: null }
  ]);
  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/calls/${CALL_ID}/reingest`, {}, GOOD_TOKEN)
  );
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, "not_reingestable");
});

// ---------------------------------------------------------------------------
// Self-healing retry sweep (migration 0008)
// ---------------------------------------------------------------------------

function sweepReq() {
  const mock = createFetchMock();
  return mock;
}

test("sweep: a pending telephony call with a fixable error is retried and its retry_count bumped", async () => {
  const mock = sweepReq();
  mock.on("GET", "/rest/v1/calls", (record) => {
    if (record.url.includes("status=eq.pending")) {
      return { body: [{ id: CALL_ID, org_id: ORG_ID, source: "ringostat", retry_count: 2 }] };
    }
    if (record.url.includes("status=eq.transcribed")) return { body: [] };
    // ingestCall's own read of the call row, keyed by id only
    return { body: [{ id: CALL_ID, org_id: ORG_ID, status: "pending", manager_label: "Іван", direction: "outbound", duration_sec: null, external_id: "x-1", recording_url: null }] };
  });
  mock.on("PATCH", "/rest/v1/calls", { status: 204 });
  mock.on("GET", "/rest/v1/organizations", { body: [{ id: ORG_ID, monthly_call_quota: 500, timezone: "Europe/Kyiv", ai_provider: "gemini", ai_model: null }] });
  mock.on("GET", "/rest/v1/integrations", { body: [] }); // no PBX credentials on file -> credentials {}

  const api = makeApi(mock);
  await api.sweepStuckCalls();

  // retry_count bumped BEFORE the retry attempt.
  const bump = mock.requests.find(
    (r) => r.method === "PATCH" && r.url.includes("/rest/v1/calls") && r.body.retry_count === 3
  );
  assert.ok(bump, "retry_count incremented from 2 to 3");

  // The work-list query filters on the reason + the retry cap.
  const listReq = mock.requests.find((r) => r.method === "GET" && r.url.includes("status=eq.pending"));
  assert.match(decodeURIComponent(listReq.url), /error=in\.\(ai_key_missing,no_recording\)/);
  assert.match(decodeURIComponent(listReq.url), /retry_count=lt\.8/);

  // The pipeline actually ran (no recording configured here -> stays pending
  // with no_recording, proving runIngestPipeline was invoked, not skipped).
  const settled = mock.requests.find(
    (r) => r.method === "PATCH" && r.url.includes("/rest/v1/calls") && r.body.error === "no_recording"
  );
  assert.ok(settled, "the ingest pipeline actually ran for the stuck call");
});

test("sweep: a non-telephony source in the worklist is skipped (defence in depth)", async () => {
  const mock = sweepReq();
  mock.on("GET", "/rest/v1/calls", (record) => {
    if (record.url.includes("status=eq.pending")) {
      return { body: [{ id: CALL_ID, org_id: ORG_ID, source: "manual", retry_count: 0 }] };
    }
    return { body: [] };
  });

  await makeApi(mock).sweepStuckCalls();
  assert.equal(mock.requests.some((r) => r.method === "PATCH"), false, "a manual-source row is never retried");
});

test("sweep: a transcribed call with a checklist now available is scored and billed a new slot", async () => {
  const mock = sweepReq();
  mock.on("GET", "/rest/v1/calls", (record) => {
    if (record.url.includes("status=eq.pending")) return { body: [] };
    if (record.url.includes("status=eq.transcribed") && record.url.includes("retry_count")) {
      return { body: [{ id: CALL_ID, org_id: ORG_ID, retry_count: 0 }] };
    }
    // retryTranscribedAnalysis's own read, scoped to status=transcribed + id
    return { body: [{ id: CALL_ID, manager_label: "Іван", direction: "outbound", duration_sec: 120 }] };
  });
  mock.on("PATCH", "/rest/v1/calls", { status: 204 });
  mock.on("GET", "/rest/v1/organizations", { body: [{ id: ORG_ID, monthly_call_quota: 500, timezone: "Europe/Kyiv", ai_provider: "gemini", ai_model: null }] });
  mock.on("GET", "/rest/v1/transcripts", { body: [{ text: TRANSCRIPT }] });
  mock.on("GET", "/rest/v1/checklists", { body: [{ id: CHECKLIST_ID, items: CHECKLIST_ITEMS }] });
  mock.on("GET", "/rest/v1/org_ai_keys", { body: [{ key_ciphertext: await encryptSecret(GEMINI_PLAIN_KEY, MASTER_KEY) }] });
  mock.on("POST", "generativelanguage.googleapis.com", { status: 200, body: GEMINI_OK });
  mock.on("POST", "/rest/v1/analyses", { status: 201 });
  mock.on("GET", "/rest/v1/usage_counters", { body: [] });
  mock.on("POST", "/rest/v1/usage_counters", (record) => ({ status: 201, body: [record.body] }));
  mock.on("PATCH", "/rest/v1/usage_counters", (record) => ({ status: 200, body: [record.body] }));
  mock.on("PATCH", "/rest/v1/org_ai_keys", { status: 204 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });

  await makeApi(mock).sweepStuckCalls();

  const analyzed = mock.requests.find(
    (r) => r.method === "PATCH" && r.url.includes("/rest/v1/calls") && r.body.status === "analyzed"
  );
  assert.ok(analyzed, "the retried analysis actually scored the call");
  const slot = mock.requests.find((r) => r.method === "POST" && r.url.includes("/rest/v1/usage_counters"));
  assert.ok(slot, "a NEW quota slot was reserved for the retry, exactly like a manual re-analyze");
});

test("sweep: no-ops before migration 0008 (retry_count column absent)", async () => {
  const mock = sweepReq();
  mock.on("GET", "/rest/v1/calls", {
    status: 400,
    body: { code: "42703", message: "column calls.retry_count does not exist" }
  });
  await makeApi(mock).sweepStuckCalls();
  assert.equal(mock.requests.some((r) => r.method === "PATCH"), false);
});

test("purge: also sweeps stale webhook_rate_limits buckets (older than ~1 day)", async () => {
  const mock = createFetchMock();
  mock.on("DELETE", "/rest/v1/webhook_rate_limits", { status: 204 });
  mock.on("GET", "/rest/v1/organizations", { body: [] });

  await purgeExpiredData(ENV, mock);

  const del = mock.requests.find((r) => r.method === "DELETE" && r.url.includes("/rest/v1/webhook_rate_limits"));
  assert.ok(del, "old rate-limit buckets are cleaned up");
  assert.match(decodeURIComponent(del.url), /minute_bucket=lt\.\d+/);
});

test("purge: a missing webhook_rate_limits table does not block the retention scrub", async () => {
  const mock = createFetchMock();
  mock.on("DELETE", "/rest/v1/webhook_rate_limits", {
    status: 404,
    body: { code: "PGRST205", message: "Could not find the table 'public.webhook_rate_limits'" }
  });
  mock.on("GET", "/rest/v1/organizations", { body: [{ id: ORG_ID, retention_days: 90 }] });
  mock.on("GET", "/rest/v1/transcripts", { body: [] });

  await purgeExpiredData(ENV, mock);
  // Reaching the transcripts read at all proves the rate-limit cleanup failure
  // did not abort the function.
  assert.ok(mock.requests.some((r) => r.url.includes("/rest/v1/transcripts")));
});

// ---------------------------------------------------------------------------
// Platform operator digest (cron, migration 0008)
// ---------------------------------------------------------------------------

const ENV_PLATFORM_ALERT = { ...ENV_TG, PLATFORM_ALERT_CHAT_ID: "555556666" };

test("platformDigest: no-op without the platform chat id or the bot token", async () => {
  const mock = createFetchMock();
  await makeApi(mock, ENV_TG).platformDigest(); // no PLATFORM_ALERT_CHAT_ID
  assert.equal(mock.requests.length, 0);

  const mock2 = createFetchMock();
  await makeApi(mock2, { ...ENV, PLATFORM_ALERT_CHAT_ID: "555556666" }).platformDigest(); // no bot token
  assert.equal(mock2.requests.length, 0);
});

test("platformDigest: reports stuck-call counts per org and flags near/over quota", async () => {
  const ORG_B = "88888888-8888-4888-8888-888888888888";
  const mock = createFetchMock();
  mock.on("GET", "/rest/v1/organizations", {
    body: [
      { id: ORG_ID, name: "Pilot Co", monthly_call_quota: 100 },
      { id: ORG_B, name: "Second Co", monthly_call_quota: 50 }
    ]
  });
  mock.on("GET", "/rest/v1/calls", (record) =>
    record.url.includes("status=in") ? { body: [{ org_id: ORG_ID, status: "pending", error: "ai_key_missing" }, { org_id: ORG_ID, status: "pending", error: "ai_key_missing" }] } : { body: [] }
  );
  mock.on("GET", "/rest/v1/usage_counters", { body: [{ org_id: ORG_ID, calls_analyzed: 95 }, { org_id: ORG_B, calls_analyzed: 10 }] });
  mock.on("POST", "api.telegram.org", { status: 200, body: { ok: true } });

  await makeApi(mock, ENV_PLATFORM_ALERT).platformDigest();

  const send = mock.requests.find((r) => r.url.includes("api.telegram.org"));
  assert.ok(send, "the platform alert was sent");
  assert.equal(send.body.chat_id, "555556666");
  assert.match(send.body.text, /Организаций: 2/);
  assert.match(send.body.text, /Застрявших звонков: 2/);
  assert.match(send.body.text, /Pilot Co: 2/);
  assert.match(send.body.text, /Pilot Co: 95\/100 — 80%\+ лимита/);
  assert.equal(send.body.text.includes("Second Co:"), false, "Second Co is well under quota — not flagged");
});

test("platformDigest: an all-clear day still sends a short heartbeat", async () => {
  const mock = createFetchMock();
  mock.on("GET", "/rest/v1/organizations", { body: [{ id: ORG_ID, name: "Pilot Co", monthly_call_quota: 500 }] });
  mock.on("GET", "/rest/v1/calls", { body: [] });
  mock.on("GET", "/rest/v1/usage_counters", { body: [] });
  mock.on("POST", "api.telegram.org", { status: 200, body: { ok: true } });

  await makeApi(mock, ENV_PLATFORM_ALERT).platformDigest();
  const send = mock.requests.find((r) => r.url.includes("api.telegram.org"));
  assert.match(send.body.text, /Застрявших звонков: 0/);
});

// ---------------------------------------------------------------------------
// GET /api/app/status — public, unauthenticated
// ---------------------------------------------------------------------------

test("status: unconfigured deployment answers ok:false with no Supabase call", async () => {
  const mock = createFetchMock();
  const res = await makeApi(mock, {}).handle(get("/api/app/status"));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: false, supabase_configured: false });
  assert.equal(mock.requests.length, 0);
});

test("status: reports Supabase reachability and per-migration flags, unauthenticated", async () => {
  const mock = createFetchMock();
  mock.on("GET", "/rest/v1/organizations", (record) => {
    if (record.url.includes("rate_per_minute")) return { status: 400, body: { code: "42703" } }; // 0005 not applied
    return { body: [{ id: ORG_ID }] }; // plain id probe + stt_provider probe both succeed
  });
  mock.on("GET", "/rest/v1/calls", { body: [] }); // retry_count probe succeeds (0008 applied)

  const res = await makeApi(mock).handle(get("/api/app/status"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.supabase_reachable, true);
  assert.equal(body.migrations["0005_billing_retention"], false);
  assert.equal(body.migrations["0007_stt_provider"], true);
  assert.equal(body.migrations["0008_ops_hardening"], true);
});

test("status: does not require a bearer token", async () => {
  const mock = createFetchMock();
  mock.on("GET", "/rest/v1/organizations", { body: [] });
  mock.on("GET", "/rest/v1/calls", { body: [] });
  const res = await makeApi(mock).handle(get("/api/app/status")); // no token
  assert.notEqual(res.status, 401);
});

// ---------------------------------------------------------------------------
// Bulk member add (migration-free — just a looped createOneMember)
// ---------------------------------------------------------------------------

test("members bulk POST: creates each row, returns a fresh generated password per row", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  let n = 0;
  mock.on("POST", "/auth/v1/admin/users", () => ({ status: 200, body: { id: `u-${++n}` } }));
  mock.on("POST", "/rest/v1/memberships", { status: 201 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });

  const res = await makeApi(mock).handle(
    send(
      "POST",
      `/api/app/orgs/${ORG_ID}/members/bulk`,
      { members: [
        { email: "a@pilot.test", full_name: "А", role: "manager", extension: "101" },
        { email: "b@pilot.test", full_name: "Б", role: "lead", extension: "102" }
      ] },
      GOOD_TOKEN
    )
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.results.length, 2);
  assert.equal(body.results[0].ok, true);
  assert.equal(body.results[0].email, "a@pilot.test");
  assert.equal(typeof body.results[0].password, "string");
  assert.ok(body.results[0].password.length >= 12, "a real generated password, not empty");
  assert.notEqual(body.results[0].password, body.results[1].password, "each row gets its OWN password");

  const authCreates = mock.requests.filter((r) => r.url.includes("/auth/v1/admin/users"));
  assert.equal(authCreates.length, 2);
  assert.equal(authCreates[0].body.password.length >= 12, true);
});

test("members bulk POST: one bad row does not abort the rest of the batch", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");
  mock.on("POST", "/auth/v1/admin/users", (record) =>
    record.body.email === "dup@pilot.test" ? { status: 422, body: {} } : { status: 200, body: { id: NEW_USER_ID } }
  );
  mock.on("POST", "/rest/v1/memberships", { status: 201 });
  mock.on("POST", "/rest/v1/audit_log", { status: 201 });

  const res = await makeApi(mock).handle(
    send(
      "POST",
      `/api/app/orgs/${ORG_ID}/members/bulk`,
      { members: [
        { email: "dup@pilot.test", full_name: "X", role: "manager" },
        { email: "ok@pilot.test", full_name: "Y", role: "manager" }
      ] },
      GOOD_TOKEN
    )
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.results[0].ok, false);
  assert.equal(body.results[0].error, "email_exists");
  assert.equal(body.results[1].ok, true);
});

test("members bulk POST: an admin is still capped to lead/manager/viewer per row", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "admin");
  const res = await makeApi(mock).handle(
    send(
      "POST",
      `/api/app/orgs/${ORG_ID}/members/bulk`,
      { members: [{ email: "x@pilot.test", full_name: "X", role: "admin" }] },
      GOOD_TOKEN
    )
  );
  const body = await res.json();
  assert.equal(body.results[0].ok, false);
  assert.equal(body.results[0].error, "forbidden");
  assert.equal(mock.requests.some((r) => r.url.includes("/auth/v1/admin/users")), false);
});

test("members bulk POST: rejects an empty list and a batch over the row cap", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "owner");

  const empty = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/members/bulk`, { members: [] }, GOOD_TOKEN)
  );
  assert.equal(empty.status, 400);

  const tooMany = Array.from({ length: 51 }, (_, i) => ({ email: `u${i}@pilot.test`, full_name: "X", role: "manager" }));
  const over = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/members/bulk`, { members: tooMany }, GOOD_TOKEN)
  );
  assert.equal(over.status, 400);
  assert.equal((await over.json()).error, "too_many_rows");
});

test("members bulk POST: a viewer is refused before any row is processed", async () => {
  const mock = createFetchMock();
  seedAuth(mock);
  seedMembership(mock, "viewer");
  const res = await makeApi(mock).handle(
    send("POST", `/api/app/orgs/${ORG_ID}/members/bulk`, { members: [{ email: "x@pilot.test", role: "manager" }] }, GOOD_TOKEN)
  );
  assert.equal(res.status, 403);
});
