const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = __dirname;
const dataDir = path.join(rootDir, "data");
const leadsPath = path.join(dataDir, "leads.jsonl");
const dbPath = path.join(dataDir, "callcontrol-db.json");
const legacySeedPath = path.join(rootDir, "..", "call-qa-mini-saas", "data", "seed-salesradar-demo.json");
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";
const appPin = process.env.APP_PIN || "";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    writeDb(defaultDb());
  }
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function readDb() {
  ensureDataDir();
  return JSON.parse(fs.readFileSync(dbPath, "utf8"));
}

function writeDb(db) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");
}

function defaultDb() {
  const now = new Date().toISOString();
  return {
    organization: {
      id: "org_demo",
      name: "CallControl AI Demo",
      industry: "multi_vertical",
      country: "UA",
      language: "ru",
      status: "demo",
      createdAt: now,
      updatedAt: now
    },
    managers: [
      { id: "mgr_ivan", name: "Иван", roleTitle: "Senior Sales", team: "Sales", active: true },
      { id: "mgr_maria", name: "Мария", roleTitle: "Sales Manager", team: "Sales", active: true },
      { id: "mgr_dmitry", name: "Дмитрий", roleTitle: "Sales Manager", team: "Sales", active: true }
    ],
    checklists: [
      {
        id: "chk_universal",
        name: "Универсальный чек-лист качества",
        vertical: "universal",
        criteria: ["Приветствие", "Дружелюбный тон", "Уточнение боли", "Бюджет", "Ценность перед ценой", "Возражения", "Следующий шаг", "CRM-заметка"]
      },
      {
        id: "chk_sales",
        name: "Отдел продаж",
        vertical: "sales",
        criteria: ["ЛПР", "Бюджет", "Срок покупки", "Конкурент", "Отработка цены", "Закрытие на дату"]
      },
      {
        id: "chk_support",
        name: "Клиент-сервис",
        vertical: "support",
        criteria: ["Эмпатия", "Скорость реакции", "Эскалация", "Решение обращения", "Токсичные фразы", "Повторное обращение"]
      }
    ],
    calls: [
      makeDemoCall("call_4482", "mgr_dmitry", "Дмитрий · цена и конкурент", 43, "high", "Клиент сказал “дорого”, менеджер не уточнил сравнение и завершил звонок без следующего шага.", "Ну, цены сейчас везде такие. Посмотрите сайт, если что — звоните.", ["Слив цены", "Нет next step", "Конкурент"]),
      makeDemoCall("call_4495", "mgr_maria", "Мария · следующий шаг", 64, "high", "Клиент был готов приехать на просмотр, но менеджер отправила варианты без фиксации даты.", "Я вам тогда сейчас отправлю варианты в WhatsApp.", ["Горячий лид", "Нет даты", "Просмотр"]),
      makeDemoCall("call_4520", "mgr_ivan", "Иван · много говорит", 78, "medium", "Менеджер знает продукт, но говорит 78% времени и не развивает вопросы клиента.", "Да, но сначала еще по условиям оплаты расскажу.", ["Talk ratio", "Потребность"]),
      makeDemoCall("call_4540", "mgr_ivan", "Иван · эталонный звонок", 91, "low", "Менеджер связал потребность клиента с объектом и закрыл на просмотр.", "Давайте покажу в субботу в 11:00?", ["Gold call", "Закрытие"])
    ],
    reports: [],
    jobs: [],
    auditLog: [],
    subscription: {
      plan: "demo",
      status: "trial",
      minutesLimit: 75,
      minutesUsed: 0,
      renewalDate: null
    },
    users: [
      { id: "usr_owner", email: "owner@example.com", name: "Owner", role: "owner", active: true, createdAt: now, updatedAt: now },
      { id: "usr_rop", email: "rop@example.com", name: "ROP", role: "manager", active: true, createdAt: now, updatedAt: now },
      { id: "usr_member", email: "manager@example.com", name: "Manager", role: "member", active: true, createdAt: now, updatedAt: now }
    ],
    invites: [],
    invoices: [],
    files: [],
    createdAt: now,
    updatedAt: now
  };
}

function makeDemoCall(idValue, managerId, title, score, riskLevel, summary, evidenceQuote, tags) {
  const now = new Date().toISOString();
  return {
    id: idValue,
    managerId,
    title,
    score,
    riskLevel,
    status: "processed",
    durationSeconds: 720,
    source: "demo",
    language: "ru",
    transcript: `Client: Нам интересно, но нужно понять цену и следующий шаг.\nManager: ${evidenceQuote}\nClient: Хорошо, тогда подумаю.`,
    summary,
    evidenceQuote,
    tags,
    actionItems: buildActionItems(riskLevel),
    createdAt: now,
    updatedAt: now
  };
}

function buildActionItems(riskLevel) {
  if (riskLevel === "high") {
    return ["Зафиксировать следующий шаг", "Уточнить бюджет до презентации", "Переписать фразу ответа на возражение"];
  }
  if (riskLevel === "medium") {
    return ["Снизить talk ratio", "Добавить 2 уточняющих вопроса", "Проверить CRM-заметку"];
  }
  return ["Сохранить как эталонный звонок", "Показать команде на планерке"];
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,X-App-Pin",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS"
  });
  res.end(JSON.stringify(payload, null, 2));
}

function requireAppPin(req, res) {
  if (!appPin) return true;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const provided = req.headers["x-app-pin"] || url.searchParams.get("pin");
  if (provided === appPin) return true;
  sendJson(res, 401, { ok: false, error: "pin_required" });
  return false;
}

