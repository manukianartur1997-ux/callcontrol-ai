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
export async function apiFetch(path, { method = "GET", body } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token || "";
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

export function requestAnalyze(orgId, callId) {
  return apiFetch(`/orgs/${orgId}/analyze`, { method: "POST", body: { call_id: callId } });
}

export function fetchAiKey(orgId) {
  return apiFetch(`/orgs/${orgId}/ai-key`);
}

export function saveAiKey(orgId, body) {
  return apiFetch(`/orgs/${orgId}/ai-key`, { method: "PUT", body });
}

export function fetchIntegrations(orgId) {
  return apiFetch(`/orgs/${orgId}/integrations`);
}

export function createMember(orgId, body) {
  return apiFetch(`/orgs/${orgId}/members`, { method: "POST", body });
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
      plan: m.plan || m.org?.plan || null
    }))
    .filter((m) => m.org_id);
}
