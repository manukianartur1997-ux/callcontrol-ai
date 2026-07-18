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
} from "./lib/lead.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeadersFor(request, env);

    if (request.method === "OPTIONS") return json({ ok: true }, 204, cors);
    if (url.pathname === "/api/health") return json({ ok: true, runtime: "cloudflare-worker-assets" }, 200, cors);

    if (request.method === "POST" && url.pathname === "/api/beacon") {
      return recordBeacon(request, env, cors);
    }

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

async function createLead(request, env, cors) {
  try {
    const input = await request.json();

    // Anti-spam: honeypot + minimum fill time + link-stuffing. Respond 200
    // "accepted" so bots get no signal they were filtered out.
    if (spamReason(input, env)) {
      return json({ ok: true, leadId: null, status: "ignored", message: "Lead accepted" }, 200, cors);
    }

    const rate = await checkKvRateLimit(env.LEADS_KV, clientIp(request), env);
    if (rate.limited) {
      return json({ ok: false, error: "rate_limited", message: "Too many requests. Please try again later." }, 429, cors);
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
      leadId: lead.id,
      status: lead.status,
      stored: storage.stored,
      storageError: storage.error || null,
      telegramSent: telegram.sent,
      telegramError: telegram.error || null,
      needsClarification: lead.needsClarification,
      message: "Lead accepted"
    }, 201, cors);
  } catch (error) {
    return json({ ok: false, error: "lead_create_failed" }, 500, cors);
  }
}

// Privacy-sane first-party page-view beacon. No cookies, no IDs, and no
// IP/user-agent stored - only the page path, the referrer's origin, the page
// language, and a coarse device-width bucket (s/m/l), written to the
// PAGEVIEWS Workers Analytics Engine dataset (see wrangler.toml
// [[analytics_engine_datasets]]). Always answers 204 - analytics must never
// surface errors to the page - and degrades to a no-op when the binding is
// absent (e.g. a config without the dataset).
async function recordBeacon(request, env, cors) {
  try {
    if (env.PAGEVIEWS) {
      const input = await request.json().catch(() => ({}));
      const clip = (value, max) => String(value == null ? "" : value).slice(0, max);
      const pagePath = clip(input.path, 256) || "/";
      env.PAGEVIEWS.writeDataPoint({
        blobs: [pagePath, clip(input.ref, 256), clip(input.lang, 16), clip(input.vw, 4)],
        doubles: [1],
        indexes: [pagePath.slice(0, 96)]
      });
    }
  } catch (_) {
    // Swallow everything: a broken beacon must not become a broken page.
  }
  return new Response(null, { status: 204, headers: cors });
}

async function listLeads(request, env, cors) {
  // Fail closed: no configured/matching ADMIN_TOKEN => no listing, ever.
  if (!isAdminAuthorized(request, env)) {
    return json({ ok: false, error: "unauthorized" }, 401, cors);
  }

  if (!env.LEADS_KV) return json({ ok: false, error: "leads_kv_not_configured", leads: [] }, 501, cors);

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