function recordAudit(db, action, target, details = {}) {
  db.auditLog = db.auditLog || [];
  db.auditLog.unshift({
    id: id("audit"),
    action,
    target,
    details,
    createdAt: new Date().toISOString()
  });
  db.auditLog = db.auditLog.slice(0, 200);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function normalizeLead(input) {
  const now = new Date().toISOString();
  const lead = {
    id: crypto.randomUUID(),
    createdAt: now,
    status: "01_NEW",
    source: String(input.source || "callcontrol-demo"),
    name: String(input.name || "").trim(),
    role: String(input.role || "").trim(),
    niche: String(input.niche || "").trim(),
    dataFormat: String(input.dataFormat || input.data_format || "").trim(),
    callsPerMonth: String(input.callsPerMonth || input.calls_per_month || "").trim(),
    contact: String(input.contact || "").trim(),
    company: String(input.company || "").trim(),
    site: String(input.site || "").trim(),
    team: String(input.team || "").trim(),
    pain: String(input.pain || "").trim(),
    data: String(input.data || "").trim(),
    auditResultLink: String(input.auditResultLink || input.audit_result_link || "").trim(),
    keyInsight: String(input.keyInsight || input.key_insight || "").trim(),
    upsellTarget: String(input.upsellTarget || input.upsell_target || "").trim(),
    language: String(input.language || "").trim(),
    userAgent: String(input.userAgent || "").trim()
  };

  const missing = ["name", "contact", "company", "site", "data"].filter((key) => !lead[key]);
  return { lead, missing };
}

function writeLeads(leads) {
  ensureDataDir();
  fs.writeFileSync(leadsPath, leads.map((lead) => JSON.stringify(lead)).join("\n") + (leads.length ? "\n" : ""), "utf8");
}

// In-memory anti-spam state for the local dev server.
const LEAD_RATE = { max: 5, windowMs: 10 * 60 * 1000, hits: new Map() };
const MIN_FILL_MS = 2500;

function leadSpamReason(input) {
  if (String(input.company_website || input.fax || input._gotcha || "").trim()) return "honeypot";
  const elapsed = Number(input.formElapsedMs);
  if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < MIN_FILL_MS) return "too_fast";
  const linkCount = (String(input.pain || "").match(/https?:\/\//gi) || []).length;
  if (linkCount >= 3) return "link_spam";
  return null;
}

function leadRateLimited(req) {
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  const now = Date.now();
  const entry = LEAD_RATE.hits.get(ip);
  if (!entry || now - entry.start > LEAD_RATE.windowMs) {
    LEAD_RATE.hits.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > LEAD_RATE.max;
}

async function handleCreateLead(req, res) {
  try {
    const body = await readBody(req);
    const input = body ? JSON.parse(body) : {};

    // Anti-spam: honeypot + minimum fill time. Return 200 so bots get no signal.
    if (leadSpamReason(input)) {
      sendJson(res, 200, { ok: true, status: "ignored", message: "Lead accepted" });
      return;
    }
    if (leadRateLimited(req)) {
      sendJson(res, 429, { ok: false, error: "rate_limited", message: "Too many requests. Try again later." });
      return;
    }

    const { lead, missing } = normalizeLead(input);
    if (missing.length) {
      sendJson(res, 400, { ok: false, error: "missing_required_fields", fields: missing });
      return;
    }

    ensureDataDir();
    fs.appendFileSync(leadsPath, JSON.stringify(lead) + "\n", "utf8");
    sendJson(res, 201, {
      ok: true,
      leadId: lead.id,
      status: lead.status,
      message: "Lead saved locally"
    });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "server_error" });
  }
}

function handleListLeads(res) {
  ensureDataDir();
  if (!fs.existsSync(leadsPath)) {
    sendJson(res, 200, { ok: true, leads: [] });
    return;
  }
  const leads = fs.readFileSync(leadsPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .reverse();
  sendJson(res, 200, { ok: true, leads });
}

function handleLeadsCsv(res) {
  const leads = readLeads();
  const headers = ["createdAt", "status", "name", "role", "contact", "company", "site", "team", "pain", "data"];
  const csv = [
    headers.join(","),
    ...leads.map((lead) => headers.map((key) => csvCell(lead[key] || "")).join(","))
  ].join("\n");
  res.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Disposition": "attachment; filename=\"callcontrol-leads.csv\""
  });
  res.end(csv);
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

async function handleUpdateLead(req, res, leadId) {
  try {
    const input = JSON.parse(await readBody(req) || "{}");
    const leads = readLeads().reverse();
    const lead = leads.find((item) => item.id === leadId);
    if (!lead) return sendJson(res, 404, { ok: false, error: "lead_not_found" });
    Object.assign(lead, {
      status: input.status || lead.status,
      auditResultLink: input.auditResultLink ?? lead.auditResultLink,
      keyInsight: input.keyInsight ?? lead.keyInsight,
      upsellTarget: input.upsellTarget ?? lead.upsellTarget,
      updatedAt: new Date().toISOString()
    });
    writeLeads(leads);
    sendJson(res, 200, { ok: true, lead });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "server_error" });
  }
}

function handleDashboard(res) {
  const db = readDb();
  const calls = db.calls || [];
  const analyzed = calls.filter((call) => typeof call.score === "number");
  const highRisk = calls.filter((call) => ["high", "critical"].includes(call.riskLevel)).length;
  const avgScore = analyzed.length ? Math.round(analyzed.reduce((sum, call) => sum + call.score, 0) / analyzed.length) : null;
  const managerRanking = (db.managers || []).map((manager) => {
    const managerCalls = calls.filter((call) => call.managerId === manager.id);
    const scored = managerCalls.filter((call) => typeof call.score === "number");
    return {
      ...manager,
      callsAnalyzed: scored.length,
      averageScore: scored.length ? Math.round(scored.reduce((sum, call) => sum + call.score, 0) / scored.length) : null,
      highRiskCalls: managerCalls.filter((call) => call.riskLevel === "high").length
    };
  }).sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0));

  sendJson(res, 200, {
    ok: true,
    dashboard: {
      callsTotal: calls.length,
      callsAnalyzed: analyzed.length,
      averageScore: avgScore,
      highRiskCalls: highRisk,
      valueAtRisk: highRisk * 2400,
      timeSavedHours: Math.max(1, Math.round((analyzed.length * 6) / 60)),
      managerRanking,
      riskDistribution: countBy(calls, "riskLevel"),
      tagDistribution: countTags(calls)
    },
    subscription: db.subscription || null
  });
}

