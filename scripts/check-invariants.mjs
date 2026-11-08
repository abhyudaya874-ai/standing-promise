#!/usr/bin/env node
// Mechanical invariant checks. Fast (<1s), no dependencies. Run by `npm run verify`.
// A small model forgets rules; a script does not. Exit 1 on any FAIL.
// Missing files are SKIPPED (the app is built incrementally), never failed.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const results = [];
const pass = (name) => results.push({ ok: true, name });
const fail = (name, detail) => results.push({ ok: false, name, detail });
const skip = (name, why) => results.push({ ok: true, name, skipped: why });

/** Remove comments but keep line numbers, so reports point at the real line. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}
const read = (p) => readFileSync(p, "utf8");
function lineOf(src, index) {
  return src.slice(0, index).split("\n").length;
}
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".next", ".git"].includes(name)) continue;
    const p = join(dir, name);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}
const codeFiles = ["lib", "db", "app", "components"].flatMap((d) => walk(d)).filter((f) => /\.tsx?$/.test(f));

// 1. verdict purity ---------------------------------------------------------
const VERDICT = "lib/verdict.ts";
if (!existsSync(VERDICT)) skip("verdict is pure", `${VERDICT} not created yet`);
else {
  const raw = read(VERDICT);
  const src = stripComments(raw);
  const banned = [
    [/\bfetch\s*\(/, "fetch"], [/Date\.now\s*\(/, "Date.now"], [/new Date\s*\(/, "new Date"],
    [/Math\.random/, "Math.random"], [/process\.env/, "process.env"], [/console\./, "console"],
    [/randomUUID/, "randomUUID"], [/^\s*import\s/m, "import (verdict.ts imports nothing)"],
    [/\brequire\s*\(/, "require"], [/\basync\b|\bawait\b/, "async/await (must be synchronous)"],
  ];
  let bad = false;
  for (const [re, label] of banned) {
    const m = re.exec(src);
    if (m) { fail("verdict is pure", `${VERDICT}:${lineOf(src, m.index)} uses ${label}`); bad = true; }
  }
  if (!bad) pass("verdict is pure");
  raw.includes("@deterministic") ? pass("verdict keeps @deterministic marker") : fail("verdict keeps @deterministic marker", `${VERDICT} lost its @deterministic marker`);
}

// 2. reason codes: verdict.ts == ARCHITECTURE.md == tests ------------------------
const ARCH = "docs/ARCHITECTURE.md";
if (!existsSync(VERDICT) || !existsSync(ARCH)) skip("reason codes in sync", "verdict.ts or ARCHITECTURE.md missing");
else {
  const v = read(VERDICT);
  const arr = /REASON_CODES\s*=\s*\[([\s\S]*?)\]\s*as const/.exec(v);
  const inCode = new Set(arr ? [...arr[1].matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]) : []);
  const inDocs = new Set([...read(ARCH).matchAll(/^\|\s*`([A-Z_]+)`\s*\|/gm)].map((m) => m[1]));
  const testFile = "lib/verdict.test.ts";
  const testSrc = existsSync(testFile) ? read(testFile) : "";
  const problems = [];
  for (const c of inCode) {
    if (!inDocs.has(c)) problems.push(`${c} missing from ${ARCH} table`);
    if (!testSrc.includes(`"${c}"`)) problems.push(`${c} has no row in ${testFile}`);
  }
  for (const c of inDocs) if (!inCode.has(c)) problems.push(`${c} is in ${ARCH} but not in REASON_CODES`);
  if (inCode.size === 0) problems.push("could not parse REASON_CODES array");
  problems.length ? fail("reason codes in sync", problems.join("; ")) : pass("reason codes in sync");
}

// 3. no floats on the money path --------------------------------------------
const integrationFiles = walk("lib/integrations").filter((f) => /\.ts$/.test(f) && !f.endsWith(".test.ts"));
const MONEY = ["lib/money.ts", "lib/capture.ts", "lib/paypal.ts", "lib/verdict.ts", "db/schema.ts", "app/api/promise/route.ts", "lib/studio/rows.ts", ...integrationFiles].filter(existsSync);
if (MONEY.length === 0) skip("no floats on money path", "no money files yet");
else {
  const re = /parseFloat|\.toFixed\s*\(|\bnumeric\s*\(|\breal\s*\(|doublePrecision|\bfloat\b|[*\/]\s*100\b/; // also bans price * 100 and amount / 100
  const hits = [];
  for (const f of MONEY) {
    const src = stripComments(read(f));
    const m = re.exec(src);
    if (m) hits.push(`${f}:${lineOf(src, m.index)} uses ${m[0]}`);
  }
  hits.length ? fail("no floats on money path", hits.join("; ")) : pass("no floats on money path");
}

// 3b. INR is not a payable currency (PayPal does not process it) -------------------
if (existsSync("lib/money.ts")) {
  const m = /SUPPORTED_CURRENCIES\s*=\s*\[([\s\S]*?)\]\s*as const/.exec(read("lib/money.ts"));
  if (!m) fail("INR is not payable", "could not parse SUPPORTED_CURRENCIES in lib/money.ts");
  else /"INR"/.test(m[1]) ? fail("INR is not payable", "lib/money.ts lists INR as payable: PayPal cannot process INR") : pass("INR is not payable");
}

// 4. agents never decide ----------------------------------------------------
const agentFiles = walk("lib/agent").filter((f) => /\.ts$/.test(f) && !f.endsWith(".test.ts"));
if (agentFiles.length === 0) skip("agents never call computeVerdict", "lib/agent not created yet");
else {
  const hits = [];
  for (const f of agentFiles) {
    const src = stripComments(read(f));
    const m = /computeVerdict|from\s+["']@\/lib\/verdict["']\s*;?\s*$/m.exec(src);
    // importing TYPES from verdict is allowed; calling or importing the function is not
    if (/computeVerdict/.test(src)) hits.push(`${f}:${lineOf(src, src.indexOf("computeVerdict"))} references computeVerdict`);
    else if (m && /^import\s+(?!type)/m.test(m[0])) hits.push(`${f} imports a value from lib/verdict (use \`import type\`)`);
  }
  hits.length ? fail("agents never call computeVerdict", hits.join("; ")) : pass("agents never call computeVerdict");
}

// 4b. integrations: every adapter body goes through guard(), env comes from getEnv() -------------
{
  const PURE = ["types.ts", "registry.ts", "url-guard.ts", "bryntum.ts"]; // no network, nothing to guard
  const hits = [];
  for (const f of integrationFiles) {
    const name = f.split("/").pop();
    const src = stripComments(read(f));
    if (/process\.env/.test(src)) hits.push(`${f} reads process.env (use getEnv() from lib/env)`);
    if (!PURE.includes(name) && !/\bguard\s*\(/.test(src)) hits.push(`${f} never calls guard(): a vendor failure could throw at the call site`);
  }
  for (const f of walk("lib/agent").filter((x) => /\.ts$/.test(x))) {
    if (/process\.env/.test(stripComments(read(f)))) hits.push(`${f} reads process.env (use getEnv())`);
  }
  if (integrationFiles.length === 0) skip("integrations use guard() and getEnv()", "lib/integrations not created yet");
  else hits.length ? fail("integrations use guard() and getEnv()", hits.join("; ")) : pass("integrations use guard() and getEnv()");
}

// 5. no live keys in code or env files --------------------------------------
{
  const envFiles = [".env.example", "env.example", ".env.local"].filter(existsSync);
  const hits = [];
  for (const f of [...codeFiles, ...envFiles]) {
    const m = /sk_live_|pk_live_|api\.paypal\.com/.exec(read(f)); // note: api-m.sandbox.paypal.com does not match
    if (m) hits.push(`${f} contains ${m[0]}`);
  }
  hits.length ? fail("sandbox only", hits.join("; ")) : pass("sandbox only");
}

// 6. type-safety escape hatches ---------------------------------------------
{
  const hits = [];
  for (const f of codeFiles) {
    const raw = read(f);
    const src = stripComments(raw);
    if (/@ts-ignore|@ts-expect-error|eslint-disable/.test(raw)) hits.push(`${f} has a suppression comment`);
    const m = /:\s*any\b|\bas any\b|<any>/.exec(src);
    if (m) hits.push(`${f}:${lineOf(src, m.index)} uses any`);
  }
  hits.length ? fail("no any / suppressions", hits.join("; ")) : pass("no any / suppressions");
}

// 7. protected files keep their markers -------------------------------------
{
  const need = {
    "db/schema.ts": ["@invariant:money-integer-minor-units", "@invariant:append-only-events", "@invariant:capture-unique-per-attempt", "@invariant:snapshots-immutable"],
    "lib/agent/agents/resolver.ts": ["@invariant:snapshot-before-verdict"],
    "app/api/promise/route.ts": ["@invariant:one-step-per-request"],
    "app/p/page.tsx": ["@invariant:page-renders-without-network-or-llm"],
  };
  const hits = [];
  for (const [f, markers] of Object.entries(need)) {
    if (!existsSync(f)) continue;
    const raw = read(f);
    for (const m of markers) if (!raw.includes(m)) hits.push(`${f} lost ${m}`);
  }
  hits.length ? fail("protected files keep markers", hits.join("; ")) : pass("protected files keep markers");
}

// report --------------------------------------------------------------------
let failed = 0;
for (const r of results) {
  const tag = r.ok ? (r.skipped ? "SKIP" : "PASS") : "FAIL";
  console.log(`${tag}  ${r.name}${r.skipped ? `  (${r.skipped})` : ""}${r.detail ? `\n      ${r.detail}` : ""}`);
  if (!r.ok) failed++;
}
if (failed) {
  console.error(`\n${failed} invariant check(s) failed. Fix the line named above; do NOT edit this script to make it pass.`);
  process.exit(1);
}
