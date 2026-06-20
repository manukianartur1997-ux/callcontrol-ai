// Same-origin by default. Add extra public origins via env.ALLOWED_ORIGINS
// (comma-separated). Wide-open "*" is intentionally avoided for the lead form.
function resolveOrigin(request, env) {
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
  if (allowed.includes(origin)) return origin;
  return null;
}

function corsHeadersFor(request, env) {
  const headers = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    Vary: "Origin"
  };
  const origin = resolveOrigin(request, env);
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

// Anti-spam tuning. Override via env if needed.
const RATE_LIMIT_MAX = 5; // leads per IP per window
const RATE_LIMIT_WINDOW_SECONDS = 600; // 10 minutes
const MIN_FILL_MS = 2500; // forms submitted faster than this are almost always bots

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeadersFor(request, env);

    if (request.method === "OPTIONS") return json({ ok: true }, 204, cors);
    if (url.pathname === "/api/health") return json({ ok: true, runtime: "cloudflare-worker-assets" }, 200, cors);

    if (request.method === "POST" && url.pathname === "/api/leads") {
      return createLead(request, env, cors);
    }

    if (request.method === "GET" && url.pathname === "/api/leads") {
      return listLeads(request, env, cors);
    }

    if (request.method === "GET" && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return json({ ok: false, error: "not_found" }, 404, cors);
  }
};

function clientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

// KV-backed sliding-window counter. No-ops gracefully if KV is not bound.
async function checkRateLimit(env, ip) {
  if (!env.LEADS_KV || ip === "unknown") return { limited: false };
  const max = Number(env.RATE_LIMIT_MAX) || RATE_LIMIT_MAX;
  const windowSeconds = Number(env.RATE_LIMIT_WINDOW_SECONDS) || RATE_LIMIT_WINDOW_SECONDS;
  const key = `rl:lead:${ip}`;
  try {
    const current = Number((await env.LEADS_KV.get(key)) || 0);
    if (current >= max) return { limited: true };
    await env.LEADS_KV.put(key, String(current + 1), { expirationTtl: windowSeconds });
    return { limited: false };
  } catch (_) {
    // If KV fails, fail open rather than block real leads.
    return { limited: false };
  }
}

// Returns a reason string if the submission looks like spam, else null.
function spamReason(input, env) {
  // Honeypot: hidden field that humans never see/fill.
  if (clean(input.company_website || input.fax || input._gotcha)) return "honeypot";
  // Time-on-page: real users take a few seconds to fill the form.
  const minFill = Number(env.MIN_FILL_MS) || MIN_FILL_MS;
  const elapsed = Number(input.formElapsedMs);
  if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < minFill) return "too_fast";
  // Crude link-spam guard on the free-text field.
  const linkCount = (String(input.pain || "").match(/https?:\/\//gi) || []).length;
  if (linkCount >= 3) return "link_spam";
  return null;
}

async function createLead(request, env, cors) {
  try {
    const input = await request.json();

    // Anti-spam: honeypot + minimum fill time. Return 200 so bots get no signal.
    const reason = spamReason(input, env);
    if (reason) {
      return json({ ok: true, leadId: null, status: "ignored", message: "Lead accepted" }, 200, cors);
    }

    // Rate limit per IP.
    const ip = clientIp(request);
    const rate = await checkRateLimit(env, ip);
    if (rate.limited) {
      return json({ ok: false, error: "rate_limited", message: "Too many requests. Please try again later." }, 429, cors);
    }

    const lead = normalizeLead(input);
    const errors = validateLead(lead);
    const needsClarification = getClarificationFields(lead);

    if (errors.length) {
      return json({ ok: false, errors }, 400, cors);
    }

    const storage = await saveLead(env, lead);
    const telegram = await sendTelegramLead(env, lead);

    return json({
      ok: true,
      leadId: lead.id,
      status: lead.status,
      stored: storage.stored,
      storageError: storage.error || null,
      telegramSent: telegram.sent,
      telegramError: telegram.error || null,
      needsClarification,
      message: "Lead accepted"
    }, 201, cors);
  } catch (error) {
    return json({ ok: false, error: "lead_create_failed" }, 500, cors);
  }
}

async function listLeads(request, env, cors) {
  const url = new URL(request.url);
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || url.searchParams.get("token");

  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return json({ ok: false, error: "unauthorized" }, 401, cors);
  }

  if (!env.LEADS_KV) return json({ ok: false, error: "leads_kv_not_configured", leads: [] }, 501, cors);

  const leads = [];
  let cursor;

  do {
    const list = await env.LEADS_KV.list({ prefix: "lead:", limit: 100, cursor });
    cursor = list.cursor;

    for (const key of list.keys) {
      const value = await env.LEADS_KV.get(key.name, "json");
      if (value) leads.push(value);
    }
  } while (cursor);

  leads.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  if (url.searchParams.get("format") === "csv") {
    return csv(leads, cors);
  }

  return json({ ok: true, leads }, 200, cors);
}

