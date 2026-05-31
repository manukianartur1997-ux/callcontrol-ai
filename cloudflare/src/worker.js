export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return json({}, 204);
    if (url.pathname === "/api/health") return json({ ok: true, runtime: "cloudflare-worker" });
    if (request.method === "POST" && url.pathname === "/api/leads") return createLead(request, env);

    const auth = authorize(request, env);
    if (!auth.ok) return json({ ok: false, error: "unauthorized" }, 401);

    if (request.method === "GET" && url.pathname === "/api/leads") return listLeads(request, env);
    if (request.method === "GET" && url.pathname === "/api/state") return state(env);
    if (request.method === "GET" && url.pathname === "/api/me") return me(env);
    if (request.method === "POST" && url.pathname === "/api/invites") return createInvite(request, env);
    if (request.method === "POST" && url.pathname === "/api/invites/accept") return acceptInvite(request, env);
    if (request.method === "PATCH" && url.pathname === "/api/workspace") return updateWorkspace(request, env);
    if (request.method === "POST" && url.pathname === "/api/calls") return createCall(request, env);
    if (request.method === "POST" && url.pathname === "/api/calls/import-csv") return importCsv(request, env);
    if (request.method === "GET" && url.pathname === "/api/calls") return listCalls(request, env);
    if (request.method === "GET" && url.pathname === "/api/search") return searchCalls(request, env);
    if (request.method === "POST" && url.pathname === "/api/reports/mini-audit") return createReport(env);
    if (request.method === "GET" && url.pathname === "/api/billing/plans") return json({ ok: true, plans: billingPlans() });
    if (request.method === "POST" && url.pathname === "/api/billing/checkout") return createCheckout(request, env);
    if (request.method === "GET" && url.pathname === "/api/billing/usage") return billingUsage(env);
    if (request.method === "POST" && url.pathname === "/api/files/register") return registerFile(request, env);

    return json({ ok: false, error: "not_found" }, 404);
  },

  async queue(batch, env) {
    for (const message of batch.messages) {
      await analyzeQueuedCall(env, message.body.callId, message.body.organizationId || defaultOrg(env));
      message.ack();
    }
  }
};

function authorize(request, env) {
  if (!env.ADMIN_TOKEN) return { ok: true };
  const url = new URL(request.url);
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("X-App-Pin") || url.searchParams.get("token");
  return { ok: token === env.ADMIN_TOKEN };
}

async function me(env) {
  const organizationId = await ensureOrg(env);
  const [users, invites] = await Promise.all([
    env.DB.prepare("SELECT * FROM users WHERE organization_id = ? ORDER BY created_at DESC").bind(organizationId).all(),
    env.DB.prepare("SELECT id, email, role, status, created_at, accepted_at FROM invites WHERE organization_id = ? ORDER BY created_at DESC LIMIT 50").bind(organizationId).all()
  ]);
  return json({ ok: true, users: users.results.map(mapUser), invites: invites.results });
}

async function createInvite(request, env) {
  const organizationId = await ensureOrg(env);
  const input = await request.json();
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  const inviteId = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO invites (id, organization_id, email, role, token_hash, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).bind(inviteId, organizationId, input.email || "", input.role || "member", await sha256(token), now).run();
  return json({ ok: true, invite: { id: inviteId, email: input.email || "", role: input.role || "member", status: "pending" }, inviteUrl: `/client.html?invite=${token}` }, 201);
}

