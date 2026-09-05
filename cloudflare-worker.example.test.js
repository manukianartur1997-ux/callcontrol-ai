// scheduled()'s cron branching, tested at the source-shape level.
//
// Why not a behavioral test: createApi({ env }) and dailyDigest(env)/
// purgeExpiredData(env) are called here with NO injectable fetchImpl (this
// file always uses the real global fetch), so a true behavioral test would
// require monkey-patching globalThis.fetch across a Supabase-shaped request
// sequence — high effort for a control-flow bug. What actually matters is
// structural: sweepStuckCalls must fire on exactly ONE of the two triggers,
// never both, because 17:00 UTC ("0 17 * * *") is ALSO a "*/30 * * * *"
// boundary — Cloudflare fires scheduled() twice around that minute, and an
// unconditional sweep call would let both invocations race the same stuck-
// call worklist (double AI spend, double quota consumption; see
// docs/PLATFORM_OPS.md).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./cloudflare-worker.example.js", import.meta.url), "utf8");

// Depth-counted brace matching from the char right after `marker`'s opening
// "{" to its true closing "}" — a naive indexOf("}") stops at the first
// nested one (e.g. inside a `.catch(() => {})`), which is exactly wrong here.
function bracedBlock(text, fromIndex) {
  const openIdx = text.indexOf("{", fromIndex);
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(openIdx + 1, i);
    }
  }
  throw new Error("unbalanced braces");
}

function scheduledBody() {
  const start = source.indexOf("async scheduled(event, env, ctx) {");
  assert.ok(start >= 0, "scheduled() not found");
  return bracedBlock(source, start);
}

test("scheduled(): sweepStuckCalls is gated to the */30 trigger only", () => {
  const body = scheduledBody();
  const sweepIdx = body.indexOf("sweepStuckCalls()");
  assert.ok(sweepIdx >= 0, "sweepStuckCalls() call not found in scheduled()");

  const guard = body.lastIndexOf('if (event.cron === "*/30 * * * *")', sweepIdx);
  assert.ok(guard >= 0 && guard < sweepIdx, "sweepStuckCalls() must be inside the */30 * * * * branch");

  // And NOT also reachable unconditionally before that guard (the exact shape
  // of the regression: `const jobs = [saasApi.sweepStuckCalls()...]` at the
  // top of the function, outside any cron check).
  const unconditional = /const jobs = \[\s*saasApi\.sweepStuckCalls/.test(body);
  assert.equal(unconditional, false, "sweepStuckCalls must not run unconditionally on every tick");
});

test("scheduled(): the daily jobs (digest/purge/platformDigest) are gated to the 0 17 trigger, and that branch excludes the sweep", () => {
  const body = scheduledBody();
  const dailyGuardIdx = body.indexOf('if (event.cron === "0 17 * * *")');
  assert.ok(dailyGuardIdx >= 0, "the daily-cron guard was not found");

  const dailyBlock = bracedBlock(body, dailyGuardIdx);

  assert.match(dailyBlock, /dailyDigest\(env\)/);
  assert.match(dailyBlock, /purgeExpiredData\(env\)/);
  assert.match(dailyBlock, /saasApi\.platformDigest\(\)/);
  assert.equal(dailyBlock.includes("sweepStuckCalls"), false, "the daily branch must not also run the sweep");
});