function handleState(res) {
  const db = readDb();
  sendJson(res, 200, {
    ok: true,
    state: {
      organization: db.organization,
      managers: db.managers,
      checklists: db.checklists,
      calls: db.calls,
      reports: db.reports,
      jobs: db.jobs,
      auditLog: db.auditLog || [],
      subscription: db.subscription || null,
      users: db.users || [],
      invites: db.invites || [],
      invoices: db.invoices || [],
      files: db.files || [],
      leads: readLeads()
    }
  });
}

function currentUser(req, db) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const userId = req.headers["x-user-id"] || url.searchParams.get("userId") || "usr_owner";
  return (db.users || []).find((user) => user.id === userId) || (db.users || [])[0] || null;
}

function handleMe(req, res) {
  const db = readDb();
  sendJson(res, 200, { ok: true, user: currentUser(req, db), users: db.users || [], invites: db.invites || [] });
}

async function handleCreateInvite(req, res) {
  try {
    const input = JSON.parse(await readBody(req) || "{}");
    const db = readDb();
    const actor = currentUser(req, db);
    if (!["owner", "admin", "manager"].includes(actor?.role)) {
      sendJson(res, 403, { ok: false, error: "insufficient_role" });
      return;
    }
    const now = new Date().toISOString();
    const invite = {
      id: id("invite"),
      email: String(input.email || "").trim(),
      role: String(input.role || "member").trim(),
      token: crypto.randomBytes(12).toString("hex"),
      status: "pending",
      createdBy: actor.id,
      createdAt: now,
      acceptedAt: null
    };
    db.invites = db.invites || [];
    db.invites.unshift(invite);
    recordAudit(db, "auth.invite_create", invite.id, { email: invite.email, role: invite.role });
    writeDb(db);
    sendJson(res, 201, { ok: true, invite, inviteUrl: `/client.html?invite=${invite.token}` });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "server_error" });
  }
}

async function handleAcceptInvite(req, res) {
  try {
    const input = JSON.parse(await readBody(req) || "{}");
    const db = readDb();
    const invite = (db.invites || []).find((item) => item.token === input.token && item.status === "pending");
    if (!invite) {
      sendJson(res, 404, { ok: false, error: "invite_not_found" });
      return;
    }
    const now = new Date().toISOString();
    const user = {
      id: id("usr"),
      email: invite.email || String(input.email || "").trim(),
      name: String(input.name || invite.email || "New User").trim(),
      role: invite.role || "member",
      active: true,
      createdAt: now,
      updatedAt: now
    };
    db.users = db.users || [];
    db.users.push(user);
    invite.status = "accepted";
    invite.acceptedAt = now;
    recordAudit(db, "auth.invite_accept", invite.id, { userId: user.id, role: user.role });
    writeDb(db);
    sendJson(res, 201, { ok: true, user });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "server_error" });
  }
}

async function handleUpdateUser(req, res, userId) {
  try {
    const input = JSON.parse(await readBody(req) || "{}");
    const db = readDb();
    const user = (db.users || []).find((item) => item.id === userId);
    if (!user) {
      sendJson(res, 404, { ok: false, error: "user_not_found" });
      return;
    }
    user.role = input.role || user.role;
    user.active = input.active ?? user.active;
    user.updatedAt = new Date().toISOString();
    recordAudit(db, "auth.user_update", user.id, { role: user.role, active: user.active });
    writeDb(db);
    sendJson(res, 200, { ok: true, user });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "server_error" });
  }
}

function billingPlans() {
  return [
    { id: "free", name: "Free Mini-Audit", priceUsd: 0, minutesLimit: 75, callsLimit: 5, description: "Проверка гипотезы и первый отчет." },
    { id: "scan_10", name: "Fatal Error Scan", priceUsd: 10, minutesLimit: 75, callsLimit: 5, description: "Быстрый платный разбор до 5 звонков." },
    { id: "pattern_50", name: "Pattern Search", priceUsd: 50, minutesLimit: 300, callsLimit: 20, description: "Поиск повторяющихся ошибок." },
    { id: "custom", name: "Custom Audit", priceUsd: null, minutesLimit: null, callsLimit: null, description: "Индивидуальный объем и внедрение." }
  ];
}

function handleBillingPlans(res) {
  sendJson(res, 200, { ok: true, plans: billingPlans() });
}

async function handleCreateCheckout(req, res) {
  try {
    const input = JSON.parse(await readBody(req) || "{}");
    const db = readDb();
    const plan = billingPlans().find((item) => item.id === input.planId) || billingPlans()[1];
    const now = new Date().toISOString();
    const invoice = {
      id: id("inv"),
      planId: plan.id,
      planName: plan.name,
      amountUsd: plan.priceUsd,
      status: plan.priceUsd === 0 ? "free" : "manual_payment_pending",
      paymentProvider: "manual",
      paymentNote: plan.priceUsd === 0 ? "Free audit" : "Manual invoice: send payment link or WayForPay invoice manually.",
      createdAt: now,
      updatedAt: now
    };
    db.invoices = db.invoices || [];
    db.invoices.unshift(invoice);
    db.subscription = {
      ...(db.subscription || {}),
      plan: plan.id,
      status: plan.priceUsd === 0 ? "trial" : "pending_payment",
      minutesLimit: plan.minutesLimit ?? db.subscription?.minutesLimit ?? 75,
      updatedAt: now
    };
    recordAudit(db, "billing.checkout_create", invoice.id, { planId: plan.id, amountUsd: plan.priceUsd });
    writeDb(db);
    sendJson(res, 201, { ok: true, invoice, subscription: db.subscription });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "server_error" });
  }
}