async function acceptInvite(request, env) {
  const organizationId = await ensureOrg(env);
  const input = await request.json();
  const tokenHash = await sha256(input.token || "");
  const invite = await env.DB.prepare("SELECT * FROM invites WHERE organization_id = ? AND token_hash = ? AND status = 'pending'")
    .bind(organizationId, tokenHash).first();
  if (!invite) return json({ ok: false, error: "invite_not_found" }, 404);
  const now = new Date().toISOString();
  const userId = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO users (id, organization_id, email, name, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
  `).bind(userId, organizationId, invite.email || input.email || "", input.name || invite.email || "New User", invite.role || "member", now, now).run();
  await env.DB.prepare("UPDATE invites SET status = 'accepted', accepted_at = ? WHERE id = ?").bind(now, invite.id).run();
  return json({ ok: true, user: { id: userId, email: invite.email, name: input.name || invite.email, role: invite.role } }, 201);
}

function billingPlans() {
  return [
    { id: "free", name: "Free Mini-Audit", priceUsd: 0, minutesLimit: 75, callsLimit: 5, description: "Проверка гипотезы и первый отчет." },
    { id: "scan_10", name: "Fatal Error Scan", priceUsd: 10, minutesLimit: 75, callsLimit: 5, description: "Быстрый платный разбор до 5 звонков." },
    { id: "pattern_50", name: "Pattern Search", priceUsd: 50, minutesLimit: 300, callsLimit: 20, description: "Поиск повторяющихся ошибок." },
    { id: "custom", name: "Custom Audit", priceUsd: null, minutesLimit: null, callsLimit: null, description: "Индивидуальный объем и внедрение." }
  ];
}

async function createCheckout(request, env) {
  const orgId = await ensureOrg(env);
  const input = await request.json();
  const plan = billingPlans().find((item) => item.id === input.planId) || billingPlans()[1];
  const now = new Date().toISOString();
  const invoiceId = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO invoices (id, organization_id, plan_id, plan_name, amount_usd, status, payment_provider, payment_note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?)
  `).bind(invoiceId, orgId, plan.id, plan.name, plan.priceUsd, plan.priceUsd === 0 ? "free" : "manual_payment_pending", "Manual payment link required", now, now).run();
  await env.DB.prepare("UPDATE subscriptions SET plan = ?, status = ?, minutes_limit = ?, updated_at = ? WHERE organization_id = ?")
    .bind(plan.id, plan.priceUsd === 0 ? "trial" : "pending_payment", plan.minutesLimit || 75, now, orgId).run();
  return json({ ok: true, invoice: { id: invoiceId, planId: plan.id, planName: plan.name, amountUsd: plan.priceUsd } }, 201);
}

async function billingUsage(env) {
  const orgId = await ensureOrg(env);
  const [subscription, invoices] = await Promise.all([
    env.DB.prepare("SELECT * FROM subscriptions WHERE organization_id = ?").bind(orgId).first(),
    env.DB.prepare("SELECT * FROM invoices WHERE organization_id = ? ORDER BY created_at DESC LIMIT 20").bind(orgId).all()
  ]);
  return json({ ok: true, subscription, invoices: invoices.results });
}

async function registerFile(request, env) {
  const orgId = await ensureOrg(env);
  const input = await request.json();
  const now = new Date().toISOString();
  const fileId = crypto.randomUUID();
  const r2Key = input.r2Key || `${orgId}/${fileId}/${input.name || "call-audio"}`;
  await env.DB.prepare(`
    INSERT INTO files (id, organization_id, call_id, name, type, size_bytes, status, storage, r2_key, external_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'registered', ?, ?, ?, ?, ?)
  `).bind(fileId, orgId, input.callId || null, input.name || "call-audio", input.type || "audio", Number(input.sizeBytes || 0), input.url ? "external_url" : "r2", r2Key, input.url || null, now, now).run();
  return json({ ok: true, file: { id: fileId, r2Key, status: "registered" } }, 201);
}

async function ensureOrg(env) {
  const now = new Date().toISOString();
  const orgId = defaultOrg(env);
  await env.DB.prepare(`
    INSERT OR IGNORE INTO organizations (id, name, industry, country, language, status, created_at, updated_at)
    VALUES (?, 'CallControl AI Demo', 'sales', 'UA', 'ru', 'trial', ?, ?)
  `).bind(orgId, now, now).run();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO subscriptions (organization_id, plan, status, minutes_limit, minutes_used, updated_at)
    VALUES (?, 'demo', 'trial', 75, 0, ?)
  `).bind(orgId, now).run();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO users (id, organization_id, email, name, role, status, created_at, updated_at)
    VALUES ('usr_owner', ?, 'owner@example.com', 'Owner', 'owner', 'active', ?, ?)
  `).bind(orgId, now, now).run();
  return orgId;
}

