// Shared site-level metadata for the static generators
// (generate-public-landing-live.js and generate-sample-reports.js).
// Kept in one place so canonical/OG URLs and the favicon can never drift
// between the landing pages and the sample-report pages.

// Public origin the site is served from. Absolute URLs built from this are
// required for og:image / og:url / canonical (scrapers do not resolve
// relative URLs against the page).
const SITE_ORIGIN = "https://callcontrol-ai-demo.manukianartur1997.workers.dev";

// Static 1200x630 share card (rendered from the landing's exact palette:
// #020617 background ramp + #38bdf8->#4f46e5 brand gradient). Lives at the
// repo root, copied into dist/ by build-pages.js. One image for all locales.
const OG_IMAGE_PATH = "/og-image.png";

// Inline SVG favicon (same teal->indigo brand gradient as the primary
// button) as a data URI. Avoids a 404 on /favicon.ico without adding an
// extra build asset.
const FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#4f46e5"/>' +
      "</linearGradient></defs>" +
      '<rect width="64" height="64" rx="15" fill="url(#g)"/>' +
      '<path d="M42 24a13 13 0 1 0 0 16" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>' +
      "</svg>"
  );

// Page analytics. Microsoft Clarity (free, unlimited - heatmaps + session
// recordings) loads only when a project id is supplied at build time via the
// CLARITY_PROJECT_ID env var; with no id the pages ship zero analytics code
// and make zero third-party requests.
//
// Deliberately NOT Workers Analytics Engine: that binding needs a paid
// Workers plan and is what broke the Cloudflare deploy on 2026-07-18
// (run 29658215356, step "Deploy Worker").
const CLARITY_PROJECT_ID = (process.env.CLARITY_PROJECT_ID || "").trim();

const ANALYTICS_SCRIPT = CLARITY_PROJECT_ID
  ? '<script>(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};' +
    't=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;' +
    'y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})' +
    '(window,document,"clarity","script",' +
    JSON.stringify(CLARITY_PROJECT_ID) +
    ");</script>"
  : "";

module.exports = {
  SITE_ORIGIN,
  OG_IMAGE_PATH,
  FAVICON,
  CLARITY_PROJECT_ID,
  ANALYTICS_SCRIPT
};
