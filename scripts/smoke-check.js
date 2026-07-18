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

console.log("Smoke check passed");
