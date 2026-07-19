const fs = require("fs");
const { execFileSync } = require("child_process");

function run(command, args) {
  execFileSync(command, args, { stdio: "pipe" });
}

function assertIncludes(file, needle) {
  const content = fs.readFileSync(file, "utf8");
  if (!content.includes(needle)) {
    throw new Error(`${file} does not include: ${needle}`);
  }
}

function assertExcludes(file, needle) {
  const content = fs.readFileSync(file, "utf8");
  if (content.includes(needle)) {
    throw new Error(`${file} unexpectedly includes: ${needle}`);
  }
}

function assertMissing(file) {
  if (fs.existsSync(file)) {
    throw new Error(`${file} should not exist in dist/ (broken/unauthenticated dashboard risk)`);
  }
}

function assertPngSize(file, width, height) {
  const buffer = fs.readFileSync(file);
  if (buffer.slice(0, 8).toString("latin1") !== "\x89PNG\r\n\x1a\n") {
    throw new Error(`${file} does not start with a PNG signature`);
  }
  // IHDR is always the first chunk: width/height are big-endian uint32 at
  // byte offsets 16 and 20.
  const actualWidth = buffer.readUInt32BE(16);
  const actualHeight = buffer.readUInt32BE(20);
  if (actualWidth !== width || actualHeight !== height) {
    throw new Error(`${file} is ${actualWidth}x${actualHeight}, expected ${width}x${height}`);
  }
}

function assertRealPdf(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.length < 1000) {
    throw new Error(`${file} is too small to be a real rendered PDF (${buffer.length} bytes)`);
  }
  if (buffer.slice(0, 5).toString("latin1") !== "%PDF-") {
    throw new Error(`${file} does not start with a %PDF- header`);
  }
}

run("node", ["--check", "build-pages.js"]);
run("node", ["--check", "cloudflare-worker.example.js"]);
run("node", ["--check", "generate-public-landing-live.js"]);
run("node", ["build-pages.js"]);

assertIncludes("dist/index.html", "Аудит звонков отдела продаж за 5 рабочих дней");
assertIncludes("dist/ru/index.html", "Аудит звонков отдела продаж за 5 рабочих дней");
assertIncludes("dist/uk/index.html", "Аудит дзвінків відділу продажів за 5 робочих днів");
assertIncludes("dist/en/index.html", "Sales call audit in 5 business days");
assertIncludes("dist/ru/index.html", "Запросить аудит");
assertIncludes("dist/uk/index.html", "Запросити аудит");
assertIncludes("dist/en/index.html", "Request audit");
assertIncludes("dist/index.html", "/platform/");
assertIncludes("dist/platform/index.html", "CallControl AI - Platform Demo");
assertIncludes("dist/hybrid-demo.html", "Так выглядит пример отчёта");
assertIncludes("dist/samples/edtech-ua-sample-report.md", "Приклад структури");
assertIncludes("dist/legacy-demo.html", "CallControl AI Demo Room");
assertIncludes("dist/online-leads.html", "Операторский экран заявок");
assertIncludes("cloudflare-worker.example.js", "/api/health");
assertIncludes("cloudflare-worker.example.js", "needsClarification");

// client.html/admin.html only work against server.js-only routes
// (/api/dashboard, /api/state, /api/calls, /api/billing/*) that do not
// exist in the Cloudflare Pages Function or Worker. They must never ship to
// dist/, and nothing in dist/ should link to them.
assertMissing("dist/admin.html");
assertMissing("dist/client.html");
for (const file of ["dist/index.html", "dist/ru/index.html", "dist/uk/index.html", "dist/en/index.html", "dist/hybrid-demo.html"]) {
  assertExcludes(file, "/client.html");
  assertExcludes(file, "/admin.html");
}

// The "Посмотреть пример"/"Download PDF" CTAs must point at a real rendered
// report, not the raw .md source or a browser print instruction.
assertIncludes("dist/index.html", "/samples/b2b-saas-ru-sample-report.html");
assertIncludes("dist/index.html", "/samples/b2b-saas-ru-sample-report.pdf");
assertIncludes("dist/samples/b2b-saas-ru-sample-report.html", "Короткий вывод");
assertIncludes("dist/samples/b2b-saas-ru-sample-report.html", "Скачать PDF");
assertIncludes("dist/samples/edtech-ua-sample-report.html", "Короткий висновок");
assertRealPdf("dist/samples/b2b-saas-ru-sample-report.pdf");
assertRealPdf("dist/samples/edtech-ua-sample-report.pdf");

