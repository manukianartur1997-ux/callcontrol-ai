# CallControl Platform Demo — Phase 1 Notes

## What shipped

- Added a static `/platform/` demo zone for the future SaaS cabinet.
- Implemented hash routes:
  - `#owner/dashboard`
  - `#owner/value-at-risk`
  - `#owner/value-at-risk/{riskId}`
  - `#rop/today`
  - `#rop/calls`
  - `#rop/calls/{callId}`
  - `#rop/calls/manager/{managerId}`
  - phase placeholders for manager, marketing-vs-sales, manager ranking, and gold calls.
- Added static mock data for Value at Risk, risks, managers, calls, transcript annotations, and financial proof.
- Added dark B2B dashboard UI with CSS variables, fixed sidebar, topbar, role switcher, period switcher, locale switcher, and desktop-only gate.
- Added build integration: `build-pages.js` copies `/platform/` into `dist/platform/`.
- Added smoke checks for `/platform/` output.
- Added a public landing CTA to `/platform/`.
- Added Phase 2 surfaces: Marketing vs Sales Verdict, Manager Ranking, Manager Dashboard, Gold Calls Library, Dispute Modal, and Telegram Digest Modal.

## What is intentionally not done yet

- Gold Calls Library is still lightweight and should get richer card metadata later.
- Dispute Modal is clickable and sales-demo ready, but it does not persist state after refresh.
- Telegram Digest Modal is clickable and sales-demo ready, but settings are not editable yet.
- Filters are mostly presentational in Phase 1.
- Period switcher is presentational and does not change datasets yet.
- Locale switcher changes shell labels/copy where already wired, but screen body copy is still mostly RU-first.
- No backend, no auth, no real audio, no API calls.

## Things worth pruning later, not deleted now

- `generate-public-landing.js`, `generate-public-landing-lite.js`, and `generate-public-landing-live.js` now overlap in purpose. Keep for safety now; later choose one canonical landing generator.
- Old patch scripts (`index-polish-patch.js`, `index-layout-i18n-patch.js`, `index-i18n-normalize-patch.js`, `index-conversion-extra-patch.js`) look historical. Keep until the current public landing is stable.
- `variant-previews/` and `preview-dist/` are useful for design history, but should not be part of the public product story.
- `legacy-demo.html` keeps the old full demo surface alive. Good for preservation, but do not link it from public sales flow unless needed.
- Existing `admin.html` and `client.html` are still copied into `dist`; later decide whether they are operational assets or archive.

## Next target

Polish the clickable sales demo:

1. Stronger RU/UA/EN localization across screen body copy.
2. Period picker presets with different mock numbers.
3. Real filter behavior in Calls Queue.
4. Call-detail gold mode.
5. Richer Gold Calls Library metadata.
6. Demo script for an 8-minute sales walkthrough.
7. Optional screenshots/video walkthrough for sales use.
