import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const guide = readFileSync(new URL("../public/researcher-preview-guide.md", import.meta.url), "utf8");

test("Researcher Preview clearly states it is not a public bug bounty", () => {
  assert.match(page, /not a public bug-bounty program/i);
  assert.match(page, /does not itself grant permission to test any target/i);
});

test("Researcher Preview accurately distinguishes API foundation from unfinished UI and active testing", () => {
  assert.match(page, /private API foundation/i);
  assert.match(page, /researcher-facing case and reviewer controls are still under development/i);
  assert.match(page, /does not yet provide a public bug-bounty intake or execute active tests/i);
});

test("researcher guide defines non-destructive rules and evidence redaction", () => {
  assert.match(guide, /Do not perform denial-of-service/i);
  assert.match(guide, /redacted evidence/i);
  assert.match(guide, /If any of these details are missing, do not begin testing/i);
});
