// Same-origin by default; widen with env.ALLOWED_ORIGINS (comma-separated).
// Wide-open "*" is intentionally avoided for the lead form.
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

const RATE_LIMIT_MAX = 5; // leads per IP per window
const RATE_LIMIT_WINDOW_SECONDS = 600; // 10 minutes
const MIN_FILL_MS = 2500;

function clientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

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
    return { limited: false };
  }
}

function spamReason(input, env) {
  if (clean(input.company_website || input.fax || input._gotcha)) return "honeypot";
  const minFill = Number(env.MIN_FILL_MS) || MIN_FILL_MS;
  const elapsed = Number(input.formElapsedMs);
  if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < minFill) return "too_fast";
  const linkCount = (String(input.pain || "").match(/https?:\/\//gi) || []).length;
  if (linkCount >= 3) return "link_spam";
  return null;
}

export async function onRequestOptions({ request, env }) {
  return json({ ok: true }, 204, corsHeadersFor(request, env));
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeadersFor(request, env);
  try {
    const input = await request.json();

    // Anti-spam: honeypot + minimum fill time. Return 200 so bots get no signal.
    const reason = spamReason(input, env);
    if (reason) {
      return json({ ok: true, stored: false, status: "ignored" }, 200, cors);
    }

    const ip = clientIp(request);
    const rate = await checkRateLimit(env, ip);
    if (rate.limited) {
      return json({ ok: false, error: "rate_limited" }, 429, cors);
    }

    const lead = normalizeLead(input);
    const errors = validateLead(lead);
    if (errors.length) {
      return json({ ok: false, errors }, 400, cors);
    }

    const storage = await saveLead(env, lead);
    const telegram = await sendTelegramLead(env, lead);
    return json({
      ok: true,
      lead,
      stored: storage.stored,
      storageError: storage.error || null,
      telegramSent: telegram.sent,
      telegramError: telegram.error || null
    }, 201, cors);
  } catch (error) {
    return json({ ok: false, error: error.message || "server_error" }, 500, cors);
  }
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeadersFor(request, env);
  const url = new URL(request.url);
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || url.searchParams.get("token");
  if (env.ADMIN_TOKEN && token !== env.ADMIN_TOKEN) {
    return json({ ok: false, error: "unauthorized" }, 401, cors);
  }
  if (!env.LEADS_KV) {
    return json({ ok: false, error: "kv_not_configured" }, 501, cors);
  }

  const list = await env.LEADS_KV.list({ prefix: "lead:", limit: 100 });
  const leads = [];
  for (const key of list.keys) {
    const value = await env.LEADS_KV.get(key.name, "json");
    if (value) leads.push(value);
  }
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
    return { stored: false, error: error.message || "kv_error" };
  }
}

function normalizeLead(input) {
  return {
    id: crypto.randomUUID(),
    name: clean(input.name),
    role: clean(input.role),
    contact: clean(input.contact || input.telegram || input.phone),
    company: clean(input.company),
    website: clean(input.website || input.site),
    teamSize: clean(input.teamSize || input.team_size || input.team),
    niche: clean(input.niche),
    pain: clean(input.pain),
    dataFormat: clean(input.dataFormat || input.data_format),
    dataLink: clean(input.dataLink || input.data_link || input.data),
    source: clean(input.source || "demo_room"),
    status: "01_NEW",
    createdAt: new Date().toISOString()
  };
}

function validateLead(lead) {
  const errors = [];
  if (!lead.name) errors.push("name_required");
  if (!lead.contact) errors.push("contact_required");
  if (!lead.company) errors.push("company_required");
  return errors;
}

async function sendTelegramLead(env, lead) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return { sent: false, error: "telegram_env_missing" };
  }

  const text = [
    "🚀 Новая заявка: CallControl AI",
    "",
    `👤 Имя: ${lead.name}`,
    `📱 Контакт: ${lead.contact}`,
    `🏢 Компания: ${lead.company}`,
    lead.website ? `🌐 Сайт: ${lead.website}` : "",
    lead.role ? `🧑‍💼 Роль: ${lead.role}` : "",
    lead.teamSize ? `👥 Отдел: ${lead.teamSize}` : "",
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
    return { sent: false, error: await response.text() };
  }
  return { sent: true };
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
  const headers = ["createdAt", "status", "name", "role", "contact", "company", "website", "teamSize", "niche", "pain", "dataLink"];
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
