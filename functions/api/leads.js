import {
  normalizeLead,
  validateLead,
  saveLeadToKv,
  listAllLeadsFromKv,
  sendTelegramLead,
  leadsToCsv,
  isAdminAuthorized
} from "../../lib/lead.js";

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

    const storage = await saveLeadToKv(env.LEADS_KV, lead);
    const telegram = await sendTelegramLead(env, lead);
    return json({
      ok: true,
      lead,
      stored: storage.stored,
      storageError: storage.error || null,
      telegramSent: telegram.sent,
      telegramError: telegram.error || null,
      needsClarification: lead.needsClarification
    }, 201);
  } catch (error) {
    return json({ ok: false, error: error.message || "server_error" }, 500);
  }
}

export async function onRequestGet({ request, env }) {
  // Fail closed: if ADMIN_TOKEN is not configured (or the presented token is
  // wrong), access is always denied. Never fall through to an open listing.
  if (!isAdminAuthorized(request, env)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  if (!env.LEADS_KV) {
    return json({ ok: false, error: "kv_not_configured" }, 501);
  }

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
