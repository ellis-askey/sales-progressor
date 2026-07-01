// Operator-side helper for Gate 3b of the runbook GO/NO-GO sequence.
//
// Reads N password values from stdin (one per line, terminated by EOF /
// blank line) and appends them to KNOWN_WEAK_PASSWORDS in
// scripts/prod-check-weak-credentials.ts with an explanatory comment.
// Values never reach the chat transcript — Ellis runs this from his
// own shell, pastes the second-rotation values, the script writes
// them to disk.
//
// Usage (from Ellis's terminal):
//   npx tsx scripts/append-known-weak-passwords.ts
//   (paste second-rotation values, one per line, then Ctrl+D / blank line)
//
// Per the runbook invariant: only paste values that have ALREADY been
// retired by a fresh rotation. Active staging passwords must NEVER
// appear in KNOWN_WEAK_PASSWORDS — they would themselves become the
// compromise.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as readline from "node:readline";

const SCRIPT_PATH = resolve("scripts/prod-check-weak-credentials.ts");

async function readStdinLines(): Promise<string[]> {
  const lines: string[] = [];
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  console.error("Paste the retired (second-rotation) staging passwords, one per line.");
  console.error("Finish with EOF (Ctrl+D / Ctrl+Z+Enter) or a blank line.\n");
  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed === "") break;
    lines.push(trimmed);
  }
  return lines;
}

(async () => {
  const values = await readStdinLines();
  if (values.length === 0) {
    console.error("No values provided. Nothing appended.");
    process.exit(2);
  }

  const original = readFileSync(SCRIPT_PATH, "utf8");
  const today = new Date().toISOString().slice(0, 10);

  // The closing-bracket marker is the insertion anchor — we add before
  // the closing line so the comment + values land at the end of the
  // KNOWN_WEAK_PASSWORDS array.
  const ANCHOR = "  // INVARIANT (added 2026-06-04 after the public-repo finding):";
  const idx = original.indexOf(ANCHOR);
  if (idx < 0) {
    console.error("Could not locate KNOWN_WEAK_PASSWORDS invariant comment.");
    console.error("File structure has changed; aborting rather than risk a bad edit.");
    process.exit(3);
  }

  const insertion =
    `  // Post-rotation ${today}: second-rotation values retired by Ellis's\n` +
    `  // third rotation per Gate 3 of the prod release runbook. These were\n` +
    `  // briefly active on staging between the first rotation of 2026-06-04\n` +
    `  // (compromised by public-repo commit) and the third rotation. Burned\n` +
    `  // here so the prod credential gate catches any re-use.\n` +
    values.map((v) => `  ${JSON.stringify(v)},`).join("\n") + "\n";

  const updated = original.slice(0, idx) + insertion + original.slice(idx);
  writeFileSync(SCRIPT_PATH, updated, "utf8");
  console.error(`Appended ${values.length} value(s) to ${SCRIPT_PATH}.`);
  console.error("Review the diff before committing.");
})();
