// Shared plumbing for the live one-off scripts in this directory.
//
// Secrets come from <repo root>/.env.local and must never reach stdout —
// these scripts run against the real Supabase project, so the only thing a
// script may print about a key is a keyHint()-style mask. The loader throws
// with the NAME of a missing variable, never its content.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ENV_PATH = new URL("../../.env.local", import.meta.url);

export function loadEnv(requiredKeys = []) {
  let raw;
  try {
    raw = readFileSync(ENV_PATH, "utf8");
  } catch {
    throw new Error(`.env.local not found at ${fileURLToPath(ENV_PATH)}`);
  }
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip one pair of surrounding quotes, if the value was quoted.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  const missing = requiredKeys.filter((k) => !env[k]);
  if (missing.length) throw new Error(`.env.local is missing: ${missing.join(", ")}`);
  return env;
}

// Thin PostgREST client over plain fetch. The key decides the role: the
// service key bypasses RLS, the publishable key is the anonymous client that
// verify-live.mjs uses to prove RLS holds.
export function restClient(supabaseUrl, key) {
  const base = String(supabaseUrl).replace(/\/+$/, "");
  return async function rest(method, path, { body, prefer } = {}) {
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };
    if (prefer) headers.Prefer = prefer;
    const res = await fetch(`${base}/rest/v1/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = method === "HEAD" ? "" : await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { status: res.status, ok: res.ok, data, headers: res.headers };
  };
}

// Loud, consistent failure: these scripts either finish or explain why not.
export function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}
