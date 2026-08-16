// Same-origin Worker API client.
//
// Everything the browser must NOT do itself goes through these calls: reading
// membership context (the Worker is the gate for "does this user belong
// anywhere"), creating users, storing AI keys, listing webhook URLs and
// running analyses under the organization's key. Plain data reads go straight
// to Supabase and are scoped by RLS.
import { supabase } from "./supabase.js";
import { API_BASE } from "./config.js";
import { copy } from "./copy.js";

// JSON in / JSON out. Throws a plain { status, error } object on failure so
// screens can map the error code to human text (see format.js humanApiError).
//
// `auth: false` targets the no-auth endpoints (/join, /register-org): the
// Authorization header is skipped entirely — there is no session yet, and a
// stale one must not leak into a request that creates a fresh account.
export async function apiFetch(path, { method = "GET", body, auth = true } = {}) {
  let token = "";
  if (auth) {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token || "";
  }
  const headers = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";

  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch {
    // Network-level failure: there is no response to read a code from.
    throw { status: 0, error: "network" };
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null; // non-JSON body (e.g. an HTML error page) — keep the status
  }
  if (!res.ok) {
    throw { status: res.status, error: (payload && payload.error) || `http_${res.status}` };
  }
  return payload;
}

// ---------------------------------------------------------------------------
// Typed helpers — one per Worker endpoint the cabinet uses.
// ---------------------------------------------------------------------------
export function fetchMe() {
  return apiFetch("/me");
}

// Anonymous invite acceptance: creates the account AND the membership in one
// Worker call; the caller signs in with the same credentials afterwards.
export function joinWithInvite(body) {
  return apiFetch("/join", { method: "POST", body, auth: false });
}

// Invite acceptance for an already-signed-in user (e.g. arrived via Google).
export function joinAuthed(token) {
  return apiFetch("/join-authed", { method: "POST", body: { token } });
}

// Anonymous pilot signup: account + organization, gated by SIGNUP_CODE.
export function registerOrg(body) {
  return apiFetch("/register-org", { method: "POST", body, auth: false });
}

// Organization creation for an existing signed-in user (same signup gate).
export function createOrg(body) {
  return apiFetch("/orgs", { method: "POST", body });
}

export function requestAnalyze(orgId, callId) {
  return apiFetch(`/orgs/${orgId}/analyze`, { method: "POST", body: { call_id: callId } });
}

export function fetchAiKey(orgId) {
  return apiFetch(`/orgs/${orgId}/ai-key`);
}

export function saveAiKey(orgId, body) {
  return apiFetch(`/orgs/${orgId}/ai-key`, { method: "PUT", body });
}

// STT (speech-to-text) provider choice + Deepgram key. Reuses the ai-key
// credential pattern: GET only ever returns { provider, deepgram_configured,
// deepgram_hint } — the browser never sees a stored key. PUT accepts
// { provider: "gemini"|"deepgram", key? } (key only needed for Deepgram).
// Built in parallel with the Worker, so callers degrade on 404/501 (endpoint
// not shipped) and on 503 { error: "migration_required" } (pre-0005 schema).
export function fetchStt(orgId) {
  return apiFetch(`/orgs/${orgId}/stt`);
}

export function saveStt(orgId, body) {
  return apiFetch(`/orgs/${orgId}/stt`, { method: "PUT", body });
}

// Billing: current-month minutes/cost, a 6-month history and the editable
// per-minute rate + retention window. GET/PUT /orgs/:id/billing. Answers 503
// { error: "migration_required" } until migration 0005 is applied, and
// 404/501 until the Worker endpoint ships — the Billing screen degrades on
// both. PUT accepts { rate_per_minute?, retention_days? } (owner only).
export function fetchBilling(orgId) {
  return apiFetch(`/orgs/${orgId}/billing`);
}

export function saveBilling(orgId, body) {
  return apiFetch(`/orgs/${orgId}/billing`, { method: "PUT", body });
}

export function fetchIntegrations(orgId) {
  return apiFetch(`/orgs/${orgId}/integrations`);
}

// Recording upload: the audio travels base64-encoded in a JSON body (worker
// caps the payload at ~15MB); the Worker stores it, transcribes with Gemini
// STT and analyzes in one request — expect it to take minutes, not seconds.
export function uploadRecording(orgId, body) {
  return apiFetch(`/orgs/${orgId}/recordings`, { method: "POST", body });
}

// PBX credentials live encrypted in integration_secrets; GET only ever
// returns { configured, hints } — the browser never sees stored values.
export function fetchIntegrationCredentials(orgId, kind) {
  return apiFetch(`/orgs/${orgId}/integrations/${kind}/credentials`);
}

