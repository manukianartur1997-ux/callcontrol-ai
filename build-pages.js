const fs = require("fs");
const path = require("path");

const root = __dirname;
const outDir = path.join(root, "dist");

// admin.html and client.html are intentionally NOT shipped here: they only
// work against server.js's local-only routes (/api/dashboard, /api/state,
// /api/calls, /api/billing/*, ...), which do not exist as Cloudflare Pages
// Functions. Publishing them would put an unauthenticated-looking, entirely
// broken dashboard on the live domain. They remain available for local use
// via `npm start` (see README).
const files = [
  "online-leads.html",
  "mini-audit-template.html",
  "sample-import.csv",
  "README.md",
  "PUBLISH_NOW.md",
  "DEPLOYMENT_CHECKLIST.md",
  "_headers",
  // 1200x630 share card referenced by every page's og:image/twitter:image
  // (absolute URL built in lib/site-meta.js).
  "og-image.png"
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

async function build() {
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

  // Generates dist/index.html + locales + the sample report .html/.pdf
  // pairs. Awaited because sample-report PDF rendering is async (pdfkit).
  await require("./generate-public-landing-live")();

  copyDir(path.join(root, "platform"), path.join(outDir, "platform"));

  console.log(`Cloudflare Pages build ready: hybrid demo room -> dist/`);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
