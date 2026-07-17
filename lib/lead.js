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
