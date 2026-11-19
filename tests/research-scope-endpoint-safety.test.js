import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const endpoint = readFileSync(new URL("../api/research-scope-check.js", import.meta.url), "utf8");

test("scope-check endpoint is decision-only and accepts POST only", () => {
  assert.match(endpoint, /req\.method !== "POST"/);
  assert.match(endpoint, /decision_only: true/);
  assert.match(endpoint, /never makes a request to the target/i);
});

test("authorization records are loaded from server-side storage and owner-filtered", () => {
  assert.match(endpoint, /supabaseAdmin\.auth\.getUser\(token\)/);
  assert.match(endpoint, /\.eq\("owner_user_id", user\.id\)/);
  assert.match(endpoint, /\.from\("research_case_approvals"\)/);
});

test("scope-check endpoint contains no outbound HTTP client call", () => {
  assert.doesNotMatch(endpoint, /\bfetch\s*\(/);
  assert.doesNotMatch(endpoint, /axios\./i);
  assert.doesNotMatch(endpoint, /http\.request\s*\(/);
});
