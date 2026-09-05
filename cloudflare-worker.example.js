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
import { createApi, dailyDigest, purgeExpiredData } from "./saas/worker/api.js";

// SaaS cabinet + telephony webhooks (saas/worker/api.js). Created lazily on
// the first request and kept for the isolate's lifetime so its auth token
// cache survives between requests. handle() returns null for every route it
// does not own (including OPTIONS preflights), so all pre-existing routes
// below keep working unchanged.
let saasApi = null;

export default {
  async fetch(request, env, ctx) {
    saasApi = saasApi || createApi({ env });
    // ctx carries waitUntil: the telephony webhook uses it to run its ingest
    // pipeline after the ack without blocking the response.
    const saasResponse = await saasApi.handle(request, ctx);
    if (saasResponse) return saasResponse;

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
  },

  // Cron entry (wrangler.toml [triggers]), branched by event.cron so the two
  // triggers each do their own job — running the daily jobs on every 30-minute
  // tick would resend the exact same digest over and over.
  //   "0 17 * * *"    dailyDigest (per-org Telegram digest), purgeExpiredData
  //                   (retention scrub), platformDigest (operator summary).
  //   "*/30 * * * *"  sweepStuckCalls (self-healing retry for stuck calls).
  // Every job is silent-no-op-safe (missing secret/migration) and
  // allSettled + a per-job catch keep one failing job, or a partial
  // Telegram/Supabase outage, from surfacing as a failed cron run or blocking
  // the others.
  async scheduled(event, env, ctx) {
    saasApi = saasApi || createApi({ env });
    const jobs = [saasApi.sweepStuckCalls().catch(() => {})];
    if (event.cron === "0 17 * * *") {
      jobs.push(dailyDigest(env).catch(() => {}));
      jobs.push(purgeExpiredData(env).catch(() => {}));
      jobs.push(saasApi.platformDigest().catch(() => {}));
    }
    await Promise.allSettled(jobs);
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
