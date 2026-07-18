// Shared lead-intake module used by:
//   - server.js (local Node demo backend, imported via dynamic import())
//   - cloudflare-worker.example.js (Cloudflare Worker, deployed via `wrangler deploy`)
//   - functions/api/leads.js (Cloudflare Pages Function)
//
// Kept dependency-free and runtime-agnostic (only Web-standard `crypto` and
// `fetch`, both available as globals in Node >=18 and in Cloudflare
// Workers/Pages), so the same file can be `import`-ed unmodified from all
// three environments instead of re-implementing this logic three times.

const EMAIL_RE = /[^\s<>()]+@[^\s<>()]+\.[^\s<>()]+/;

export const LEAD_CSV_HEADERS = [
  "createdAt",
  "status",
  "name",
  "role",
  "contact",
  "email",
  "company",
  "website",
  "teamSize",
  "niche",
  "pain",
  "dataFormat",
  "audioLink",
  "transcriptLink",
  "dataLink",
  "needsClarification"
];

export function clean(value) {
  return String(value ?? "").trim().slice(0, 1200);
}

function extractEmail(value) {
  const match = String(value || "").match(EMAIL_RE);
  return match ? match[0] : "";
}

function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Extremely defensive fallback; every supported runtime here has crypto.randomUUID.
  return `lead_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// Canonical lead shape. Every backend variant should produce/consume this
// exact set of field names so admin/export/report tooling does not need
// per-backend aliasing.
export function normalizeLead(input = {}) {
  const contact = clean(input.contact || input.telegram || input.phone || input.email);
  const email = clean(input.email) || extractEmail(contact);
  const audioLink = clean(input.audioLink || input.audio_link);
  const transcriptLink = clean(input.transcriptLink || input.transcript_link);
  const dataLink = clean(input.dataLink || input.data_link || input.data) || audioLink || transcriptLink;
  const website = clean(input.website || input.site);
  const teamSize = clean(input.teamSize || input.team_size || input.team);

  const lead = {
    id: newId(),
    createdAt: new Date().toISOString(),
    status: "01_NEW",
    source: clean(input.source) || "callcontrol-demo-room",
    name: clean(input.name),
    role: clean(input.role),
    contact,
    email,
    company: clean(input.company),
    website,
    teamSize,
    niche: clean(input.niche),
    pain: clean(input.pain),
    dataFormat: clean(input.dataFormat || input.data_format || input.format),
    audioLink,
    transcriptLink,
    dataLink,
    language: clean(input.language),
    userAgent: clean(input.userAgent)
  };

  lead.needsClarification = getClarificationFields(lead);
  return lead;
}

// Fields that are useful but optional; surfaced so an operator knows what to
// follow up on before the audit can start.
export function getClarificationFields(lead) {
  return [
    ["website", lead.website],
    ["dataLink", lead.dataLink],
    ["pain", lead.pain]
  ].filter(([, value]) => !value).map(([key]) => key);
}

export function validateLead(lead) {
  const errors = [];
  if (!lead.name) errors.push("name_required");
  if (!lead.contact && !lead.email) errors.push("contact_required");
  if (!lead.company) errors.push("company_required");
  return errors;
}

export function buildTelegramLeadText(lead) {
  return [
    "🚀 Новая заявка: CallControl AI",
    "",
    `👤 Имя: ${lead.name}`,
    `📱 Контакт: ${lead.contact}`,
    lead.email ? `✉️ Email: ${lead.email}` : "",
    `🏢 Компания: ${lead.company}`,
    lead.website ? `🌐 Сайт: ${lead.website}` : "",
    lead.role ? `🧑‍💼 Роль: ${lead.role}` : "",
    lead.teamSize ? `👥 Команда: ${lead.teamSize}` : "",
    lead.niche ? `📈 Ниша: ${lead.niche}` : "",
    lead.dataFormat ? `🎧 Формат: ${lead.dataFormat}` : "",
    lead.audioLink ? `🎙 Аудио: ${lead.audioLink}` : "",
    lead.transcriptLink ? `📝 Транскрипт: ${lead.transcriptLink}` : "",
    lead.dataLink && lead.dataLink !== lead.audioLink && lead.dataLink !== lead.transcriptLink
      ? `🔗 Данные: ${lead.dataLink}`
      : "",
    lead.pain ? `❓ Боль: ${lead.pain}` : "",
    lead.needsClarification?.length ? `⚠️ Уточнить: ${lead.needsClarification.join(", ")}` : "",
    "",
    "🛠 Статус: 01_NEW"
  ].filter(Boolean).join("\n");
}

// `env` just needs TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID properties - works
// with a Cloudflare `env` binding object or Node's `process.env` alike.
export async function sendTelegramLead(env, lead, fetchImpl = fetch) {
  const token = env?.TELEGRAM_BOT_TOKEN;
  const chatId = env?.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { sent: false, error: "telegram_env_missing" };

  try {
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildTelegramLeadText(lead),
        disable_web_page_preview: true
      })
    });
    if (!response.ok) {
      return { sent: false, error: await response.text() };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error.message || "telegram_failed" };
  }
}

export function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function leadsToCsv(leads, headers = LEAD_CSV_HEADERS) {
  const rows = leads.map((lead) => headers.map((key) => {
    const value = lead[key];
    return csvCell(Array.isArray(value) ? value.join("; ") : value);
  }).join(","));
  return [headers.join(","), ...rows].join("\n");
}

// Fail-closed admin auth check shared by every backend variant: if the admin
// token cannot be verified (not configured), access is DENIED, never granted.
export function isAdminAuthorized(request, env) {
  if (!env?.ADMIN_TOKEN) return false;
  const url = new URL(request.url);
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || url.searchParams.get("token");
  return token === env.ADMIN_TOKEN;
}

export async function saveLeadToKv(kv, lead) {
  if (!kv) return { stored: false, error: "kv_not_configured" };
  try {
    await kv.put(`lead:${lead.createdAt}:${lead.id}`, JSON.stringify(lead), {
      metadata: {
        status: lead.status,
        company: lead.company,
        contact: lead.contact
      }
    });
    return { stored: true };
  } catch (error) {
    return { stored: false, error: error.message || "kv_error" };
  }
}

// Cursor-paginated KV listing: walks every page instead of the first 100
// keys only, so leads created after the first page are no longer invisible
// to the admin export.
export async function listAllLeadsFromKv(kv, prefix = "lead:") {
  const leads = [];
  let cursor;
  do {
    const list = await kv.list({ prefix, limit: 100, cursor });
    for (const key of list.keys) {
      const value = await kv.get(key.name, "json");
      if (value) leads.push(value);
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  leads.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return leads;
}

// ---- Anti-abuse (spam filtering + rate limiting) ----
// Shared by every backend variant so the public lead form has one consistent
// defense instead of three drifting copies. All tunables are overridable via
// `env` so they can be adjusted without a code change.
const DEFAULT_RATE_LIMIT_MAX = 5; // requests per IP per window
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 600; // 10 minutes
const DEFAULT_MIN_FILL_MS = 2500; // real users take at least this long to fill the form

// Returns a reason string if the submission looks like spam, else null.
// Callers should still respond with a normal-looking 2xx on a spam verdict
// so bots get no signal that they were filtered (see onRequestPost below).
//  - "honeypot": a field hidden from real users that only bots fill in
//  - "too_fast": submitted faster than any human could fill the form
//  - "link_spam": the free-text field is stuffed with links
export function spamReason(input = {}, env = {}) {
  if (clean(input.company_website || input.fax || input._gotcha)) return "honeypot";
  const minFill = Number(env.MIN_FILL_MS) || DEFAULT_MIN_FILL_MS;
  const elapsed = Number(input.formElapsedMs);
  if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < minFill) return "too_fast";
  const linkCount = (String(input.pain || "").match(/https?:\/\//gi) || []).length;
  if (linkCount >= 3) return "link_spam";
  return null;
}

export function clientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

// KV-backed sliding-window counter for the Cloudflare runtimes. No-ops
// (never blocks) if no KV namespace is bound, so a missing/unconfigured
// namespace fails OPEN for lead capture rather than breaking it - unlike
// admin auth, which fails closed by design (see isAdminAuthorized above).
export async function checkKvRateLimit(kv, ip, env = {}) {
  if (!kv || !ip || ip === "unknown") return { limited: false };
  const max = Number(env.RATE_LIMIT_MAX) || DEFAULT_RATE_LIMIT_MAX;
  const windowSeconds = Number(env.RATE_LIMIT_WINDOW_SECONDS) || DEFAULT_RATE_LIMIT_WINDOW_SECONDS;
  const key = `rl:lead:${ip}`;
  try {
    const current = Number((await kv.get(key)) || 0);
    if (current >= max) return { limited: true };
    await kv.put(key, String(current + 1), { expirationTtl: windowSeconds });
    return { limited: false };
  } catch (_) {
    return { limited: false };
  }
}

// In-memory sliding-window limiter for the local Node dev server, which has
// no KV to back it. Not durable across restarts/deploys; good enough for
// local development only.
export function createMemoryRateLimiter(max = DEFAULT_RATE_LIMIT_MAX, windowMs = DEFAULT_RATE_LIMIT_WINDOW_SECONDS * 1000) {
  const hits = new Map();
  return function isRateLimited(ip) {
    if (!ip || ip === "unknown") return false;
    const now = Date.now();
    const entry = hits.get(ip);
    if (!entry || now - entry.start > windowMs) {
      hits.set(ip, { start: now, count: 1 });
      return false;
    }
    entry.count += 1;
    return entry.count > max;
  };
}

// ---- CORS lockdown ----
// Same-origin by default; widen with env.ALLOWED_ORIGINS (comma-separated).
// A wide-open "*" is intentionally avoided on the lead-intake endpoint so an
// arbitrary third-party site cannot script submissions against it.
export function resolveOrigin(request, env = {}) {
  const origin = request.headers.get("Origin") || "";
  if (!origin) return null;
  let requestHost = "";
  try {
    requestHost = new URL(request.url).host;
  } catch (_) {
    requestHost = "";
  }
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch (_) {
    return null;
  }
  if (originHost && originHost === requestHost) return origin;
  const allowed = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

export function corsHeadersFor(request, env = {}) {
  const headers = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    Vary: "Origin"
  };
  const origin = resolveOrigin(request, env);
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}
