const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return json({ ok: true }, 204);
    if (url.pathname === "/api/health") return json({ ok: true, runtime: "cloudflare-worker-assets" });

    if (request.method === "POST" && url.pathname === "/api/leads") {
      return createLead(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/leads") {
      return listLeads(request, env);
    }

    if (request.method === "GET" && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return json({ ok: false, error: "not_found" }, 404);
  }
};

async function createLead(request, env) {
  try {
    const input = await request.json();
    const lead = normalizeLead(input);
    const errors = validateLead(lead);
    const needsClarification = getClarificationFields(lead);

    if (errors.length) {
      return json({ ok: false, errors }, 400);
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
    }, 201);
  } catch (error) {
    return json({ ok: false, error: "lead_create_failed" }, 500);
  }
}

async function listLeads(request, env) {
  const url = new URL(request.url);
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || url.searchParams.get("token");

  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  if (!env.LEADS_KV) return json({ ok: false, error: "leads_kv_not_configured", leads: [] }, 501);

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
    return csv(leads);
  }

  return json({ ok: true, leads });
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

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders
    }
  });
}

function csv(leads) {
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
      ...corsHeaders
    }
  });
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
