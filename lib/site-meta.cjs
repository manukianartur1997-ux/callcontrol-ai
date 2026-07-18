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

// First-party page-view beacon: fire-and-forget POST to the Worker's
// /api/beacon endpoint (Workers Analytics Engine dataset, see wrangler.toml
// + cloudflare-worker.example.js). Privacy-sane by construction: no cookies,
// no IDs, no IP stored - only path, referrer origin, page language, and a
// coarse device-width bucket. Inline at the end of <body>, wrapped in
// try/catch, so it can never block or break page render. sendBeacon posts a
// plain string (no preflight); fetch keepalive is the fallback.
const BEACON_SCRIPT =
  '<script>(function(){try{var w=window.innerWidth||0,b=w<640?"s":w<1024?"m":"l";var r="";try{r=document.referrer?new URL(document.referrer).origin:""}catch(e){}if(r===location.origin)r="";var d=JSON.stringify({path:location.pathname,ref:r,lang:document.documentElement.lang||"",vw:b});if(navigator.sendBeacon)navigator.sendBeacon("/api/beacon",d);else fetch("/api/beacon",{method:"POST",body:d,keepalive:true}).catch(function(){})}catch(e){}})();</script>';

module.exports = { SITE_ORIGIN, OG_IMAGE_PATH, FAVICON, BEACON_SCRIPT };
