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

console.log("Smoke check passed");
