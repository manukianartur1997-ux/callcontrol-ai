// SaaS HTTP layer: the cabinet API (/api/app/*) and the telephony webhooks
// (/api/telephony/*) for the Cloudflare Worker.
//
// createApi({ env, fetchImpl }) -> { handle(request) }. handle() answers only
// the routes it owns and returns null for everything else, so the host worker
// (lead capture, static assets) keeps its behaviour untouched.
//
// Authorization, in order:
//   1. getUser() — validates the Supabase JWT (cached 60s per isolate).
//   2. activeMembership() — the caller must hold an active membership in the
//      :orgId taken from the URL. This is the IDOR guard: EVERY org route
//      passes through it before anything is read with the service key
//      (which bypasses RLS).
//   3. Per-route role checks — viewers cannot analyze, only the owner sets
//      AI keys, an admin cannot mint peers.
//
// Webhooks have no user: the per-org webhook_token in the URL is the
// credential (see telephony.js for why), so the only lookup is token+kind.

import { analyzeCall, supportedProviders } from "./ai.js";
import { decryptSecret, encryptSecret, keyHint } from "./crypto.js";
import { normalizeEvent, isCompletedCallEvent, resolveManager } from "./telephony.js";
import { getUser, createTokenCache } from "./auth.js";
import { sbGet, sbPost, sbPatch, sbEq } from "./supabase-rest.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES = new Set(["owner", "admin", "lead", "manager", "viewer"]);
// An admin staffs the org but cannot mint peers or a second owner.
const ADMIN_GRANTABLE = new Set(["lead", "manager", "viewer"]);
const TELEPHONY_KINDS = new Set(["ringostat", "binotel"]);

// Invite tokens are DB-generated hex (48 chars by default); accepting 16..64
// hex keeps room for other lengths while a malformed token can short-circuit
// to the same generic invite_invalid without ever touching the DB.
// Exactly what the invites.token DB default generates: 48 lowercase hex
// (192 bits). A wider window would silently accept tokens that can never
// match a stored one and widen a future misconfiguration.
const INVITE_TOKEN_RE = /^[a-f0-9]{48}$/;

// Verbatim copy of app.default_checklist_items() from
// saas/migrations/0002_onboarding.sql. Schema "app" is not exposed through
// PostgREST, so the Worker seeds the same 7 items itself during onboarding.
const DEFAULT_CHECKLIST_ITEMS = [
  { key: "greeting", weight: 8, label: "Приветствие и представление", hint: "Назвал компанию и себя, обозначил цель звонка" },
  { key: "needs", weight: 20, label: "Выявление потребности", hint: "Открытые вопросы, докопался до реальной задачи, а не до запроса" },
  { key: "qualification", weight: 14, label: "Квалификация", hint: "Бюджет, сроки, кто принимает решение" },
  { key: "pitch", weight: 14, label: "Презентация под потребность", hint: "Говорил о выгоде клиента, а не о свойствах продукта" },
  { key: "objections", weight: 16, label: "Работа с возражениями", hint: "Уточнил суть возражения, не спорил, привёл аргумент" },
  { key: "next_step", weight: 18, label: "Фиксация следующего шага", hint: "Конкретная дата и договорённость, а не «я перезвоню»" },
  { key: "tone", weight: 10, label: "Тон и инициатива", hint: "Вёл разговор, не перебивал, слушал" }
];

// Minimal uk/ru transliteration so a Cyrillic company name still yields a
// readable slug; anything unmapped is stripped by the [a-z0-9] filter below.
const SLUG_TRANSLIT = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ё: "e",
  ж: "zh", з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh",
  ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e",
  ю: "iu", я: "ia"
};

