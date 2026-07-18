import {
  normalizeLead,
  validateLead,
  saveLeadToKv,
  listAllLeadsFromKv,
  sendTelegramLead,
  leadsToCsv,
  isAdminAuthorized,
  spamReason,
  clientIp,
  checkKvRateLimit,
  corsHeadersFor
} from "../../lib/lead.js";

export async function onRequestOptions({ request, env }) {
  return json({ ok: true }, 204, corsHeadersFor(request, env));
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeadersFor(request, env);
  try {
    const input = await request.json();

    // Anti-spam: honeypot + minimum fill time + link-stuffing. Respond 200
    // "accepted" so bots get no signal they were filtered out.
    if (spamReason(input, env)) {
      return json({ ok: true, stored: false, status: "ignored" }, 200, cors);
    }

    const rate = await checkKvRateLimit(env.LEADS_KV, clientIp(request), env);
    if (rate.limited) {
      return json({ ok: false, error: "rate_limited" }, 429, cors);
    }

    const lead = normalizeLead(input);
    const errors = validateLead(lead);
    if (errors.length) {
      return json({ ok: false, errors }, 400, cors);
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
    }, 201, cors);
  } catch (error) {
    return json({ ok: false, error: error.message || "server_error" }, 500, cors);
  }
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeadersFor(request, env);
  // Fail closed: if ADMIN_TOKEN is not configured (or the presented token is
  // wrong), access is always denied. Never fall through to an open listing.
  if (!isAdminAuthorized(request, env)) {
    return json({ ok: false, error: "unauthorized" }, 401, cors);
  }
  if (!env.LEADS_KV) {
    return json({ ok: false, error: "kv_not_configured" }, 501, cors);
  }

  const leads = await listAllLeadsFromKv(env.LEADS_KV);

  const url = new URL(request.url);
  if (url.searchParams.get("format") === "csv") {
    return csv(leads, cors);
  }
  return json({ ok: true, leads }, 200, cors);
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
  return new Response(leadsToCsv(leads), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"callcontrol-cloudflare-leads.csv\"",
      ...cors
    }
  });
}
