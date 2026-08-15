const fs = require("fs");
const path = require("path");
const { ANALYTICS_SCRIPT } = require("./lib/site-meta.cjs");

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

  // The one-page offer PDF (UA/RU/EN) — the artifact attached to cold emails.
  // Built here so the copy stays in version control instead of a Downloads
  // folder, and so a copy change can never overflow it to two pages unnoticed.
  const { SITE_ORIGIN } = require("./lib/site-meta.cjs");
  const onePagers = await require("./generate-onepager").generateOnePagers(outDir, {
    siteOrigin: SITE_ORIGIN
  });
  console.log(`One-pager PDFs ready: ${onePagers.length} locales -> dist/onepager/`);

  copyDir(path.join(root, "platform"), path.join(outDir, "platform"));
  // The platform demo is a static file, so the build substitutes the same
  // opt-in analytics snippet the generators inject (empty unless
  // CLARITY_PROJECT_ID is set at build time). See lib/site-meta.cjs.
  const platformIndex = path.join(outDir, "platform", "index.html");
  fs.writeFileSync(
    platformIndex,
    fs.readFileSync(platformIndex, "utf8").replace("<!--ANALYTICS-->", ANALYTICS_SCRIPT)
  );

  console.log(`Cloudflare Pages build ready: hybrid demo room -> dist/`);

  // The cabinet SPA build lives HERE, not in the deploy workflow: the CI job
  // invokes `node build-pages.js` directly, and edits to .github/workflows/*
  // are rejected by the local push credential (no workflow scope). Keeping the
  // whole build behind this one entry point also means smoke, CI and
  // `npm run build` can never disagree about what a full build is.
  const { execFileSync } = require("child_process");
  execFileSync("npx", ["vite", "build"], { cwd: root, stdio: "inherit" });
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
