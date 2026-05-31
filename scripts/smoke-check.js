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

run("node", ["--check", "build-pages.js"]);
run("node", ["--check", "cloudflare-worker.example.js"]);
run("node", ["--check", "generate-hybrid-landing.js"]);
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

console.log("Smoke check passed");
