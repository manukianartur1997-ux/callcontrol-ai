const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization"
};

export async function onRequestOptions() {
  return json({ ok: true }, 204);
}

export async function onRequestPost({ request, env }) {
  try {
    const input = await request.json();
    const lead = normalizeLead(input);
    const errors = validateLead(lead);
    if (errors.length) {
      return json({ ok: false, errors }, 400);
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
    }, 201);
  } catch (error) {
    return json({ ok: false, error: error.message || "server_error" }, 500);
  }
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || url.searchParams.get("token");
  if (env.ADMIN_TOKEN && token !== env.ADMIN_TOKEN) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  if (!env.LEADS_KV) {
    return json({ ok: false, error: "kv_not_configured" }, 501);
  }

  const list = await env.LEADS_KV.list({ prefix: "lead:", limit: 100 });
  const leads = [];
  for (const key of list.keys) {
    const value = await env.LEADS_KV.get(key.name, "json");
    if (value) leads.push(value);
  }
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
      ...corsHeaders
    }
  });
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