async function createLead(request, env) {
  const input = await request.json();
  const lead = normalizeLead(input);
  if (!lead.name || !lead.contact || !lead.company) return json({ ok: false, error: "missing_required_fields" }, 400);
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO leads (id, name, role, contact, company, website, team_size, niche, pain, data_link, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '01_NEW', ?, ?)
  `).bind(lead.id, lead.name, lead.role, lead.contact, lead.company, lead.website, lead.teamSize, lead.niche, lead.pain, lead.dataLink, now, now).run();
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) await sendTelegram(env, lead);
  return json({ ok: true, leadId: lead.id, status: "01_NEW" }, 201);
}

async function listLeads(request, env) {
  const url = new URL(request.url);
  const { results } = await env.DB.prepare("SELECT * FROM leads ORDER BY created_at DESC LIMIT 200").all();
  const leads = results.map(mapLead);
  if (url.searchParams.get("format") === "csv") return csv(leads);
  return json({ ok: true, leads });
}

async function state(env) {
  const organizationId = await ensureOrg(env);
  const [org, managers, checklists, calls, reports, subscription] = await Promise.all([
    env.DB.prepare("SELECT * FROM organizations WHERE id = ?").bind(organizationId).first(),
    env.DB.prepare("SELECT * FROM managers WHERE organization_id = ? ORDER BY created_at DESC").bind(organizationId).all(),
    env.DB.prepare("SELECT * FROM checklists WHERE organization_id = ? ORDER BY created_at DESC").bind(organizationId).all(),
    env.DB.prepare("SELECT * FROM calls WHERE organization_id = ? ORDER BY created_at DESC LIMIT 100").bind(organizationId).all(),
    env.DB.prepare("SELECT * FROM reports WHERE organization_id = ? ORDER BY created_at DESC LIMIT 50").bind(organizationId).all(),
    env.DB.prepare("SELECT * FROM subscriptions WHERE organization_id = ?").bind(organizationId).first()
  ]);
  return json({
    ok: true,
    state: {
      organization: mapOrg(org),
      managers: managers.results.map(mapManager),
      checklists: checklists.results.map(mapChecklist),
      calls: calls.results.map(mapCall),
      reports: reports.results.map(mapReport),
      subscription
    }
  });
}

async function updateWorkspace(request, env) {
  const orgId = await ensureOrg(env);
  const input = await request.json();
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE organizations SET name = ?, industry = ?, country = ?, language = ?, updated_at = ? WHERE id = ?")
    .bind(input.company || input.name || "CallControl AI Demo", input.industry || "sales", input.country || "UA", input.language || "ru", now, orgId).run();
  if (input.managersText) {
    const names = String(input.managersText).split(/\n|,/).map((name) => name.trim()).filter(Boolean);
    for (const [index, name] of names.entries()) {
      const id = slugId("mgr", name, index);
      await env.DB.prepare(`
        INSERT OR REPLACE INTO managers (id, organization_id, name, role_title, team, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'Sales', 1, ?, ?)
      `).bind(id, orgId, name, index === 0 ? "Team Lead" : "Manager", now, now).run();
    }
  }
  return state(env);
}

async function createCall(request, env) {
  const orgId = await ensureOrg(env);
  const input = await request.json();
  const now = new Date().toISOString();
  const callId = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO calls (id, organization_id, manager_id, title, status, source, language, duration_seconds, transcript, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?)
  `).bind(callId, orgId, input.managerId || null, input.title || "Новый звонок", input.source || "manual", input.language || "ru", Number(input.durationSeconds || 0), input.transcript || "", now, now).run();
  if (env.ANALYSIS_QUEUE) await env.ANALYSIS_QUEUE.send({ callId, organizationId: orgId });
  return json({ ok: true, callId, status: "queued" }, 201);
}