function handleBillingUsage(res) {
  const db = readDb();
  const sub = db.subscription || { minutesLimit: 75, minutesUsed: 0 };
  const remaining = sub.minutesLimit === null ? null : Math.max(0, Number(sub.minutesLimit || 0) - Number(sub.minutesUsed || 0));
  sendJson(res, 200, {
    ok: true,
    subscription: sub,
    remainingMinutes: remaining,
    invoices: db.invoices || []
  });
}

async function handleRegisterFile(req, res) {
  try {
    const input = JSON.parse(await readBody(req) || "{}");
    const db = readDb();
    const file = {
      id: id("file"),
      name: String(input.name || "call-audio").trim(),
      type: String(input.type || "audio").trim(),
      sizeBytes: Number(input.sizeBytes || input.size || 0),
      status: "registered",
      storage: "manual_link",
      url: String(input.url || input.dataLink || "").trim(),
      createdAt: new Date().toISOString()
    };
    db.files = db.files || [];
    db.files.unshift(file);
    recordAudit(db, "file.register", file.id, { name: file.name, sizeBytes: file.sizeBytes });
    writeDb(db);
    sendJson(res, 201, { ok: true, file });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "server_error" });
  }
}

async function handleUpdateWorkspace(req, res) {
  try {
    const input = JSON.parse(await readBody(req) || "{}");
    const db = readDb();
    const now = new Date().toISOString();
    db.organization = {
      ...db.organization,
      name: String(input.company || input.name || db.organization.name).trim(),
      industry: String(input.industry || db.organization.industry || "multi_vertical").trim(),
      country: String(input.country || db.organization.country || "UA").trim(),
      language: String(input.language || db.organization.language || "ru").trim(),
      updatedAt: now
    };
    if (input.managersText || Array.isArray(input.managers)) {
      const names = Array.isArray(input.managers)
        ? input.managers
        : String(input.managersText || "").split(/\n|,/);
      const cleanNames = names.map((name) => String(name).trim()).filter(Boolean);
      if (cleanNames.length) {
        db.managers = cleanNames.map((name, index) => ({
          id: slugId("mgr", name, index),
          name,
          roleTitle: index === 0 ? "Team Lead" : "Manager",
          team: "Sales",
          active: true
        }));
      }
    }
    db.updatedAt = now;
    recordAudit(db, "workspace.update", db.organization.id, { managers: db.managers.length });
    writeDb(db);
    sendJson(res, 200, { ok: true, organization: db.organization, managers: db.managers });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "server_error" });
  }
}

async function handleCreateChecklist(req, res) {
  try {
    const input = JSON.parse(await readBody(req) || "{}");
    const db = readDb();
    const criteria = Array.isArray(input.criteria)
      ? input.criteria
      : String(input.criteriaText || input.criteria || "").split(/\n|;/);
    const checklist = {
      id: id("chk"),
      name: String(input.name || "Кастомный чек-лист").trim(),
      vertical: String(input.vertical || "custom").trim(),
      criteria: criteria.map((item) => String(item).trim()).filter(Boolean).slice(0, 40)
    };
    if (!checklist.criteria.length) {
      checklist.criteria = ["Приветствие", "Уточнение боли", "Следующий шаг"];
    }
    db.checklists.unshift(checklist);
    db.updatedAt = new Date().toISOString();
    recordAudit(db, "checklist.create", checklist.id, { name: checklist.name, criteria: checklist.criteria.length });
    writeDb(db);
    sendJson(res, 201, { ok: true, checklist });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "server_error" });
  }
}

function slugId(prefix, value, index) {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return `${prefix}_${slug || index + 1}`;
}

function handleCalls(res) {
  const db = readDb();
  sendJson(res, 200, { ok: true, calls: db.calls || [] });
}

function handleExportState(res) {
  const db = readDb();
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Disposition": "attachment; filename=\"callcontrol-state.json\""
  });
  res.end(JSON.stringify({ ...db, leads: readLeads() }, null, 2));
}

function handleSearchCalls(res, query) {
  const db = readDb();
  const q = String(query || "").trim().toLowerCase();
  const calls = db.calls || [];
  const results = q
    ? calls.filter((call) => [
      call.title,
      call.summary,
      call.evidenceQuote,
      call.transcript,
      ...(call.tags || []),
      ...(call.actionItems || [])
    ].join(" ").toLowerCase().includes(q))
    : calls.slice(0, 20);
  sendJson(res, 200, {
    ok: true,
    query: q,
    count: results.length,
    calls: results.slice(0, 50)
  });
}

async function handleCreateCall(req, res) {
  try {
    const input = JSON.parse(await readBody(req) || "{}");
    const db = readDb();
    const now = new Date().toISOString();
    const call = {
      id: id("call"),
      managerId: input.managerId || input.manager_id || "mgr_dmitry",
      title: input.title || input.external_id || "Новый звонок",
      score: null,
      riskLevel: "unknown",
      status: input.transcript ? "ready" : "new",
      durationSeconds: Number(input.durationSeconds || input.duration_seconds || 0),
      source: input.source || "manual",
      language: input.language || "ru",
      transcript: String(input.transcript || ""),
      summary: "",
      evidenceQuote: "",
      tags: [],
      actionItems: [],
      createdAt: now,
      updatedAt: now
    };
    db.calls.unshift(call);
    db.updatedAt = now;
    db.subscription = updateUsage(db.subscription, call.durationSeconds);
    recordAudit(db, "call.create", call.id, { title: call.title, source: call.source });
    writeDb(db);
    sendJson(res, 201, { ok: true, call });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "server_error" });
  }
}