export function saveIntegrationCredentials(orgId, kind, fields) {
  return apiFetch(`/orgs/${orgId}/integrations/${kind}/credentials`, {
    method: "PUT",
    body: { fields }
  });
}

// Organization-level settings (avg_deal_amount, …). Answers 503
// { error: "migration_required" } until migration 0004 is applied.
export function saveOrgSettings(orgId, body) {
  return apiFetch(`/orgs/${orgId}/org-settings`, { method: "PUT", body });
}

// Telegram delivery recipients (table arrives with migration 0004): GET ->
// { recipients: [{ id, chat_id, kind, label }] }; PUT replaces the whole set
// (max 10). Both answer 503 { error: "migration_required" } until then.
export function fetchTelegramRecipients(orgId) {
  return apiFetch(`/orgs/${orgId}/telegram`);
}

export function saveTelegramRecipients(orgId, recipients) {
  return apiFetch(`/orgs/${orgId}/telegram`, { method: "PUT", body: { recipients } });
}

export function createMember(orgId, body) {
  return apiFetch(`/orgs/${orgId}/members`, { method: "POST", body });
}

// Rotate a telephony integration's webhook token. The old URL stops working
// immediately; the response carries the fresh { webhook_token, webhook_path }.
// Built in parallel with the Worker — callers degrade on 404/501.
export function rotateWebhookToken(orgId, kind) {
  return apiFetch(`/orgs/${orgId}/integrations/${kind}/rotate-token`, { method: "POST" });
}

// ---------------------------------------------------------------------------
// Scoring checklists — the stages/weights the AI grades a call against.
// items: [{ key, label, weight, hint }], weights summing to 100. Every helper
// degrades on 404/501 in the caller until the Worker endpoints ship.
// ---------------------------------------------------------------------------
export function fetchChecklists(orgId) {
  return apiFetch(`/orgs/${orgId}/checklists`);
}

export function fetchChecklist(orgId, cid) {
  return apiFetch(`/orgs/${orgId}/checklists/${cid}`);
}

export function createChecklist(orgId, body) {
  return apiFetch(`/orgs/${orgId}/checklists`, { method: "POST", body });
}

export function updateChecklist(orgId, cid, body) {
  return apiFetch(`/orgs/${orgId}/checklists/${cid}`, { method: "PUT", body });
}

export function makeChecklistDefault(orgId, cid) {
  return apiFetch(`/orgs/${orgId}/checklists/${cid}/make-default`, { method: "POST" });
}

export function deleteChecklist(orgId, cid) {
  return apiFetch(`/orgs/${orgId}/checklists/${cid}`, { method: "DELETE" });
}

// Usage counters for the org: current period + history. Shape tolerated
// defensively by the Usage screen. 404/501 until the Worker endpoint ships.
export function fetchUsage(orgId) {
  return apiFetch(`/orgs/${orgId}/usage`);
}

// ---------------------------------------------------------------------------
// Platform super-admin surface — only reachable when /me reports
// is_platform_admin. Read-only. 404/501/403 until the Worker endpoints ship.
// ---------------------------------------------------------------------------
export function fetchPlatformStats() {
  return apiFetch(`/platform/stats`);
}

export function fetchPlatformOrgs() {
  return apiFetch(`/platform/orgs`);
}

export function fetchPlatformOrg(orgId) {
  return apiFetch(`/platform/orgs/${orgId}`);
}

// The Worker wraps app.my_context() (see saas/migrations/0002_onboarding.sql),
// whose rows look like { org_id, org_name, org_slug, plan, role, ... }.
// Tolerate both the wrapped and the bare-array shape so the cabinet and the
// Worker can ship independently without breaking each other.
export function normalizeMe(raw) {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.memberships)
      ? raw.memberships
      : Array.isArray(raw?.orgs)
        ? raw.orgs
        : [];
  return list
    .map((m) => ({
      org_id: m.org_id || m.org?.id || null,
      org_name: m.org_name || m.org?.name || m.organization?.name || copy.common.orgFallback,
      role: m.role || "viewer",
      full_name: m.full_name || null,
      department_id: m.department_id || null,
      plan: m.plan || m.org?.plan || null,
      // Added by migration 0004; absent (null) until it lands. The dashboard
      // and settings must render fine either way.
      avg_deal_amount:
        m.avg_deal_amount ?? m.organization?.avg_deal_amount ?? m.org?.avg_deal_amount ?? null,
      ui_language: m.ui_language || m.organization?.ui_language || m.org?.ui_language || null
    }))
    .filter((m) => m.org_id);
}
