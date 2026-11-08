#!/usr/bin/env node
// npm run verify       full gate (invariants, tsc, tests, build). Writes .devin/.last-verify on success.
// npm run verify:fast  inner loop (no build). Does NOT write the stamp, so it can never unlock a commit.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const fast = process.argv.includes("--fast");
const stages = [
  ["invariants", "node scripts/check-invariants.mjs"],
  ["tsc", "npx tsc --noEmit"],
  ["test", "npx vitest run"],
  ...(fast ? [] : [["build", "npx next build"]]),
];

for (const [name, cmd] of stages) {
  console.log(`\n=== ${name}: ${cmd}`);
  const r = spawnSync(cmd, { shell: true, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`\nSTAGE: ${name}\nREPRO: ${cmd}`);
    process.exit(r.status ?? 1);
  }
}
if (!fast) {
  mkdirSync(".devin", { recursive: true });
  writeFileSync(".devin/.last-verify", new Date().toISOString() + "\n");
}
console.log(`\nverify${fast ? " (fast)" : ""}: all stages passed`);