// Self-serve pricing calculator: call-volume slider + add-ons + live total.
for (const file of ["dist/index.html", "dist/ru/index.html", "dist/uk/index.html", "dist/en/index.html"]) {
  assertIncludes(file, 'id="calcCalls"');
  assertIncludes(file, 'data-calc-addon');
  assertIncludes(file, "calcTotal");
}

// The EN sample report must be the actual English report, not the RU one
// (regression check: this pointed at b2b-saas-ru-sample-report.* before).
assertIncludes("dist/en/index.html", "/samples/b2b-saas-en-sample-report.html");
assertIncludes("dist/en/index.html", "/samples/b2b-saas-en-sample-report.pdf");
assertExcludes("dist/en/index.html", "/samples/b2b-saas-ru-sample-report");
assertIncludes("dist/samples/b2b-saas-en-sample-report.html", "Executive summary");
assertRealPdf("dist/samples/b2b-saas-en-sample-report.pdf");

// Comparison table: present on every locale, with the CallControl row plus
// four named competitors (a couple more than the original three).
for (const file of ["dist/ru/index.html", "dist/uk/index.html", "dist/en/index.html"]) {
  assertIncludes(file, 'id="compare"');
  assertIncludes(file, "cmp-table");
  assertIncludes(file, "Gong");
  assertIncludes(file, "Fireflies");
  assertIncludes(file, "Wingman");
  assertIncludes(file, "Salesloft");
}

// Lead-form anti-spam: the honeypot field must ship on every locale (paired
// with server-side filtering in lib/lead.js's spamReason).
for (const file of ["dist/ru/index.html", "dist/uk/index.html", "dist/en/index.html"]) {
  assertIncludes(file, 'name="company_website"');
  assertIncludes(file, "formElapsedMs");
}

// Mobile nav must keep the booking CTA reachable (regression check: this
// used to hide the entire nav, CTA included, below 980px).
for (const file of ["dist/ru/index.html", "dist/uk/index.html", "dist/en/index.html"]) {
  assertIncludes(file, ".nav-links a:not(.nav-cta){display:none}");
}

// First-visit language auto-detect: every landing variant must ship the
// pre-paint redirect script (saved cc:locale wins, navigator.languages
// decides otherwise, English is the universal fallback) plus the lang-pill
// handler that persists a manual choice.
for (const file of ["dist/index.html", "dist/ru/index.html", "dist/uk/index.html", "dist/en/index.html"]) {
  assertIncludes(file, 'localStorage.getItem("cc:locale")');
  assertIncludes(file, "navigator.languages");
  assertIncludes(file, "location.replace");
  assertIncludes(file, 'localStorage.setItem("cc:locale"');
}

// OG/SEO: every landing variant must carry canonical + hreflang + OG/Twitter
// tags with absolute URLs, and the share image must be a real 1200x630 PNG.
const SITE_ORIGIN = "https://callcontrol-ai-demo.manukianartur1997.workers.dev";
for (const file of ["dist/index.html", "dist/ru/index.html", "dist/uk/index.html", "dist/en/index.html", "dist/hybrid-demo.html"]) {
  assertIncludes(file, 'rel="canonical"');
  assertIncludes(file, 'hreflang="x-default"');
  assertIncludes(file, `<meta property="og:image" content="${SITE_ORIGIN}/og-image.png"/>`);
  assertIncludes(file, '<meta property="og:image:width" content="1200"/>');
  assertIncludes(file, '<meta property="og:image:height" content="630"/>');
  assertIncludes(file, '<meta name="twitter:card" content="summary_large_image"/>');
}
// Per-locale canonical/og:url + localized og:title (dist/index.html and
// hybrid-demo.html are ru copies, so their canonical points at /ru/).
assertIncludes("dist/index.html", `<link rel="canonical" href="${SITE_ORIGIN}/ru/"/>`);
assertIncludes("dist/hybrid-demo.html", `<link rel="canonical" href="${SITE_ORIGIN}/ru/"/>`);
for (const locale of ["ru", "uk", "en"]) {
  assertIncludes(`dist/${locale}/index.html`, `<link rel="canonical" href="${SITE_ORIGIN}/${locale}/"/>`);
  assertIncludes(`dist/${locale}/index.html`, `<meta property="og:url" content="${SITE_ORIGIN}/${locale}/"/>`);
}
assertIncludes("dist/ru/index.html", '<meta property="og:title" content="CallControl AI — аудит звонков отдела продаж"/>');
assertIncludes("dist/uk/index.html", '<meta property="og:title" content="CallControl AI — аудит дзвінків відділу продажів"/>');
assertIncludes("dist/en/index.html", '<meta property="og:title" content="CallControl AI — sales call audit"/>');
assertPngSize("dist/og-image.png", 1200, 630);

