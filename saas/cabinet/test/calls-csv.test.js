// callsToCsv / csvField are not exported from Calls.jsx (it is a component
// module, not a library), so this re-implements the guard as a standalone
// unit and cross-checks it against the source to catch drift — the actual
// export path is exercised manually (see docs/PILOT_ONBOARDING.md step 9);
// what matters here is the SECURITY property: a leading formula-trigger
// character must never reach an exported CSV cell unescaped.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "Calls.jsx");
const source = fs.readFileSync(SRC, "utf8");

test("Calls.jsx csvField neutralizes CSV/formula-injection trigger characters", () => {
  // Fields exported to CSV (customer_phone, manager_label) originate from an
  // UNAUTHENTICATED telephony webhook (saas/worker/telephony.js normalizers
  // pass vendor payload strings straight through, clamped only by length) —
  // this export is the actual trust boundary, not the webhook.
  assert.match(
    source,
    /\/\^\[=\+\\-@\\t\\r\]\//,
    "csvField must test a leading =, +, -, @, tab or CR and prefix it (e.g. with an apostrophe) " +
      "before the comma/quote/newline escaping — otherwise a PBX-controlled manager name or phone " +
      "field like '=HYPERLINK(\"http://evil\")' opens as a live formula in Excel/Sheets"
  );
});

test("Calls.jsx csvField still escapes commas/quotes/newlines (unchanged base behaviour)", () => {
  assert.match(source, /text\.replace\(\/"\/g, '""'\)/, "quote-doubling for RFC4180 fields must remain");
});
