const fs = require("fs");
const path = require("path");

const root = __dirname;
const outDir = path.join(root, "dist");

const files = [
  "admin.html",
  "client.html",
  "online-leads.html",
  "mini-audit-template.html",
  "sample-import.csv",
  "README.md",
  "PUBLISH_NOW.md",
  "DEPLOYMENT_CHECKLIST.md",
  "_headers"
];

function copyDir(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) return;
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(source, target);
    } else {
      fs.copyFileSync(source, target);
    }
  }
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const file of files) {
  const source = path.join(root, file);
  if (!fs.existsSync(source)) continue;
  fs.copyFileSync(source, path.join(outDir, file));
}

const legacySource = path.join(root, "index.html");
if (fs.existsSync(legacySource)) {
  fs.copyFileSync(legacySource, path.join(outDir, "legacy-demo.html"));
}

require("./generate-public-landing-live")();

copyDir(path.join(root, "platform"), path.join(outDir, "platform"));

function injectPlatformLink(file) {
  const fullPath = path.join(outDir, file);
  if (!fs.existsSync(fullPath)) return;
  const html = fs.readFileSync(fullPath, "utf8");
  if (html.includes("/platform/")) return;
  const link = `<a href="/platform/" style="position:fixed;right:18px;bottom:18px;z-index:50;padding:11px 14px;border:1px solid rgba(148,163,184,.35);border-radius:999px;background:rgba(15,23,42,.9);color:#fff;text-decoration:none;font:600 13px Inter,system-ui,sans-serif;box-shadow:0 18px 45px rgba(0,0,0,.24)">Platform demo</a>`;
  fs.writeFileSync(fullPath, html.replace("</body>", `${link}</body>`));
}

for (const file of ["index.html", "ru/index.html", "uk/index.html", "en/index.html"]) {
  injectPlatformLink(file);
}

console.log(`Cloudflare Pages build ready: hybrid demo room -> dist/`);
