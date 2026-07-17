import {
  normalizeLead,
  validateLead,
  saveLeadToKv,
  listAllLeadsFromKv,
  sendTelegramLead,
  leadsToCsv,
  isAdminAuthorized
} from "./lib/lead.js";

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

    if (errors.length) {
      return json({ ok: false, errors }, 400);
    }

    const storage = await saveLeadToKv(env.LEADS_KV, lead);
    const telegram = await sendTelegramLead(env, lead);

    return json({
      ok: true,
      leadId: lead.id,
      status: lead.status,
      stored: storage.stored,
      storageError: storage.error || null,
      telegramSent: telegram.sent,
      telegramError: telegram.error || null,
      needsClarification: lead.needsClarification,
      message: "Lead accepted"
    }, 201);
  } catch (error) {
    return json({ ok: false, error: "lead_create_failed" }, 500);
  }
}

async function listLeads(request, env) {
  // Fail closed: no configured/matching ADMIN_TOKEN => no listing, ever.
  if (!isAdminAuthorized(request, env)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  if (!env.LEADS_KV) return json({ ok: false, error: "leads_kv_not_configured", leads: [] }, 501);

  const leads = await listAllLeadsFromKv(env.LEADS_KV);

  const url = new URL(request.url);
  if (url.searchParams.get("format") === "csv") {
    return csv(leads);
  }

  return json({ ok: true, leads });
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
  return new Response(leadsToCsv(leads), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"callcontrol-cloudflare-leads.csv\"",
      ...corsHeaders
    }
  });
}