async function handleImportCsv(req, res) {
  try {
    const input = JSON.parse(await readBody(req) || "{}");
    const rows = parseCsv(String(input.csv || ""));
    const db = readDb();
    const imported = [];
    const errors = [];
    const now = new Date().toISOString();
    rows.forEach((row, index) => {
      const transcript = row.transcript || row.text || row.call_transcript || "";
      if (transcript.trim().length < 20) {
        errors.push({ row: index + 2, error: "missing_or_short_transcript" });
        return;
      }
      const manager = findOrCreateManager(db, row.manager_name || row.manager || "Imported Manager");
      const call = {
        id: id("call"),
        managerId: manager.id,
        title: row.call_id || row.external_id || `CSV call ${index + 1}`,
        score: null,
        riskLevel: "unknown",
        status: "ready",
        durationSeconds: Number(row.duration_seconds || row.duration || 0),
        source: row.source || "csv",
        language: row.language || "ru",
        transcript,
        summary: "",
        evidenceQuote: "",
        tags: [],
        actionItems: [],
        createdAt: now,
        updatedAt: now
      };
      Object.assign(call, analyzeTranscript(transcript), { status: "processed" });
      db.calls.unshift(call);
      imported.push(call);
    });
    db.jobs.unshift({ id: id("job"), type: "csv_import", status: "completed", imported: imported.length, errors: errors.length, createdAt: now });
    const seconds = imported.reduce((sum, call) => sum + Number(call.durationSeconds || 0), 0);
    db.subscription = updateUsage(db.subscription, seconds);
    db.updatedAt = now;
    recordAudit(db, "calls.import_csv", "csv", { imported: imported.length, errors: errors.length });
    writeDb(db);
    sendJson(res, 201, { ok: true, imported: imported.length, errors, calls: imported });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "server_error" });
  }
}

function handleAnalyzeCall(req, res, callId) {
  const db = readDb();
  const call = db.calls.find((item) => item.id === callId);
  if (!call) return sendJson(res, 404, { ok: false, error: "call_not_found" });
  const analysis = analyzeTranscript(call.transcript || "");
  Object.assign(call, analysis, {
    status: analysis.score < 65 ? "needs_review" : "processed",
    updatedAt: new Date().toISOString()
  });
  db.jobs.unshift({
    id: id("job"),
    callId: call.id,
    type: "mock_ai_analysis",
    status: "completed",
    createdAt: new Date().toISOString()
  });
  recordAudit(db, "call.analyze", call.id, { score: call.score, riskLevel: call.riskLevel });
  writeDb(db);
  sendJson(res, 200, { ok: true, call });
}

function handleAnalyzePending(res) {
  const db = readDb();
  const pending = (db.calls || []).filter((call) => ["ready", "new", "unknown"].includes(call.status) || call.score === null);
  pending.forEach((call) => {
    Object.assign(call, analyzeTranscript(call.transcript || ""), {
      status: "processed",
      updatedAt: new Date().toISOString()
    });
  });
  db.jobs.unshift({
    id: id("job"),
    type: "batch_analyze_pending",
    status: "completed",
    processed: pending.length,
    createdAt: new Date().toISOString()
  });
  db.updatedAt = new Date().toISOString();
  recordAudit(db, "calls.batch_analyze", "pending", { processed: pending.length });
  writeDb(db);
  sendJson(res, 200, { ok: true, processed: pending.length, calls: pending });
}

async function handleGenerateMiniReport(req, res) {
  const db = readDb();
  let input = {};
  try {
    input = JSON.parse(await readBody(req) || "{}");
  } catch {
    input = {};
  }
  const report = generateMiniAuditReport(db, null, input);
  db.reports.unshift(report);
  db.updatedAt = new Date().toISOString();
  recordAudit(db, "report.create", report.id, { callsCount: report.callsCount, score: report.score });
  writeDb(db);
  sendJson(res, 201, { ok: true, report });
}

function handleReports(res) {
  const db = readDb();
  sendJson(res, 200, { ok: true, reports: db.reports || [] });
}

async function handleGenerateLeadReport(req, res, leadId) {
  const db = readDb();
  const leads = readLeads().reverse();
  const lead = leads.find((item) => item.id === leadId);
  if (!lead) return sendJson(res, 404, { ok: false, error: "lead_not_found" });
  const report = generateMiniAuditReport(db, lead);
  db.reports.unshift(report);
  lead.status = "04_READY";
  lead.auditResultLink = `/api/reports/${report.id}.md`;
  lead.keyInsight = report.mainFinding;
  lead.updatedAt = new Date().toISOString();
  recordAudit(db, "lead.report_create", lead.id, { reportId: report.id });
  writeDb(db);
  writeLeads(leads);
  sendJson(res, 201, { ok: true, report, lead });
}