async function saveLead(env, lead) {
  if (!env.LEADS_KV) return { stored: false, error: "kv_not_configured" };

  try {
    await env.LEADS_KV.put(`lead:${lead.createdAt}:${lead.id}`, JSON.stringify(lead), {
      metadata: {
        status: lead.status,
        company: lead.company,
        contact: lead.contact
      }
    });
    return { stored: true };
  } catch (error) {
    return { stored: false, error: "kv_error" };
  }
}

function normalizeLead(input) {
  const website = clean(input.website || input.site);
  const dataLink = clean(input.dataLink || input.data_link || input.data || input.audioLink || input.transcriptLink);
  const teamSize = clean(input.teamSize || input.team_size || input.team);

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    source: clean(input.source || "callcontrol-demo-room"),
    status: "01_NEW",
    name: clean(input.name),
    role: clean(input.role),
    contact: clean(input.contact || input.telegram || input.phone || input.email),
    company: clean(input.company),
    site: website,
    website,
    team: teamSize,
    teamSize,
    niche: clean(input.niche),
    pain: clean(input.pain),
    dataFormat: clean(input.dataFormat || input.data_format || input.format),
    data: dataLink,
    dataLink,
    language: clean(input.language)
  };
}

function validateLead(lead) {
  const errors = [];
  if (!lead.name) errors.push("name_required");
  if (!lead.contact) errors.push("contact_required");
  if (!lead.company) errors.push("company_required");
  return errors;
}

function getClarificationFields(lead) {
  return [
    ["site", lead.website],
    ["data", lead.dataLink],
    ["pain", lead.pain]
  ].filter(([, value]) => !value).map(([key]) => key);
}

async function sendTelegramLead(env, lead) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return { sent: false, error: "telegram_env_missing" };
  }

  try {
    const text = [
      "🚀 Новая заявка: CallControl AI",
      "",
      `👤 Имя: ${lead.name}`,
      `📱 Контакт: ${lead.contact}`,
      `🏢 Компания: ${lead.company}`,
      lead.website ? `🌐 Сайт: ${lead.website}` : "",
      lead.role ? `🧑‍💼 Роль: ${lead.role}` : "",
      lead.teamSize ? `👥 Команда: ${lead.teamSize}` : "",
      lead.niche ? `📈 Ниша: ${lead.niche}` : "",
      lead.dataFormat ? `🎧 Формат: ${lead.dataFormat}` : "",
      lead.dataLink ? `🔗 Данные: ${lead.dataLink}` : "",
      lead.pain ? `❓ Боль: ${lead.pain}` : "",
      "",
      "🛠 Статус: 01_NEW"
    ].filter(Boolean).join("\n");

    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        disable_web_page_preview: true
      })
    });

    if (!response.ok) {
      return { sent: false, error: "telegram_failed" };
    }

    return { sent: true };
  } catch (error) {
    return { sent: false, error: "telegram_failed" };
  }
}

function clean(value) {
  return String(value || "").trim().slice(0, 1200);
}

function json(payload, status = 200, cors = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...cors
    }
  });
}

function csv(leads, cors = {}) {
  const headers = ["createdAt", "status", "name", "role", "contact", "company", "website", "teamSize", "niche", "pain", "dataFormat", "dataLink"];
  const body = [
    headers.join(","),
    ...leads.map((lead) => headers.map((key) => csvCell(lead[key])).join(","))
  ].join("\n");

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"callcontrol-cloudflare-leads.csv\"",
      ...cors
    }
  });
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
