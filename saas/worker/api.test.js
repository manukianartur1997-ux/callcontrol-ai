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
import { createApi } from "./api.js";
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

const GOOD_TOKEN = "good-jwt-token-for-tests";
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
    return {
      ok: status >= 200 && status < 300,
      status,
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
      ? { status: 200, body: { id: USER_ID, email: "owner@pilot.test" } }
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
    body: [{ id: ORG_ID, monthly_call_quota: quota, timezone: "Europe/Kyiv", ai_provider: "gemini", ai_model: null }]
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
  assert.deepEqual(body.user, { id: USER_ID, email: "owner@pilot.test" });
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
  assert.deepEqual(await res.json(), { ok: true, ignored: true });
  assert.equal(mock.requests.some((r) => r.method === "POST" && r.url.includes("/rest/v1/calls")), false);
});
