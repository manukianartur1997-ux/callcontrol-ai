// Formatting and mapping helpers shared by all screens. Pure functions only.
import { copy } from "./copy.js";

// 245 -> "4:05". Null-safe: unknown duration renders as a dash.
export function fmtDuration(sec) {
  if (sec == null || Number.isNaN(Number(sec))) return copy.common.dash;
  const s = Math.max(0, Math.round(Number(sec)));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function fmtDateTime(iso) {
  if (!iso) return copy.common.dash;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return copy.common.dash;
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function fmtDate(iso) {
  if (!iso) return copy.common.dash;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return copy.common.dash;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Russian one/few/many: pluralRu(3, copy.plurals.calls) -> "звонка".
export function pluralRu(n, [one, few, many]) {
  const abs = Math.abs(n) % 100;
  const d = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (d === 1) return one;
  if (d >= 2 && d <= 4) return few;
  return many;
}

// Shared score thresholds: >=70 good, 40-69 mid, <40 bad.
export function scoreTone(score) {
  if (score == null) return "none";
  if (score >= 70) return "good";
  if (score >= 40) return "mid";
  return "bad";
}

// analyses come embedded unordered; a call re-analyzed twice has two rows and
// the freshest one wins everywhere in the UI.
export function latestAnalysis(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return [...list].sort(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
  )[0];
}

// Resolve the display name for a call row: mapped member first, then the
// hand-typed PBX label, then "not assigned".
export function managerName(call, membersByUserId) {
  if (call.manager_id && membersByUserId?.[call.manager_id]?.full_name) {
    return membersByUserId[call.manager_id].full_name;
  }
  if (call.manager_label) return call.manager_label;
  return copy.calls.unassigned;
}

// { status, error } from apiFetch, a supabase-js error, or a bare code string
// -> human Russian text. Unknown codes fall through to the generic message
// with the code appended so support can still identify the failure.
export function humanApiError(err) {
  const map = copy.errors;
  const code =
    typeof err === "string" ? err : (err && (err.error || err.code)) || "";
  if (code && typeof code === "string") {
    if (map[code]) return map[code];
    if (code.includes("_http_")) return map.providerHttp.replace("{code}", code);
    if (code === "23505") return map.conflict; // postgres unique violation
  }
  const status = err && err.status;
  if (status === 401 || code === "http_401") return map.unauthorized;
  if (status === 403 || code === "http_403") return map.forbidden;
  const suffix = code ? ` (${code})` : status ? ` (${status})` : "";
  return map.generic.replace("{code}", suffix);
}
