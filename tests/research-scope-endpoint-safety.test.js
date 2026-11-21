import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const handler = readFileSync(new URL("../api/research.js", import.meta.url), "utf8");
const vercelConfig = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));

test("legacy scope-check route is rewritten to the shared Researcher handler", () => {
  assert.ok(vercelConfig.rewrites.some((rule) =>
    rule.source === "/api/research-scope-check" &&
    rule.destination === "/api/research?__action=check_scope"
  ));
  assert.match(handler, /req\.query\?\.__action === "check_scope"/);
});

test("scope decision is POST-only and explicitly decision-only", () => {
  assert.match(handler, /if \(req\.method !== "POST"\)/);
  assert.match(handler, /decision_only: true/);
  assert.match(handler, /evaluateResearchScope\(/);
});

test("authorization records are loaded server-side and owner-filtered", () => {
  assert.match(handler, /supabaseAdmin\.auth\.getUser\(token\)/);
  assert.match(handler, /\.eq\("owner_user_id", user\.id\)/);
  assert.match(handler, /\.from\("research_case_approvals"\)/);
});

test("scope decision handler contains no outbound HTTP client call", () => {
  assert.doesNotMatch(handler, /\bfetch\s*\(/);
  assert.doesNotMatch(handler, /axios\./i);
  assert.doesNotMatch(handler, /http\.request\s*\(/);
});


test("scope decision requires the plan's assigned reviewer to remain active", () => {
  const approvalLookup = handler.indexOf('.from("research_case_approvals")');
  const reviewerLookup = handler.indexOf('.from("research_case_reviewers")', approvalLookup);
  const inactiveDenial = handler.indexOf('reviewer_assignment_inactive', reviewerLookup);
  const scopeDecision = handler.indexOf('evaluateResearchScope(', reviewerLookup);
  assert.ok(approvalLookup >= 0);
  assert.ok(reviewerLookup > approvalLookup);
  assert.ok(inactiveDenial > reviewerLookup);
  assert.ok(scopeDecision > inactiveDenial);
  assert.match(handler, /\.eq\("reviewer_user_id", planApproval\.reviewer_user_id\)/);
  assert.match(handler, /\.eq\("status", "active"\)/);
});
