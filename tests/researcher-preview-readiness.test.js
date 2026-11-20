import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const guide = readFileSync(new URL("../public/researcher-preview-guide.md", import.meta.url), "utf8");

test("Researcher Preview clearly states it is not a public bug bounty", () => {
  assert.match(page, /not a public bug-bounty program/i);
  assert.match(page, /does not itself grant permission to test any target/i);
});

test("Researcher Preview warns that active authorization and approval workflow are not enabled", () => {
  assert.match(page, /research cases, independent approval records/i);
  assert.match(page, /active-testing engine/i);
});

test("researcher guide defines non-destructive rules and evidence redaction", () => {
  assert.match(guide, /Do not perform denial-of-service/i);
  assert.match(guide, /redacted evidence/i);
  assert.match(guide, /If any of these details are missing, do not begin testing/i);
});