function randomHex(bytes) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Lowercase translit of the name reduced to [a-z0-9-], dashes collapsed,
// trimmed to 24 chars. Never empty and never starts/ends with a dash, so the
// final "<base>-<hex>" always satisfies the DB check ^[a-z0-9][a-z0-9-]{1,48}$.
function slugBase(name) {
  const base = String(name)
    .toLowerCase()
    .split("")
    .map((ch) => SLUG_TRANSLIT[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24)
    .replace(/-$/, "");
  return base || "org";
}

// Bootstrap for a fresh organization: org row, owner membership, default
// checklist, both telephony integrations, audit entry. Reimplements
// app.create_organization() from 0002_onboarding.sql with plain table writes
// because schema "app" is not exposed via PostgREST.
//
// NOTE: org creation is intentionally NOT rate-limited beyond the signup code
// (or a valid invite) — the pilot is invite-only, and that gate is accepted
// as sufficient for now.
async function createOrganization(env, fetchImpl, { name, ownerId, ownerName }) {
  // The 6-hex suffix is ALWAYS appended, so slug uniqueness never depends on
  // the human-chosen name; 24 random bits can still collide, so a unique
  // violation retries with fresh randomness instead of failing the signup.
  let orgId = null;
  for (let attempt = 0; attempt < 3 && !orgId; attempt += 1) {
    const slug = `${slugBase(name)}-${randomHex(3)}`;
    try {
      const created = await sbPost(env, fetchImpl, "organizations", {
        headers: { prefer: "return=representation" },
        body: {
          name,
          slug,
          plan: "pilot",
          monthly_call_quota: 500,
          timezone: "Europe/Kyiv",
          ai_provider: "gemini",
          ai_key_source: "own",
          created_by: ownerId
        }
      });
      orgId = created?.[0]?.id || null;
    } catch (error) {
      if (!/_409|duplicate/i.test(String(error?.message))) throw error;
    }
  }
  if (!orgId) throw new Error("org_create_failed");

  try {
    await seedOrganization(env, fetchImpl, { orgId, ownerId, ownerName });
  } catch (error) {
    // A failure between the org insert and the owner membership would leave
    // an org nobody can enter; delete the shell (FKs cascade) and rethrow so
    // the caller can clean up its side too.
    await sbRequestDelete(env, fetchImpl, `organizations?${sbEq({ id: orgId })}`).catch(() => {});
    throw error;
  }
  return orgId;
}

async function sbRequestDelete(env, fetchImpl, path) {
  const response = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method: "DELETE",
    headers: { apikey: env.SUPABASE_SECRET_KEY, authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` }
  });
  if (!response.ok) throw new Error(`supabase_delete_${response.status}`);
}

async function seedOrganization(env, fetchImpl, { orgId, ownerId, ownerName }) {
  await sbPost(env, fetchImpl, "memberships", {
    body: { org_id: orgId, user_id: ownerId, role: "owner", full_name: ownerName || null, status: "active" }
  });
  await sbPost(env, fetchImpl, "checklists", {
    body: { org_id: orgId, name: "Базовый чек-лист", items: DEFAULT_CHECKLIST_ITEMS, is_default: true }
  });
  // webhook_token is set explicitly: the DB default only fires when the
  // column is absent from the insert payload, and this insert names it.
  await sbPost(env, fetchImpl, `integrations?${new URLSearchParams({ on_conflict: "org_id,kind" })}`, {
    headers: { prefer: "resolution=ignore-duplicates" },
    body: [...TELEPHONY_KINDS].map((kind) => ({
      org_id: orgId,
      kind,
      enabled: true,
      webhook_token: randomHex(24)
    }))
  });
  await sbPost(env, fetchImpl, "audit_log", {
    body: { org_id: orgId, actor_id: ownerId, action: "org.created", target: orgId }
  });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

// "Europe/Kyiv" at a given instant -> minutes east of UTC (DST-aware).
// Both PBX vendors send local wall-clock timestamps with no zone, so this is
// what normalizeEvent() needs to produce a correct UTC started_at.
function zoneOffsetMinutes(timeZone, at) {
  if (!timeZone) return 0;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset"
    }).formatToParts(at);
    const name = parts.find((part) => part.type === "timeZoneName")?.value || "";
    const match = name.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (!match) return 0; // plain "GMT" — UTC itself
    const sign = match[1] === "-" ? -1 : 1;
    return sign * (Number(match[2]) * 60 + Number(match[3]));
  } catch (_) {
    return 0; // unknown zone in the DB — better a UTC-shifted timestamp than a 500
  }
}

// Ringostat sends JSON or form-urlencoded depending on the account's webhook
// settings; Binotel sends JSON. Parse both into one plain object.
async function readWebhookBody(request) {
  const text = await request.text().catch(() => "");
  if (!text) return {};
  // Real PBX payloads are well under 10KB; anything bigger is abuse or a
  // misconfiguration, and parsing it would burn CPU and bloat rows.
  if (text.length > 64_000) return null;
  const contentType = String(request.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("json") || text.trimStart().startsWith("{")) {
    try {
      return JSON.parse(text);
    } catch (_) {
      // fall through and try the form parser
    }
  }
  return Object.fromEntries(new URLSearchParams(text));
}

// ---------------------------------------------------------------------------
// Quota accounting without an RPC (schema "app" is not exposed to PostgREST).
//
// The naive read-then-upsert lets N concurrent analyze calls all observe the
// same counter and all write used+1 — an unbounded quota bypass. Instead a
// slot is RESERVED before any money is spent, with an optimistic CAS on
// calls_analyzed: the PATCH filters on the value we read, so only one racer
// per round can win, and losers re-read and retry. Overshoot is bounded by
// a single in-flight burst, which the pilot accepts.
// ---------------------------------------------------------------------------

async function reserveQuotaSlot(env, fetchImpl, orgId, period, quota) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const row = (await sbGet(env, fetchImpl, `usage_counters?${sbEq(
      { org_id: orgId, period },
      { select: "calls_analyzed", limit: "1" }
    )}`))?.[0] || null;
    const used = row ? row.calls_analyzed || 0 : 0;
    if (used >= quota) return false;

    if (!row) {
      // First analysis of the month: claiming the row IS claiming the slot.
      const created = await sbPost(env, fetchImpl, `usage_counters?${new URLSearchParams({
        on_conflict: "org_id,period"
      })}`, {
        headers: { prefer: "resolution=ignore-duplicates,return=representation" },
        body: { org_id: orgId, period, calls_analyzed: 1, tokens_in: 0, tokens_out: 0 }
      });
      if (Array.isArray(created) && created.length) return true;
      continue; // lost the creation race — retry as a CAS update
    }

    const won = await sbPatch(env, fetchImpl, `usage_counters?${sbEq(
      { org_id: orgId, period, calls_analyzed: used }
    )}`, {
      headers: { prefer: "return=representation" },
      body: { calls_analyzed: used + 1 }
    });
    if (Array.isArray(won) && won.length) return true;
  }
  throw new Error("usage_counter_contention");
}

// Best-effort CAS delta after the money was already spent (token totals) or
// refunded (releasing a slot when the provider errored). Token counts may
// undercount under extreme concurrency; the reserved call count never does.
async function shiftUsage(env, fetchImpl, orgId, period, { calls = 0, tokensIn = 0, tokensOut = 0 }) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const row = (await sbGet(env, fetchImpl, `usage_counters?${sbEq(
      { org_id: orgId, period },
      { select: "calls_analyzed,tokens_in,tokens_out", limit: "1" }
    )}`))?.[0];
    if (!row) return;
    const won = await sbPatch(env, fetchImpl, `usage_counters?${sbEq(
      { org_id: orgId, period, calls_analyzed: row.calls_analyzed }
    )}`, {
      headers: { prefer: "return=representation" },
      body: {
        calls_analyzed: Math.max(0, (row.calls_analyzed || 0) + calls),
        tokens_in: (row.tokens_in || 0) + tokensIn,
        tokens_out: (row.tokens_out || 0) + tokensOut
      }
    });
    if (Array.isArray(won) && won.length) return;
  }
}

export function createApi({ env, fetchImpl = fetch } = {}) {
  // One token cache per instance (= per isolate in production), never
  // module-global — see auth.js.
  const tokenCache = createTokenCache();

  const isConfigured = () =>
    Boolean(env?.SUPABASE_URL && env?.SUPABASE_SECRET_KEY && env?.ORG_SECRET_KEY);

  // --- shared reads --------------------------------------------------------

  async function loadOrg(orgId) {
    const rows = await sbGet(env, fetchImpl, `organizations?${sbEq({ id: orgId }, {
      select: "id,monthly_call_quota,timezone,ai_provider,ai_model",
      limit: "1"
    })}`);
    return rows?.[0] || null;
  }

  // The IDOR guard. Service-role read on purpose: RLS cannot help here
  // because the service key bypasses it, so membership is checked explicitly
  // before any org data is touched.
  async function activeMembership(orgId, userId) {
    const rows = await sbGet(env, fetchImpl, `memberships?${sbEq(
      { org_id: orgId, user_id: userId, status: "active" },
      { select: "id,user_id,role,full_name,extension,department_id", limit: "1" }
    )}`);
    return rows?.[0] || null;
  }

  // --- cabinet routes ------------------------------------------------------

  async function me(user) {
    // One embedded select: memberships plus the organization row per row.
    const rows = await sbGet(env, fetchImpl, `memberships?${sbEq(
      { user_id: user.id, status: "active" },
      {
        select:
          "org_id,role,extension,full_name,department_id," +
          "organization:organizations(id,name,slug,plan,monthly_call_quota,timezone,ai_provider,ai_model)"
      }
    )}`);
    return json({ user, memberships: rows || [] });
  }

  async function analyze(request, orgId, user, membership) {
    if (membership.role === "viewer") return json({ error: "forbidden" }, 403);

    const body = await request.json().catch(() => null);
    const callId = String(body?.call_id || "");
    if (!UUID_RE.test(callId)) return json({ error: "bad_call_id" }, 400);

    const org = await loadOrg(orgId);
    if (!org) return json({ error: "org_not_found" }, 404);

    // Quota check before anything costs money. Read-then-upsert rather than
    // an RPC because schema "app" is not exposed via PostgREST; the pilot's
    // single-worker traffic makes the read-modify-write race acceptable.
    const period = `${new Date().toISOString().slice(0, 7)}-01`;
    const usageRows = await sbGet(env, fetchImpl, `usage_counters?${sbEq(
      { org_id: orgId, period },
      { select: "calls_analyzed", limit: "1" }
    )}`);
    const used = usageRows?.[0]?.calls_analyzed || 0;
    if (used >= org.monthly_call_quota) return json({ error: "quota_exceeded" }, 429);

    // org_id in the filter as well as id: a call from another tenant must be
    // indistinguishable from a missing one.
    const call = (await sbGet(env, fetchImpl, `calls?${sbEq(
      { id: callId, org_id: orgId },
      { select: "id,org_id,manager_label,direction,duration_sec,status", limit: "1" }
    )}`))?.[0];
    if (!call) return json({ error: "call_not_found" }, 404);

    const transcript = (await sbGet(env, fetchImpl, `transcripts?${sbEq(
      { call_id: callId, org_id: orgId },
      { select: "id,text,lang", limit: "1" }
    )}`))?.[0];
    if (!transcript?.text) return json({ error: "no_transcript" }, 409);

    const checklist = (await sbGet(env, fetchImpl, `checklists?${sbEq(
      { org_id: orgId, is_default: "true" },
      { select: "id,items", limit: "1" }
    )}`))?.[0];
    if (!checklist) return json({ error: "no_checklist" }, 409);

    const keyRow = (await sbGet(env, fetchImpl, `org_ai_keys?${sbEq(
      { org_id: orgId, provider: org.ai_provider },
      { select: "id,key_ciphertext", limit: "1" }
    )}`))?.[0];
    if (!keyRow) return json({ error: "ai_key_missing" }, 409);

    // The plaintext key exists only inside this call frame.
    const apiKey = await decryptSecret(keyRow.key_ciphertext, env.ORG_SECRET_KEY);

    // Reserve the quota slot only now: every check above was free, and a 404
    // on a foreign call must not consume a slot from the caller's plan.
    if (!(await reserveQuotaSlot(env, fetchImpl, orgId, period, org.monthly_call_quota))) {
      return json({ error: "quota_exceeded" }, 429);
    }

    let result;
    try {
      result = await analyzeCall({
        provider: org.ai_provider,
        apiKey,
        model: org.ai_model || undefined,
        transcript: transcript.text,
        checklist: { items: checklist.items || [] },
        context: {
          managerName: call.manager_label,
          direction: call.direction,
          durationSec: call.duration_sec
        },
        fetchImpl
      });
    } catch (error) {
      const message = String(error?.message || error);
      // Best-effort bookkeeping: the caller still needs the 502 even if one
      // of these writes fails, hence allSettled and no rethrow.
      await Promise.allSettled([
        shiftUsage(env, fetchImpl, orgId, period, { calls: -1 }),
        sbPatch(env, fetchImpl, `calls?${sbEq({ id: callId, org_id: orgId })}`, {
          body: { status: "failed", error: message.slice(0, 300) }
        }),
        sbPatch(env, fetchImpl, `org_ai_keys?${sbEq({ org_id: orgId, provider: org.ai_provider })}`, {
          body: { last_error: message.slice(0, 300) }
        }),
        sbPost(env, fetchImpl, "audit_log", {
          body: {
            org_id: orgId,
            actor_id: user.id,
            action: "call.analyze_failed",
            target: callId,
            meta: { error: message.slice(0, 200) }
          }
        })
      ]);
      return json({ error: "analysis_failed", detail: message.slice(0, 200) }, 502);
    }

    await sbPost(env, fetchImpl, "analyses", {
      body: {
        org_id: orgId,
        call_id: callId,
        checklist_id: checklist.id,
        score: result.score,
        findings: result,
        provider: result.provider,
        model: result.model,
        tokens_in: result.tokensIn,
        tokens_out: result.tokensOut
      }
    });
    await sbPatch(env, fetchImpl, `calls?${sbEq({ id: callId, org_id: orgId })}`, {
      body: { status: "analyzed", error: null }
    });
    // The call slot was reserved before the provider ran; add the tokens now.
    await shiftUsage(env, fetchImpl, orgId, period, {
      tokensIn: result.tokensIn || 0,
      tokensOut: result.tokensOut || 0
    });
    await sbPatch(env, fetchImpl, `org_ai_keys?${sbEq({ org_id: orgId, provider: org.ai_provider })}`, {
      body: { last_ok_at: new Date().toISOString(), last_error: null }
    });
    await sbPost(env, fetchImpl, "audit_log", {
      body: {
        org_id: orgId,
        actor_id: user.id,
        action: "call.analyzed",
        target: callId,
        meta: { score: result.score, tokens_in: result.tokensIn, tokens_out: result.tokensOut }
      }
    });

    return json({ ok: true, analysis: result });
  }

  async function getAiKey(orgId, membership) {
    if (!["owner", "admin"].includes(membership.role)) return json({ error: "forbidden" }, 403);

    const org = await loadOrg(orgId);
    if (!org) return json({ error: "org_not_found" }, 404);

    const row = (await sbGet(env, fetchImpl, `org_ai_keys?${sbEq(
      { org_id: orgId, provider: org.ai_provider },
      { select: "key_hint,last_ok_at,last_error", limit: "1" }
    )}`))?.[0] || null;

    // The hint is the ONLY key representation that may reach a browser.
    return json({
      provider: org.ai_provider,
      model: org.ai_model ?? null,
      hint: row?.key_hint ?? null,
      last_ok_at: row?.last_ok_at ?? null,
      last_error: row?.last_error ?? null
    });
  }

  async function putAiKey(request, orgId, user, membership) {
    // The key is the client's money — only the director touches it.
    if (membership.role !== "owner") return json({ error: "forbidden" }, 403);

    const body = await request.json().catch(() => null);
    const provider = String(body?.provider || "");
    const apiKey = typeof body?.api_key === "string" ? body.api_key.trim() : "";
    const model = body?.model ? String(body.model) : null;

    if (!supportedProviders().includes(provider)) return json({ error: "unsupported_provider" }, 400);
    if (!apiKey) return json({ error: "api_key_required" }, 400);

    const hint = keyHint(apiKey);
    const ciphertext = await encryptSecret(apiKey, env.ORG_SECRET_KEY);

    await sbPost(env, fetchImpl, `org_ai_keys?${new URLSearchParams({ on_conflict: "org_id,provider" })}`, {
      headers: { prefer: "resolution=merge-duplicates" },
      // A fresh key clears the stale failure state along the way.
      body: { org_id: orgId, provider, key_ciphertext: ciphertext, key_hint: hint, last_error: null }
    });
    await sbPatch(env, fetchImpl, `organizations?${sbEq({ id: orgId })}`, {
      body: { ai_provider: provider, ai_model: model }
    });
    // meta carries the provider and the 4-char hint ONLY — never key material.
    await sbPost(env, fetchImpl, "audit_log", {
      body: {
        org_id: orgId,
        actor_id: user.id,
        action: "org.ai_key_set",
        target: provider,
        meta: { provider, hint }
      }
    });

    return json({ ok: true, hint });
  }

  async function listMembers(orgId) {
    const rows = await sbGet(env, fetchImpl, `memberships?${sbEq(
      { org_id: orgId },
      { select: "id,user_id,role,full_name,extension,department_id,status" }
    )}`);
    return json({ members: rows || [] });
  }

  async function addMember(request, orgId, user, membership) {
    if (!["owner", "admin"].includes(membership.role)) return json({ error: "forbidden" }, 403);

    const body = await request.json().catch(() => null);
    const email = String(body?.email || "").trim();
    const password = typeof body?.password === "string" ? body.password : "";
    const fullName = String(body?.full_name || "").trim().slice(0, 120);
    const role = String(body?.role || "");
    const extension = body?.extension ? String(body.extension) : null;
    const departmentId = body?.department_id ? String(body.department_id) : null;

    if (!ROLES.has(role)) return json({ error: "bad_role" }, 400);
    if (membership.role === "admin" && !ADMIN_GRANTABLE.has(role)) {
      return json({ error: "forbidden" }, 403);
    }
    if (!email.includes("@") || !password) return json({ error: "bad_credentials" }, 400);
    if (departmentId && !UUID_RE.test(departmentId)) return json({ error: "bad_department_id" }, 400);

    // Supabase Auth admin endpoint — the service key acts as both apikey and
    // bearer. email_confirm skips the confirmation mail: members are created
    // by their director, not self-registered.
    const response = await fetchImpl(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: env.SUPABASE_SECRET_KEY,
        authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`
      },
      body: JSON.stringify({ email, password, email_confirm: true })
    });
    if (response.status === 422 || response.status === 409) {
      // The friendly duplicate-email answer is kept for legitimate admins,
      // which makes it a cross-tenant account oracle — so every hit lands in
      // the audit trail, where an enumeration burst is plainly visible.
      await sbPost(env, fetchImpl, "audit_log", {
        body: {
          org_id: orgId,
          actor_id: user.id,
          action: "member.add_failed",
          meta: { reason: "email_exists" }
        }
      }).catch(() => {});
      return json({ error: "email_exists" }, 409);
    }
    if (!response.ok) return json({ error: "auth_create_failed" }, 502);

    const created = await response.json().catch(() => null);
    const userId = created?.id || created?.user?.id;
    if (!userId) return json({ error: "auth_create_failed" }, 502);

    await sbPost(env, fetchImpl, "memberships", {
      body: {
        org_id: orgId,
        user_id: userId,
        role,
        full_name: fullName || null,
        extension,
        department_id: departmentId,
        status: "active",
        invited_by: user.id
      }
    });
    // No password in the audit trail, ever — the role is the interesting part.
    await sbPost(env, fetchImpl, "audit_log", {
      body: { org_id: orgId, actor_id: user.id, action: "member.added", target: userId, meta: { role } }
    });

    return json({ ok: true, user_id: userId });
  }

  async function listIntegrations(orgId, membership) {
    if (!["owner", "admin"].includes(membership.role)) return json({ error: "forbidden" }, 403);

    const rows = (await sbGet(env, fetchImpl, `integrations?${sbEq(
      { org_id: orgId },
      { select: "kind,enabled,webhook_token,last_event_at" }
    )}`)) || [];

    // The token is exposed here as the ready-to-paste webhook path — this
    // screen is where the owner copies it into the PBX settings.
    return json(rows.map((row) => ({
      kind: row.kind,
      enabled: row.enabled,
      webhook_path: `/api/telephony/${row.kind}/${row.webhook_token}`,
      last_event_at: row.last_event_at
    })));
  }

  // --- onboarding: invites & self-serve org creation -----------------------

  // ONE generic null for every invalid-invite reason (malformed token,
  // missing row, already used, expired, email mismatch): the token holder
  // must not learn which check failed — a leaked link yields no oracle about
  // whose invite it was or whether it was ever valid.
  async function loadValidInvite(token, email) {
    if (!INVITE_TOKEN_RE.test(token)) return null;
    const invite = (await sbGet(env, fetchImpl, `invites?${sbEq(
      { token },
      { select: "id,org_id,email,role,department_id,invited_by,expires_at,accepted_at", limit: "1" }
    )}`))?.[0];
    if (!invite) return null;
    if (invite.accepted_at) return null;
    if (!invite.expires_at || new Date(invite.expires_at).getTime() <= Date.now()) return null;
    if (String(invite.email || "").toLowerCase() !== String(email || "").toLowerCase()) return null;
    return invite;
  }

  // Burn the invite and leave the audit trail; called only AFTER the
  // membership row landed, so a failed insert leaves the invite spendable.
  async function markInviteAccepted(invite, userId) {
    await sbPatch(env, fetchImpl, `invites?${sbEq({ id: invite.id })}`, {
      body: { accepted_at: new Date().toISOString(), accepted_by: userId }
    });
    await sbPost(env, fetchImpl, "audit_log", {
      body: {
        org_id: invite.org_id,
        actor_id: userId,
        action: "invite.accepted",
        target: invite.id,
        meta: { role: invite.role }
      }
    });
  }

  // Supabase Auth admin endpoint — service key as both apikey and bearer.
  // 422 (GoTrue) and 409 both mean "this email already has an account".
  async function createAuthUser(email, password, fullName) {
    const response = await fetchImpl(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: env.SUPABASE_SECRET_KEY,
        authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: fullName ? { full_name: fullName } : {}
      })
    });
    if (response.status === 422 || response.status === 409) return { exists: true };
    if (!response.ok) return { error: true };
    const created = await response.json().catch(() => null);
    const userId = created?.id || created?.user?.id;
    if (!userId) return { error: true };
    return { userId };
  }

  // Public: invite token + email + fresh password -> account + membership.
  async function join(request) {
    const body = await request.json().catch(() => null);
    const token = String(body?.token || "");
    const email = String(body?.email || "").trim();
    const password = typeof body?.password === "string" ? body.password : "";
    const fullName = String(body?.full_name || "").trim().slice(0, 120);

    if (password.length < 8) return json({ error: "weak_password" }, 400);
    if (!email.includes("@")) return json({ error: "bad_email" }, 400);

    const invite = await loadValidInvite(token, email);
    if (!invite) return json({ error: "invite_invalid" }, 404);

    const auth = await createAuthUser(email, password, fullName);
    // The invitee already has an account (e.g. signed up via Google): they
    // must sign in and use /join-authed — the invite stays unspent.
    if (auth.exists) return json({ error: "email_exists", hint: "sign_in_then_join" }, 409);
    if (!auth.userId) return json({ error: "auth_create_failed" }, 502);

    await sbPost(env, fetchImpl, "memberships", {
      body: {
        org_id: invite.org_id,
        user_id: auth.userId,
        role: invite.role,
        department_id: invite.department_id || null,
        full_name: fullName || null,
        status: "active",
        invited_by: invite.invited_by
      }
    });
    await markInviteAccepted(invite, auth.userId);
    return json({ ok: true });
  }

  // Authed: the invite must target the signed-in account's OWN email, so a
  // forwarded link is useless to anyone but the invitee.
  async function joinAuthed(request, user) {
    const body = await request.json().catch(() => null);
    const token = String(body?.token || "");

    const invite = await loadValidInvite(token, user.email);
    if (!invite) return json({ error: "invite_invalid" }, 404);

    try {
      await sbPost(env, fetchImpl, "memberships", {
        body: {
          org_id: invite.org_id,
          user_id: user.id,
          role: invite.role,
          department_id: invite.department_id || null,
          full_name: user.user_metadata?.full_name || null,
          status: "active",
          invited_by: invite.invited_by
        }
      });
    } catch (error) {
      // The (org_id, user_id) unique index answered 409 — already a member;
      // the invite is left untouched.
      if (/supabase_post_409/.test(String(error?.message || ""))) {
        return json({ error: "already_member" }, 409);
      }
      throw error;
    }
    await markInviteAccepted(invite, user.id);
    return json({ ok: true, org_id: invite.org_id });
  }

  // Signup gate: SIGNUP_CODE is a shared secret handed out per pilot deal.
  // A wrong code answers 403 with a bare error label — neither the expected
  // code nor the attempted value ever appears in a response or a log.
  // Compared via SHA-256 digests so the comparison time is independent of how
  // many leading characters matched (plain !== short-circuits per byte).
  async function signupGate(body) {
    if (!env.SIGNUP_CODE) return json({ error: "signup_closed" }, 503);
    const enc = new TextEncoder();
    const [a, b] = await Promise.all([
      crypto.subtle.digest("SHA-256", enc.encode(String(body?.signup_code || ""))),
      crypto.subtle.digest("SHA-256", enc.encode(String(env.SIGNUP_CODE)))
    ]);
    const av = new Uint8Array(a);
    const bv = new Uint8Array(b);
    let diff = 0;
    for (let i = 0; i < av.length; i += 1) diff |= av[i] ^ bv[i];
    if (diff !== 0) return json({ error: "bad_signup_code" }, 403);
    return null;
  }

  // Public: signup code + fresh account -> new organization, caller is owner.
  async function registerOrg(request) {
    const body = await request.json().catch(() => null);
    const gate = await signupGate(body);
    if (gate) return gate;

    const orgName = String(body?.org_name || "").trim();
    const email = String(body?.email || "").trim();
    const password = typeof body?.password === "string" ? body.password : "";
    const fullName = String(body?.full_name || "").trim().slice(0, 120);

    if (orgName.length < 2 || orgName.length > 120) return json({ error: "bad_org_name" }, 400);
    if (password.length < 8) return json({ error: "weak_password" }, 400);
    if (!email.includes("@")) return json({ error: "bad_email" }, 400);

    // Self-serve accounts go through the PUBLIC signup endpoint, NOT the
    // admin API: the admin path would mint a CONFIRMED account for an email
    // the caller never proved they own (pre-registration squatting). Public
    // signup respects the project's email-confirmation setting, and Supabase
    // sends the confirmation mail itself.
    const signup = await fetchImpl(`${env.SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: env.SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({
        email,
        password,
        data: fullName ? { full_name: fullName.slice(0, 120) } : {}
      })
    });
    const created = await signup.json().catch(() => null);
    if (!signup.ok) {
      if (signup.status === 400 || signup.status === 422) {
        logAbuseSignal("register_org_email_rejected", email);
        return json({ error: "email_exists", hint: "sign_in_then_create" }, 409);
      }
      return json({ error: "auth_create_failed" }, 502);
    }
    const authUser = created?.user || created;
    // GoTrue anti-enumeration: an already-registered email yields a fake
    // user with an EMPTY identities array. Surfacing 409 here is equivalent
    // to what Supabase's own public endpoint reveals — logged for velocity.
    if (Array.isArray(authUser?.identities) && authUser.identities.length === 0) {
      logAbuseSignal("register_org_email_exists", email);
      return json({ error: "email_exists", hint: "sign_in_then_create" }, 409);
    }
    if (!authUser?.id) return json({ error: "auth_create_failed" }, 502);

    let orgId;
    try {
      orgId = await createOrganization(env, fetchImpl, {
        name: orgName,
        ownerId: authUser.id,
        ownerName: fullName ? fullName.slice(0, 120) : null
      });
    } catch (error) {
      // Never leave an orphaned account squatting the email: without this,
      // a failed org bootstrap permanently blocks the user's next attempt
      // with email_exists.
      await fetchImpl(`${env.SUPABASE_URL}/auth/v1/admin/users/${authUser.id}`, {
        method: "DELETE",
        headers: { apikey: env.SUPABASE_SECRET_KEY, authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` }
      }).catch(() => {});
      return json({ error: "org_create_failed" }, 502);
    }
    return json({
      ok: true,
      org_id: orgId,
      // No session in the signup answer => confirmations are on and the user
      // must click the emailed link before password sign-in works.
      email_confirmation_required: !created?.session && !created?.access_token
    });
  }

  // Enumeration attempts against the public registration surface cannot land
  // in audit_log (org_id is NOT NULL there and no tenant exists yet), so they
  // go to the worker log where a velocity burst is visible via wrangler tail.
  function logAbuseSignal(kind, email) {
    const at = String(email).indexOf("@");
    const masked = at > 0 ? `${String(email).slice(0, 2)}…${String(email).slice(at)}` : "…";
    console.warn(`[abuse-signal] ${kind} ${masked}`);
  }

  // Authed (the Google-signup path: account exists, wants a company).
  async function createOrgAuthed(request, user) {
    const body = await request.json().catch(() => null);
    const gate = await signupGate(body);
    if (gate) return gate;

    const orgName = String(body?.org_name || "").trim();
    if (orgName.length < 2 || orgName.length > 120) return json({ error: "bad_org_name" }, 400);

    const orgId = await createOrganization(env, fetchImpl, {
      name: orgName,
      ownerId: user.id,
      ownerName: (user.user_metadata?.full_name || "").slice(0, 120) || null
    });
    return json({ ok: true, org_id: orgId });
  }

  // --- telephony webhooks --------------------------------------------------

  async function handleTelephony(request, path) {
    const match = path.match(/^\/api\/telephony\/([^/]+)\/([^/]+)$/);
    if (!match) return json({ ok: false, error: "not_found" }, 404);
    const kind = match[1];
    if (!TELEPHONY_KINDS.has(kind)) return json({ ok: false, error: "not_found" }, 404);
    if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

    let token = match[2];
    try {
      token = decodeURIComponent(token);
    } catch (_) {
      // keep the raw segment — a garbled token just fails the lookup below
    }

    const integration = (await sbGet(env, fetchImpl, `integrations?${sbEq(
      { webhook_token: token, kind },
      { select: "id,org_id,kind,enabled", limit: "1" }
    )}`))?.[0];
    // Token miss, kind mismatch and a DISABLED integration all look identical
    // from outside — no oracle, and `enabled` is the only kill switch for a
    // leaked webhook URL (there is no token-rotation route yet).
    if (!integration || integration.enabled !== true) return json({ ok: false }, 404);

    const body = await readWebhookBody(request);
    if (body === null) return json({ ok: false }, 413);
    if (!isCompletedCallEvent(kind, body)) return json({ ok: true, ignored: true });

    const org = (await sbGet(env, fetchImpl, `organizations?${sbEq(
      { id: integration.org_id },
      { select: "id,timezone", limit: "1" }
    )}`))?.[0];

    let event;
    try {
      // Chicken-and-egg: the tz offset depends on the event moment, which is
      // itself inside the payload. First pass with offset 0 pins the instant
      // to within one offset (fine for DST purposes), second pass is final.
      const draft = normalizeEvent(kind, body, { tzOffsetMinutes: 0 });
      const at = draft.startedAt ? new Date(draft.startedAt) : new Date();
      event = normalizeEvent(kind, body, {
        tzOffsetMinutes: zoneOffsetMinutes(org?.timezone, at)
      });
    } catch (_) {
      // A completed event with no call id can never be stored; acknowledge
      // it so the vendor stops redelivering a payload that will never parse.
      return json({ ok: true, ignored: true });
    }

    const members = (await sbGet(env, fetchImpl, `memberships?${sbEq(
      { org_id: integration.org_id, status: "active" },
      { select: "user_id,extension,full_name,department_id" }
    )}`)) || [];
    const resolved = resolveManager(event, members);

    // ignore-duplicates + the (org_id, source, external_id) unique index make
    // vendor redelivery idempotent: the second POST inserts nothing.
    await sbPost(env, fetchImpl, `calls?${new URLSearchParams({ on_conflict: "org_id,source,external_id" })}`, {
      headers: { prefer: "resolution=ignore-duplicates" },
      body: {
        org_id: integration.org_id,
        source: kind,
        // Clamped: these come from an unauthenticated-beyond-token POST and
        // land in unbounded text columns.
        external_id: String(event.externalId).slice(0, 64),
        direction: event.direction,
        customer_phone: String(event.customerPhone || "").slice(0, 32),
        manager_id: resolved?.user_id || null,
        manager_label: String(event.managerLabel || "").slice(0, 200),
        department_id: resolved?.department_id || null,
        started_at: event.startedAt,
        duration_sec: event.durationSec,
        recording_url: event.recordingUrl ? String(event.recordingUrl).slice(0, 2000) : null,
        status: "pending"
      }
    });
    // The raw payload lands in the audit trail so the first live event from a
    // new PBX can be diffed against the mapping without re-instrumenting.
    await sbPost(env, fetchImpl, "audit_log", {
      body: {
        org_id: integration.org_id,
        action: "telephony.event",
        target: event.externalId,
        meta: { kind, raw: JSON.stringify(event.raw).slice(0, 8000) }
      }
    });
    await sbPatch(env, fetchImpl, `integrations?${sbEq({ id: integration.id })}`, {
      body: { last_event_at: new Date().toISOString() }
    });

    return json({ ok: true });
  }

  // --- dispatch ------------------------------------------------------------

  async function handleApp(request, path) {
    const method = request.method;

    // Public onboarding endpoints — the caller has no session yet by
    // definition, so these dispatch BEFORE the bearer check. Each one gates
    // itself instead: a valid invite token or the signup code.
    if (path === "/api/app/join" && method === "POST") return join(request);
    if (path === "/api/app/register-org" && method === "POST") return registerOrg(request);

    const user = await getUser(request, env, fetchImpl, tokenCache);
    if (!user) return json({ error: "unauthorized" }, 401);

    if (path === "/api/app/me" && method === "GET") return me(user);
    if (path === "/api/app/join-authed" && method === "POST") return joinAuthed(request, user);
    if (path === "/api/app/orgs" && method === "POST") return createOrgAuthed(request, user);

    const orgMatch = path.match(/^\/api\/app\/orgs\/([^/]+)\/(.+)$/);
    if (!orgMatch) return json({ error: "not_found" }, 404);

    const orgId = orgMatch[1];
    const rest = orgMatch[2];
    // Validated BEFORE any query: a non-UUID here is either a typo or an
    // attempt to smuggle operators into a PostgREST filter.
    if (!UUID_RE.test(orgId)) return json({ error: "bad_org_id" }, 400);

    const membership = await activeMembership(orgId, user.id);
    if (!membership) return json({ error: "not_a_member" }, 403);

    if (rest === "analyze" && method === "POST") return analyze(request, orgId, user, membership);
    if (rest === "ai-key" && method === "GET") return getAiKey(orgId, membership);
    if (rest === "ai-key" && method === "PUT") return putAiKey(request, orgId, user, membership);
    if (rest === "members" && method === "GET") return listMembers(orgId);
    if (rest === "members" && method === "POST") return addMember(request, orgId, user, membership);
    if (rest === "integrations" && method === "GET") return listIntegrations(orgId, membership);
    return json({ error: "not_found" }, 404);
  }

  async function handle(request) {
    const path = new URL(request.url).pathname;
    if (!/^\/api\/(app|telephony)(\/|$)/.test(path)) return null;

    // CORS preflight stays with the host worker, which already answers
    // OPTIONS with its configured CORS headers for every /api/* path.
    if (request.method === "OPTIONS") return null;

    if (!isConfigured()) return json({ error: "saas_not_configured" }, 503);

    try {
      if (path.startsWith("/api/telephony")) return await handleTelephony(request, path);
      return await handleApp(request, path);
    } catch (_) {
      // Anything unexpected (Supabase down, malformed rows) ends here.
      // Deliberately detail-free: sb errors carry body snippets that belong
      // in logs, not in an HTTP response.
      return json({ error: "internal_error" }, 500);
    }
  }

  return { handle };
}
