// Cabinet i18n guarantees, enforced (the cabinet previously had zero tests):
//   1. uk / ru / en share ONE key tree — no key missing or extra in any locale.
//   2. every leaf is a non-empty string, or an array of non-empty strings
//      (plural forms) — never undefined/null/"".
//   3. no orphan reference: every `copy.a.b[.c]`, aliased `const t = copy.a.b`
//      → `t.c`, and `copyGet("a.b.c")` literal in the cabinet source resolves
//      in the dictionary.
// Pure node:test over the real copy.js (it is browser-safe to import: the
// localStorage/document touches are guarded).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALES, copy, copyGet, setLocale } from "../src/copy.js";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

function leaves(obj, prefix = "", out = new Map()) {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const p = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) leaves(value, p, out);
    else out.set(p, value);
  }
  return out;
}

function snapshot(locale) {
  setLocale(locale);
  return leaves(copy);
}

const uk = snapshot("uk");

test("i18n: LOCALES is exactly uk/ru/en and the tree is non-trivial", () => {
  assert.deepEqual(LOCALES, ["uk", "ru", "en"]);
  assert.ok(uk.size > 400, `expected a real dictionary, got ${uk.size} leaves`);
});

for (const locale of LOCALES.filter((l) => l !== "uk")) {
  test(`i18n: ${locale} has exactly the uk key tree (no missing, no extra keys)`, () => {
    const other = snapshot(locale);
    const missing = [...uk.keys()].filter((k) => !other.has(k));
    const extra = [...other.keys()].filter((k) => !uk.has(k));
    assert.deepEqual(missing, [], `${locale} is MISSING keys present in uk`);
    assert.deepEqual(extra, [], `${locale} has EXTRA keys absent from uk`);
    assert.equal(other.size, uk.size);
  });
}

for (const locale of LOCALES) {
  test(`i18n: every ${locale} leaf is a non-empty string or a non-empty string array`, () => {
    const bad = [];
    for (const [key, value] of snapshot(locale)) {
      const okString = typeof value === "string" && value.trim() !== "";
      const okArray =
        Array.isArray(value) && value.length > 0 && value.every((s) => typeof s === "string" && s.trim() !== "");
      if (!okString && !okArray) bad.push(`${key} = ${JSON.stringify(value)}`);
    }
    assert.deepEqual(bad, [], `${locale} has empty/invalid leaves`);
  });
}

// --- orphan references -----------------------------------------------------

function resolve(dotPath) {
  let node = copy; // uk is active again below; the Proxy resolves section access
  for (const part of dotPath.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = node[part];
    if (node === undefined) return undefined;
  }
  return node;
}

test("i18n: no orphan copy.* / alias / copyGet references in the cabinet source", () => {
  setLocale("uk");
  const files = fs
    .readdirSync(SRC)
    .filter((f) => /\.(jsx|js)$/.test(f) && f !== "copy.js")
    .map((f) => path.join(SRC, f));
  assert.ok(files.length >= 10, `expected the cabinet sources, found ${files.length}`);

  const orphans = [];
  const seen = new Set();
  const check = (file, dotPath, via) => {
    const tag = `${path.basename(file)}: ${via} -> copy.${dotPath}`;
    if (seen.has(tag)) return;
    seen.add(tag);
    if (resolve(dotPath) === undefined) orphans.push(tag);
  };

  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");

    // 1) direct copy.a.b[.c] chains (stop at any non-identifier char, e.g. `[`)
    //    (lookbehind excludes module specifiers like "./copy.js"; the ".js"
    //    guard catches the bare `from "copy.js"` form too)
    for (const m of src.matchAll(/(?<![\w$./])copy((?:\.[A-Za-z_$][\w$]*)+)/g)) {
      if (m[1] === ".js" || m[1] === ".jsx") continue;
      check(file, m[1].slice(1), "direct");
    }

    // 2) aliases: const|let t = copy.a.b;  then t.c … (all bindings of a name
    //    in the file are accepted, so re-used alias names don't false-positive)
    const aliases = new Map();
    for (const m of src.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*copy((?:\.[A-Za-z_$][\w$]*)+)\s*;?/g)) {
      const list = aliases.get(m[1]) || [];
      list.push(m[2].slice(1));
      aliases.set(m[1], list);
    }
    for (const [alias, bases] of aliases) {
      const usage = new RegExp(`(?<![\\w$.])${alias.replace(/\$/g, "\\$")}\\.([A-Za-z_$][\\w$]*)`, "g");
      for (const m of src.matchAll(usage)) {
        const leaf = m[1];
        const ok = bases.some((base) => resolve(`${base}.${leaf}`) !== undefined);
        const tag = `${path.basename(file)}: alias ${alias}.${leaf} (bases: ${bases.join(" | ")})`;
        if (!ok && !seen.has(tag)) {
          seen.add(tag);
          orphans.push(tag);
        }
      }
    }

    // 3) copyGet("a.b.c") string literals must resolve to a STRING leaf
    for (const m of src.matchAll(/copyGet\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
      if (typeof copyGet(m[1]) !== "string") orphans.push(`${path.basename(file)}: copyGet("${m[1]}") is not a string leaf`);
    }
  }
  assert.deepEqual(orphans, [], "orphan copy references (key used in source but absent from copy.js)");
});