function handleReportMarkdown(res, reportId) {
  const db = readDb();
  const report = db.reports.find((item) => item.id === reportId) || generateMiniAuditReport(db);
  res.writeHead(200, {
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(report.markdown);
}

function handleReportHtml(res, reportId) {
  const db = readDb();
  const report = db.reports.find((item) => item.id === reportId) || generateMiniAuditReport(db);
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(renderReportHtml(report));
}

function readLeads() {
  ensureDataDir();
  if (!fs.existsSync(leadsPath)) return [];
  return fs.readFileSync(leadsPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .reverse();
}

function analyzeTranscript(transcript) {
  const text = String(transcript || "").toLowerCase();
  const tags = [];
  let score = 82;
  if (/дорого|цена|price|expensive|cost/.test(text)) {
    tags.push("Цена");
    score -= 10;
  }
  if (/подума|think|later|позже/.test(text)) {
    tags.push("Нет next step");
    score -= 16;
  }
  if (/конкур|competitor|другие|compare/.test(text)) {
    tags.push("Конкурент");
    score -= 12;
  }
  if (!/бюджет|budget|оплат|payment/.test(text)) {
    tags.push("Нет бюджета");
    score -= 10;
  }
  if (!/завтра|суббот|воскрес|meeting|созвон|перезвон|11:00|12:00/.test(text)) {
    tags.push("Нет даты");
    score -= 10;
  }
  score = Math.max(25, Math.min(96, score));
  const riskLevel = score < 55 ? "high" : score < 72 ? "medium" : "low";
  return {
    score,
    riskLevel,
    summary: riskLevel === "high"
      ? "AI нашел риск потери лида: в звонке есть признаки слабого закрытия или неотработанного возражения."
      : riskLevel === "medium"
        ? "AI нашел умеренный риск: звонок можно улучшить через уточняющие вопросы и фиксацию следующего шага."
        : "AI не нашел критических рисков: звонок можно использовать как рабочий пример.",
    evidenceQuote: extractEvidence(transcript),
    tags,
    actionItems: buildActionItems(riskLevel)
  };
}

function findOrCreateManager(db, name) {
  const normalized = String(name || "Imported Manager").trim();
  const found = db.managers.find((manager) => manager.name.toLowerCase() === normalized.toLowerCase());
  if (found) return found;
  const manager = {
    id: id("mgr"),
    name: normalized,
    roleTitle: "Imported Manager",
    team: "Sales",
    active: true
  };
  db.managers.push(manager);
  return manager;
}

function parseCsv(csv) {
  const rows = [];
  const lines = String(csv || "").trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return rows;
  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  for (const line of lines.slice(1)) {
    const values = splitCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((value) => value.trim());
}

function extractEvidence(transcript) {
  const lines = String(transcript || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return lines.find((line) => /дорого|подума|цена|конкур|think|price|expensive/i.test(line)) || lines[0] || "Нет цитаты";
}

function generateMiniAuditReport(db, lead, options = {}) {
  const allCalls = db.calls || [];
  const selected = Array.isArray(options.callIds) && options.callIds.length
    ? allCalls.filter((call) => options.callIds.includes(call.id))
    : allCalls;
  const calls = selected.slice(0, Number(options.limit || 5));
  const highRisk = calls.filter((call) => call.riskLevel === "high");
  const avg = calls.length ? Math.round(calls.reduce((sum, call) => sum + (call.score || 0), 0) / calls.length) : 0;
  const topCall = highRisk[0] || calls.slice().sort((a, b) => (a.score || 100) - (b.score || 100))[0];
  const title = lead ? `Mini-Audit: ${lead.company}` : `Mini-Audit: ${db.organization.name}`;
  const markdown = [
    `# ${title}`,
    "",
    `Дата: ${new Date().toISOString().slice(0, 10)}`,
    `Объем: ${calls.length} звонков`,
    lead ? `Клиент: ${lead.name} (${lead.contact})` : "",
    lead?.pain ? `Запрос клиента: ${lead.pain}` : "",
    `AI Score: ${avg}/100`,
    "",
    "## Главный инсайт",
    topCall ? topCall.summary : "Недостаточно звонков для анализа.",
    "",
    "## Ouch Moment",
    topCall ? `> ${topCall.evidenceQuote}` : "> Нет цитаты",
    "",
    "## Value at Risk",
    `Оценка риска: $${highRisk.length * 2400}.`,
    "",
    "## Action Items",
    ...(topCall?.actionItems || ["Добавить больше звонков для анализа."]).map((item, index) => `${index + 1}. ${item}`),
    "",
    "## Следующий шаг",
    "Проверить 20-50 звонков, чтобы понять, повторяется ли ошибка системно.",
    "",
    "## Upsell",
    "Полный аудит даст рейтинг менеджеров, список риск-звонков, повторяющиеся паттерны и план действий на 7 дней."
  ].filter((line) => line !== "").join("\n");
  return {
    id: id("report"),
    type: "mini_audit",
    title,
    score: avg,
    callsCount: calls.length,
    highRiskCalls: highRisk.length,
    valueAtRisk: highRisk.length * 2400,
    mainFinding: topCall ? topCall.summary : "Недостаточно звонков для анализа.",
    leadId: lead?.id || null,
    markdown,
    createdAt: new Date().toISOString()
  };
}

function handleLoadLegacySeed(res) {
  let db;
  if (!fs.existsSync(legacySeedPath)) {
    db = buildGeneratedDemoDb();
    writeDb(db);
    sendJson(res, 200, {
      ok: true,
      source: "generated_demo",
      calls: db.calls.length,
      managers: db.managers.length,
      checklists: db.checklists.length
    });
    return;
  }
  const legacy = JSON.parse(fs.readFileSync(legacySeedPath, "utf8"));
  db = transformLegacySeed(legacy);
  writeDb(db);
  sendJson(res, 200, {
    ok: true,
    source: "legacy_seed",
    calls: db.calls.length,
    managers: db.managers.length,
    checklists: db.checklists.length
  });
}

function handleResetDemo(res) {
  const db = defaultDb();
  writeDb(db);
  writeLeads([]);
  sendJson(res, 200, { ok: true, calls: db.calls.length, leads: 0, reports: 0 });
}

function updateUsage(subscription, durationSeconds) {
  const current = subscription || { plan: "demo", status: "trial", minutesLimit: 75, minutesUsed: 0, renewalDate: null };
  return {
    ...current,
    minutesUsed: Math.round((Number(current.minutesUsed || 0) + Number(durationSeconds || 0) / 60) * 10) / 10
  };
}

function transformLegacySeed(legacy) {
  const now = new Date().toISOString();
  return {
    organization: {
      id: legacy.organization?.id || "org_legacy_demo",
      name: "CallControl AI Legacy Demo",
      industry: legacy.organization?.industry || "real_estate",
      country: legacy.organization?.country || "UA",
      language: legacy.organization?.language || "ru",
      status: "demo",
      createdAt: now,
      updatedAt: now
    },
    managers: (legacy.managers || []).map((manager) => ({
      id: manager.id,
      name: manager.name,
      roleTitle: manager.role_title || manager.roleTitle || "Manager",
      team: manager.team || "Sales",
      active: manager.active !== false
    })),
    checklists: [{
      id: legacy.checklist?.id || "chk_legacy",
      name: legacy.checklist?.name || "Legacy QA Checklist",
      vertical: legacy.checklist?.vertical || "real_estate",
      criteria: (legacy.checklist?.criteria || []).map((criterion) => criterion.name || criterion.id)
    }],
    calls: (legacy.calls || []).map((call) => {
      const findings = (legacy.findings || []).filter((finding) => finding.call_id === call.id);
      return {
        id: call.id,
        managerId: call.manager_id,
        title: `${managerNameFromLegacy(legacy, call.manager_id)} · ${call.external_id || call.id}`,
        score: typeof call.total_score === "number" ? call.total_score : null,
        riskLevel: call.risk_level || "unknown",
        status: call.status || "processed",
        durationSeconds: Number(call.duration_seconds || 0),
        source: call.source || "legacy_seed",
        language: call.language || "ru",
        transcript: call.transcript || "",
        summary: findings[0]?.description || call.known_outcome || "",
        evidenceQuote: findings[0]?.evidence_quote || extractEvidence(call.transcript || ""),
        tags: findings.map((finding) => finding.category).filter(Boolean).slice(0, 5),
        actionItems: findings.map((finding) => finding.recommendation).filter(Boolean).slice(0, 5),
        createdAt: call.created_at || now,
        updatedAt: call.updated_at || now
      };
    }),
    reports: [],
    jobs: [],
    createdAt: now,
    updatedAt: now
  };
}

function buildGeneratedDemoDb() {
  const db = defaultDb();
  const now = new Date().toISOString();
  const managers = db.managers;
  const scenarios = [
    {
      topic: "цена без ценности",
      riskLevel: "high",
      score: 42,
      quote: "Да, понимаю, что дорого. Тогда подумайте и напишите, если будет актуально.",
      tags: ["Слив цены", "Нет next step", "Возражение дорого"],
      summary: "Клиент назвал цену барьером, но менеджер не связал стоимость с выгодой и не зафиксировал следующий шаг."
    },
    {
      topic: "нет квалификации",
      riskLevel: "high",
      score: 49,
      quote: "Я расскажу все варианты, а по бюджету уже потом сориентируемся.",
      tags: ["Нет бюджета", "Длинная презентация", "Loss of time"],
      summary: "Менеджер презентовал продукт до уточнения бюджета и потратил время на потенциально нецелевого лида."
    },
    {
      topic: "конкурент упомянут",
      riskLevel: "medium",
      score: 63,
      quote: "У конкурентов примерно то же самое, но у нас тоже есть хорошие условия.",
      tags: ["Конкурент", "Слабое отличие", "Battlecard"],
      summary: "Клиент сравнил с конкурентом, менеджер ответил общо и не показал сильное отличие предложения."
    },
    {
      topic: "нет CRM-заметки",
      riskLevel: "medium",
      score: 69,
      quote: "Я запомню и позже вернусь с вариантами.",
      tags: ["CRM note", "Обещание клиенту", "Контроль"],
      summary: "В звонке есть важное обещание клиенту, которое нужно фиксировать и передавать в CRM."
    },
    {
      topic: "gold call",
      riskLevel: "low",
      score: 88,
      quote: "Давайте зафиксируем: завтра в 12:00 я отправляю расчет и мы сразу обсуждаем оплату.",
      tags: ["Gold call", "Следующий шаг", "Закрытие"],
      summary: "Менеджер уточнил контекст, связал ценность с задачей клиента и закрыл звонок на конкретное действие."
    }
  ];
  db.calls = Array.from({ length: 50 }, (_, index) => {
    const scenario = scenarios[index % scenarios.length];
    const manager = managers[index % managers.length];
    const drift = (index % 7) - 3;
    const score = Math.max(25, Math.min(96, scenario.score + drift));
    return {
      id: `demo_call_${String(index + 1).padStart(3, "0")}`,
      managerId: manager.id,
      title: `${manager.name} · ${scenario.topic} · #${index + 1}`,
      score,
      riskLevel: score < 55 ? "high" : score < 72 ? "medium" : "low",
      status: "processed",
      durationSeconds: 360 + ((index * 47) % 720),
      source: "generated_demo",
      language: "ru",
      transcript: [
        "Client: Нам интересно, но нужно понять условия, цену и следующий шаг.",
        `Manager: ${scenario.quote}`,
        "Client: Хорошо, тогда я подумаю и вернусь позже."
      ].join("\n"),
      summary: scenario.summary,
      evidenceQuote: scenario.quote,
      tags: scenario.tags,
      actionItems: buildActionItems(score < 55 ? "high" : score < 72 ? "medium" : "low"),
      createdAt: now,
      updatedAt: now
    };
  });
  db.reports = [];
  db.jobs = [{
    id: id("job"),
    type: "generated_demo_seed",
    status: "completed",
    imported: db.calls.length,
    createdAt: now
  }];
  db.updatedAt = now;
  return db;
}

function renderReportHtml(report) {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(report.title)}</title>
  <style>
    body{margin:0;background:#f6f8fb;color:#111827;font-family:Inter,Arial,sans-serif;line-height:1.55}
    main{max-width:860px;margin:0 auto;padding:38px 22px 56px}
    .hero{background:#0b1118;color:#eef6ff;border-radius:16px;padding:26px 28px;margin-bottom:18px}
    .meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
    .pill{border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:5px 10px;color:#a8c0d8;font-size:12px}
    article{background:white;border:1px solid #e5e7eb;border-radius:16px;padding:26px 28px;box-shadow:0 20px 50px rgba(15,23,42,.08)}
    h1{margin:0;font-size:32px;letter-spacing:-.04em}
    h2{margin:26px 0 8px;font-size:18px}
    blockquote{margin:12px 0;padding:12px 14px;border-left:4px solid #fb7185;background:#fff1f2;border-radius:10px;color:#9f1239}
    ol{padding-left:22px}
    .footer{margin-top:18px;color:#64748b;font-size:12px}
    @media print{body{background:white}main{padding:0}.hero,article{box-shadow:none;border-radius:0}}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1>${escapeHtml(report.title)}</h1>
      <div class="meta">
        <span class="pill">Score: ${escapeHtml(report.score)}/100</span>
        <span class="pill">Calls: ${escapeHtml(report.callsCount)}</span>
        <span class="pill">Value at Risk: $${escapeHtml(report.valueAtRisk)}</span>
      </div>
    </section>
    <article>${markdownToHtml(report.markdown)}</article>
    <div class="footer">CallControl AI · Mini-audit report · generated locally</div>
  </main>
</body>
</html>`;
}

function markdownToHtml(markdown) {
  return String(markdown || "")
    .split(/\n+/)
    .map((line) => {
      if (line.startsWith("# ")) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
      if (line.startsWith("## ")) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
      if (line.startsWith("> ")) return `<blockquote>${escapeHtml(line.slice(2))}</blockquote>`;
      if (/^\d+\.\s/.test(line)) return `<p>${escapeHtml(line)}</p>`;
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join("\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function managerNameFromLegacy(legacy, managerId) {
  return (legacy.managers || []).find((manager) => manager.id === managerId)?.name || managerId;
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function countTags(calls) {
  return calls.flatMap((call) => call.tags || []).reduce((acc, tag) => {
    acc[tag] = (acc[tag] || 0) + 1;
    return acc;
  }, {});
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const safePath = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(rootDir, safePath === "/" ? "index.html" : safePath);

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(rootDir, "index.html");
  }

  const ext = path.extname(filePath);
  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=3600"
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/leads") {
    handleCreateLead(req, res);
    return;
  }
  if (url.pathname.startsWith("/api/") && !requireAppPin(req, res)) {
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/leads") {
    handleListLeads(res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/leads.csv") {
    handleLeadsCsv(res);
    return;
  }
  const leadMatch = url.pathname.match(/^\/api\/leads\/([^/]+)$/);
  if (req.method === "PATCH" && leadMatch) {
    handleUpdateLead(req, res, leadMatch[1]);
    return;
  }
  const leadReportMatch = url.pathname.match(/^\/api\/leads\/([^/]+)\/report$/);
  if (req.method === "POST" && leadReportMatch) {
    handleGenerateLeadReport(req, res, leadReportMatch[1]);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/state") {
    handleState(res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/me") {
    handleMe(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/invites") {
    handleCreateInvite(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/invites/accept") {
    handleAcceptInvite(req, res);
    return;
  }
  const userMatch = url.pathname.match(/^\/api\/users\/([^/]+)$/);
  if (req.method === "PATCH" && userMatch) {
    handleUpdateUser(req, res, userMatch[1]);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/billing/plans") {
    handleBillingPlans(res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/billing/checkout") {
    handleCreateCheckout(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/billing/usage") {
    handleBillingUsage(res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/files/register") {
    handleRegisterFile(req, res);
    return;
  }
  if (req.method === "PATCH" && url.pathname === "/api/workspace") {
    handleUpdateWorkspace(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/checklists") {
    handleCreateChecklist(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/export/state.json") {
    handleExportState(res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/dashboard") {
    handleDashboard(res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/calls") {
    handleCalls(res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/search") {
    handleSearchCalls(res, url.searchParams.get("q"));
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/calls") {
    handleCreateCall(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/calls/import-csv") {
    handleImportCsv(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/jobs/analyze-pending") {
    handleAnalyzePending(res);
    return;
  }
  const analyzeMatch = url.pathname.match(/^\/api\/calls\/([^/]+)\/analyze$/);
  if (req.method === "POST" && analyzeMatch) {
    handleAnalyzeCall(req, res, analyzeMatch[1]);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/reports/mini-audit") {
    handleGenerateMiniReport(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/reports") {
    handleReports(res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/demo/load-legacy-seed") {
    handleLoadLegacySeed(res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/demo/reset") {
    handleResetDemo(res);
    return;
  }
  const reportMatch = url.pathname.match(/^\/api\/reports\/([^/]+)\.md$/);
  if (req.method === "GET" && reportMatch) {
    handleReportMarkdown(res, reportMatch[1]);
    return;
  }
  const reportHtmlMatch = url.pathname.match(/^\/api\/reports\/([^/]+)\.html$/);
  if (req.method === "GET" && reportHtmlMatch) {
    handleReportHtml(res, reportHtmlMatch[1]);
    return;
  }
  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }
  sendJson(res, 405, { ok: false, error: "method_not_allowed" });
});

server.on("error", (error) => {
  console.error(`Cannot start server on ${host}:${port}: ${error.message}`);
  console.error("Try another port: PORT=8790 npm start");
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`CallControl AI demo backend: http://${host}:${port}`);
  console.log(`Leads API: http://${host}:${port}/api/leads`);
});