// Sample report pages share the OG card and declare their own canonical.
assertIncludes("dist/samples/b2b-saas-en-sample-report.html", `<link rel="canonical" href="${SITE_ORIGIN}/samples/b2b-saas-en-sample-report.html" />`);
assertIncludes("dist/samples/b2b-saas-en-sample-report.html", 'content="summary_large_image"');

// robots.txt + sitemap.xml: canonical public pages only; internal/duplicate
// pages stay out of the index.
assertIncludes("dist/robots.txt", `Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
assertIncludes("dist/robots.txt", "Disallow: /online-leads.html");
for (const p of ["/ru/", "/uk/", "/en/", "/platform/", "/samples/b2b-saas-en-sample-report.html"]) {
  assertIncludes("dist/sitemap.xml", `<loc>${SITE_ORIGIN}${p}</loc>`);
}
assertExcludes("dist/sitemap.xml", "hybrid-demo");

// First-party analytics beacon: fire-and-forget client ping on every public
// page + the /api/beacon Analytics Engine endpoint in the worker.
for (const file of ["dist/index.html", "dist/ru/index.html", "dist/uk/index.html", "dist/en/index.html", "dist/platform/index.html", "dist/samples/b2b-saas-en-sample-report.html"]) {
  assertIncludes(file, '"/api/beacon"');
  assertIncludes(file, "sendBeacon");
}
assertIncludes("cloudflare-worker.example.js", "/api/beacon");
assertIncludes("cloudflare-worker.example.js", "writeDataPoint");
assertIncludes("wrangler.toml", "analytics_engine_datasets");

// MONEY REPORT: the lost-revenue hero computation (dropped/under-pushed
// leads × average check = $X/month) must ship on every locale as an
// editable-looking worked example, and the sample reports must carry the
// same explicit computation instead of a floating Value-at-Risk number.
for (const file of ["dist/index.html", "dist/ru/index.html", "dist/uk/index.html", "dist/en/index.html"]) {
  assertIncludes(file, 'id="mcLeads"');
  assertIncludes(file, 'id="mcLost"');
  assertIncludes(file, 'id="mcCheck"');
  assertIncludes(file, 'id="mcResult"');
  assertIncludes(file, "$8,400");
}
assertIncludes("dist/samples/edtech-ua-sample-report.md", "28 втрачених лідів × $300");
assertIncludes("dist/samples/b2b-saas-ru-sample-report.md", "28 потерянных лидов × $300");
assertIncludes("dist/samples/b2b-saas-en-sample-report.md", "28 lost leads × $300");
assertIncludes("dist/samples/edtech-ua-sample-report.html", "$8,400");
assertIncludes("dist/samples/b2b-saas-ru-sample-report.html", "$8,400");
assertIncludes("dist/samples/b2b-saas-en-sample-report.html", "Lost revenue (Value at Risk)");

// TRIPWIRE OFFER: the entry rung above the three tiers plus the calculator
// mode switch. The price stays a visibly bracketed placeholder until Artur
// confirms the range.
assertIncludes("dist/ru/index.html", "Экспресс-срез");
assertIncludes("dist/uk/index.html", "Експрес-зріз");
assertIncludes("dist/en/index.html", "Express Snapshot");
for (const file of ["dist/ru/index.html", "dist/uk/index.html", "dist/en/index.html"]) {
  assertIncludes(file, "tripwire-card");
  assertIncludes(file, "[$300–500]");
  assertIncludes(file, 'name="calcMode"');
  assertIncludes(file, 'value="tripwire"');
}

// PRICE ANCHORS: subscription/retainer alternatives vs the one-time audit
// (sources are cited as comments next to the `anchors` copy in the
// generator).
for (const file of ["dist/ru/index.html", "dist/uk/index.html", "dist/en/index.html"]) {
  assertIncludes(file, "anchor-strip");
  assertIncludes(file, "OttoQA");
  assertIncludes(file, "$900");
}
assertIncludes("dist/ru/index.html", "ОКК на аутсорсе");
assertIncludes("dist/uk/index.html", "ОКК на аутсорсі");
assertIncludes("dist/en/index.html", "Outsourced QA dept");

// INTEGRATION MATRIX: all seven named systems on every locale, honest
// wording (recordings via export/API, no fake logos), format tags present.
for (const file of ["dist/ru/index.html", "dist/uk/index.html", "dist/en/index.html"]) {
  assertIncludes(file, 'id="integrations"');
  for (const name of ["Binotel", "Ringostat", "Phonet", "UniTalk", "KeyCRM", "amoCRM", "Bitrix24"]) {
    assertIncludes(file, name);
  }
  assertIncludes(file, "int-tag");
}

// CROSS-PROMO: every landing locale and every sample report links the
// author's OTHER three products (CV Reality Check / ShipShape / Artur's
// site), never CallControl itself as a promo card.
for (const file of [
  "dist/index.html", "dist/ru/index.html", "dist/uk/index.html", "dist/en/index.html",
  "dist/samples/b2b-saas-ru-sample-report.html", "dist/samples/edtech-ua-sample-report.html", "dist/samples/b2b-saas-en-sample-report.html"
]) {
  assertIncludes(file, "https://cv-clarity-check.lovable.app");
  assertIncludes(file, "https://tanstack-start-app.manukianartur1997.workers.dev");
  assertIncludes(file, "https://ai.manukianartur1997.workers.dev");
}

// PRICING LADDER: one visible 4-step progression — Express Snapshot (step 1,
// already covered by the tripwire assertions above) -> full audit tiers
// (step 2) -> CRM implementation from $1,000 (step 3, new) -> monthly
// quality-control retainer from $500/mo (step 4, new). All four rungs must
// render inside a single `.ladder` wrapper with numbered steps, and both
// new rungs must use vilka-style "from $X" pricing (never a rigid number).
for (const file of ["dist/ru/index.html", "dist/uk/index.html", "dist/en/index.html"]) {
  assertIncludes(file, 'class="ladder"');
  assertIncludes(file, 'class="ladder-step"');
  assertIncludes(file, '<div class="ladder-num">1</div>');
  assertIncludes(file, '<div class="ladder-num">2</div>');
  assertIncludes(file, '<div class="ladder-num">3</div>');
  assertIncludes(file, '<div class="ladder-num">4</div>');
  assertIncludes(file, "ladder-unlock");
  assertIncludes(file, "ladder-card");
}
assertIncludes("dist/ru/index.html", "Внедрение в CRM");
assertIncludes("dist/ru/index.html", "от $1,000");
assertIncludes("dist/ru/index.html", "Ежемесячный контроль качества");
assertIncludes("dist/ru/index.html", "от $500/мес");
assertIncludes("dist/uk/index.html", "Впровадження в CRM");
assertIncludes("dist/uk/index.html", "від $1,000");
assertIncludes("dist/uk/index.html", "Щомісячний контроль якості");
assertIncludes("dist/uk/index.html", "від $500/міс");
assertIncludes("dist/en/index.html", "CRM implementation");
assertIncludes("dist/en/index.html", "from $1,000");
assertIncludes("dist/en/index.html", "Monthly quality control");
assertIncludes("dist/en/index.html", "from $500/mo");

// KeyCRM/amoCRM must be named as the CRM-implementation targets, and the
// step-3 scope must stay fixed-scope (not open-ended hours).
for (const file of ["dist/ru/index.html", "dist/uk/index.html", "dist/en/index.html"]) {
  assertIncludes(file, "KeyCRM");
  assertIncludes(file, "amoCRM");
}

// Calculator stays consistent with the new ladder: the retainer is a note,
// not a computed line item (no new #calc* input wired to it).
for (const file of ["dist/ru/index.html", "dist/uk/index.html", "dist/en/index.html"]) {
  assertIncludes(file, "calc-retainer-note");
}
assertIncludes("dist/ru/index.html", "перейти на ежемесячный контроль качества от $500/мес");
assertIncludes("dist/uk/index.html", "перейти на щомісячний контроль якості від $500/міс");
assertIncludes("dist/en/index.html", "move to monthly quality control from $500/mo");

// No product in this ladder round ships an unconfirmed numeric placeholder
// for the two new rungs (the pre-existing tripwire bracket is intentional
// and already covered above) — $1,000/$500 come straight from the shared
// ladder rules, so they must render as plain vilka pricing.
for (const file of ["dist/ru/index.html", "dist/uk/index.html", "dist/en/index.html"]) {
  assertExcludes(file, "[$1,000]");
  assertExcludes(file, "[$500");
}

console.log("Smoke check passed");