async function importCsv(request, env) {
  const input = await request.json();
  const rows = parseCsv(input.csv || "");
  const created = [];
  for (const row of rows) {
    const response = await createCall(new Request("https://worker/api/calls", {
      method: "POST",
      body: JSON.stringify({
        title: row.call_id || row.external_id || "CSV call",
        transcript: row.transcript || row.text || "",
        durationSeconds: row.duration_seconds || row.duration || 0,
        source: "csv"
      })
    }), env);
    created.push(await response.json());
  }
  return json({ ok: true, imported: created.length, calls: created }, 201);
}

async function listCalls(request, env) {
  const orgId = await ensureOrg(env);
  const { results } = await env.DB.prepare("SELECT * FROM calls WHERE organization_id = ? ORDER BY created_at DESC LIMIT 200").bind(orgId).all();
  return json({ ok: true, calls: results.map(mapCall) });
}

async function searchCalls(request, env) {
  const orgId = await ensureOrg(env);
  const q = `%${new URL(request.url).searchParams.get("q") || ""}%`;
  const { results } = await env.DB.prepare(`
    SELECT * FROM calls
    WHERE organization_id = ? AND (title LIKE ? OR transcript LIKE ? OR summary LIKE ? OR tags_json LIKE ?)
    ORDER BY created_at DESC LIMIT 50
  `).bind(orgId, q, q, q, q).all();
  return json({ ok: true, calls: results.map(mapCall) });
}

