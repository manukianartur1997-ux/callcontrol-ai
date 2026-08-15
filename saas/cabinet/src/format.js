// Formatting and mapping helpers shared by all screens. Pure functions only.
// Everything locale-sensitive resolves the CURRENT locale at call time (see
// copy.js), so a locale switch changes dates, numbers and plurals on the very
// next render.
import { copy, getLocale } from "./copy.js";

// UI locale -> Intl locale tag for dates and number grouping.
const INTL_LOCALES = { uk: "uk-UA", ru: "ru-RU", en: "en-US" };

function intlLocale() {
  return INTL_LOCALES[getLocale()] || INTL_LOCALES.uk;
}

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
  return d.toLocaleString(intlLocale(), {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// 148000 -> "148 000" (uk/ru) / "148,000" (en). Whole numbers only — the
// money-at-risk figure is an estimate, decimals would fake precision it does
// not have.
export function fmtMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return copy.common.dash;
  return new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 0 }).format(Number(n));
}

export function fmtDate(iso) {
  if (!iso) return copy.common.dash;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return copy.common.dash;
  return d.toLocaleDateString(intlLocale(), { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Plural picker over a word-form array from copy.plurals: uk/ru dictionaries
// carry three forms [one, few, many] (the same East Slavic one/few/many rule
// covers both languages); the en dictionary carries two [one, other]. The
// forms array arrives from the live copy proxy, so the shape always matches
// the active locale. The historical name is kept to avoid churn in callers.
export function pluralRu(n, forms) {
  const abs = Math.abs(n);
  if (forms.length === 2) return abs === 1 ? forms[0] : forms[1];
  const [one, few, many] = forms;
  const mod100 = abs % 100;
  const mod10 = mod100 % 10;
  if (mod100 > 10 && mod100 < 20) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
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
// -> human text in the active locale. Unknown codes fall through to the
// generic message with the code appended so support can still identify the
// failure.
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
