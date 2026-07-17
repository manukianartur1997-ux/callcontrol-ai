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

console.log("Smoke check passed");