async function createReport(env) {
  const orgId = await ensureOrg(env);
  const { results } = await env.DB.prepare("SELECT * FROM calls WHERE organization_id = ? ORDER BY created_at DESC LIMIT 5").bind(orgId).all();
  const calls = results.map(mapCall);
  const highRisk = calls.filter((call) => call.riskLevel === "high");
  const score = calls.length ? Math.round(calls.reduce((sum, call) => sum + Number(call.score || 0), 0) / calls.length) : 0;
  const topCall = highRisk[0] || calls[0];
  const markdown = [
    "# Mini-Audit",
    "",
    `Объем: ${calls.length} звонков`,
    `AI Score: ${score}/100`,
    "",
    "## Главный инсайт",
    topCall?.summary || "Недостаточно звонков для анализа.",
    "",
    "## Ouch Moment",
    `> ${topCall?.evidenceQuote || "Нет цитаты"}`,
    "",
    "## Action Items",
    ...(topCall?.actionItems || ["Добавить больше звонков."]).map((item, index) => `${index + 1}. ${item}`)
  ].join("\n");
  const now = new Date().toISOString();
  const reportId = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO reports (id, organization_id, title, score, calls_count, high_risk_calls, value_at_risk, main_finding, markdown, created_at)
    VALUES (?, ?, 'Mini-Audit', ?, ?, ?, ?, ?, ?, ?)
  `).bind(reportId, orgId, score, calls.length, highRisk.length, highRisk.length * 2400, topCall?.summary || "", markdown, now).run();
  return json({ ok: true, report: { id: reportId, markdown, score, callsCount: calls.length } }, 201);
}

async function analyzeQueuedCall(env, callId, organizationId) {
  const row = await env.DB.prepare("SELECT * FROM calls WHERE id = ? AND organization_id = ?").bind(callId, organizationId).first();
  if (!row) return;
  const analysis = analyzeTranscript(row.transcript || "");
  await env.DB.prepare(`
    UPDATE calls SET status = 'processed', score = ?, risk_level = ?, summary = ?, evidence_quote = ?, tags_json = ?, action_items_json = ?, updated_at = ?
    WHERE id = ?
  `).bind(analysis.score, analysis.riskLevel, analysis.summary, analysis.evidenceQuote, JSON.stringify(analysis.tags), JSON.stringify(analysis.actionItems), new Date().toISOString(), callId).run();
}

function analyzeTranscript(transcript) {
  const text = String(transcript || "").toLowerCase();
  const tags = [];
  let score = 82;
  if (/дорого|цена|price|expensive|cost/.test(text)) { tags.push("Цена"); score -= 10; }
  if (/подума|think|later|позже/.test(text)) { tags.push("Нет next step"); score -= 16; }
  if (/конкур|competitor|другие|compare/.test(text)) { tags.push("Конкурент"); score -= 12; }
  if (!/бюджет|budget|оплат|payment/.test(text)) { tags.push("Нет бюджета"); score -= 10; }
  if (!/завтра|суббот|meeting|созвон|перезвон|11:00|12:00/.test(text)) { tags.push("Нет даты"); score -= 10; }
  score = Math.max(25, Math.min(96, score));
  const riskLevel = score < 55 ? "high" : score < 72 ? "medium" : "low";
  return {
    score,
    riskLevel,
    summary: riskLevel === "high" ? "AI нашел риск потери лида." : riskLevel === "medium" ? "AI нашел умеренный риск." : "Критических рисков нет.",
    evidenceQuote: extractEvidence(transcript),
    tags,
    actionItems: riskLevel === "high" ? ["Зафиксировать следующий шаг", "Уточнить бюджет", "Переписать ответ на возражение"] : ["Добавить 2 уточняющих вопроса", "Проверить CRM-заметку"]
  };
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
    dataLink: clean(input.dataLink || input.data_link || input.data)
  };
}

async function sendTelegram(env, lead) {
  const text = ["🚀 Новая заявка: CallControl AI", "", `Имя: ${lead.name}`, `Контакт: ${lead.contact}`, `Компания: ${lead.company}`, lead.pain ? `Боль: ${lead.pain}` : ""].filter(Boolean).join("\n");
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true })
  });
}

function mapOrg(row) { return row && { id: row.id, name: row.name, industry: row.industry, country: row.country, language: row.language, status: row.status }; }
function mapUser(row) { return { id: row.id, email: row.email, name: row.name, role: row.role, active: row.status === "active" }; }
function mapManager(row) { return { id: row.id, name: row.name, roleTitle: row.role_title, team: row.team, active: Boolean(row.active) }; }
function mapChecklist(row) { return { id: row.id, name: row.name, vertical: row.vertical, criteria: parseJson(row.criteria_json, []) }; }
function mapCall(row) { return { id: row.id, managerId: row.manager_id, title: row.title, status: row.status, source: row.source, language: row.language, durationSeconds: row.duration_seconds, transcript: row.transcript, score: row.score, riskLevel: row.risk_level, summary: row.summary, evidenceQuote: row.evidence_quote, tags: parseJson(row.tags_json, []), actionItems: parseJson(row.action_items_json, []), createdAt: row.created_at }; }
function mapReport(row) { return { id: row.id, title: row.title, score: row.score, callsCount: row.calls_count, highRiskCalls: row.high_risk_calls, valueAtRisk: row.value_at_risk, mainFinding: row.main_finding, markdown: row.markdown, createdAt: row.created_at }; }
function mapLead(row) { return { id: row.id, createdAt: row.created_at, status: row.status, name: row.name, role: row.role, contact: row.contact, company: row.company, website: row.website, teamSize: row.team_size, niche: row.niche, pain: row.pain, dataLink: row.data_link }; }
function defaultOrg(env) { return env.DEFAULT_ORG_ID || "org_demo"; }
function clean(value) { return String(value || "").trim().slice(0, 1200); }
function parseJson(value, fallback) { try { return JSON.parse(value || ""); } catch { return fallback; } }
function extractEvidence(transcript) { return String(transcript || "").split(/\n+/).find((line) => /дорого|подума|цена|конкур|think|price/i.test(line)) || "Нет цитаты"; }
function slugId(prefix, value, index) { return `${prefix}_${String(value || index).toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 24)}`; }

function parseCsv(csvText) {
  const lines = String(csvText || "").trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((item) => item.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

async function sha256(value) {
  const data = new TextEncoder().encode(String(value || ""));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function csv(leads) {
  const headers = ["createdAt", "status", "name", "role", "contact", "company", "website", "teamSize", "niche", "pain", "dataLink"];
  const body = [headers.join(","), ...leads.map((lead) => headers.map((key) => csvCell(lead[key])).join(","))].join("\n");
  return new Response(body, { headers: cors({ "Content-Type": "text/csv; charset=utf-8" }) });
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), { status, headers: cors({ "Content-Type": "application/json; charset=utf-8" }) });
}

function cors(headers = {}) {
  return {
    ...headers,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-App-Pin",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS"
  };
}
