import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const guide = readFileSync(new URL("../public/researcher-preview-guide.md", import.meta.url), "utf8");
const api = readFileSync(new URL("../api/research.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../sentinel-app.js", import.meta.url), "utf8");

test("Researcher Preview clearly states it is not a public bug bounty", () => {
  assert.match(page, /not a public bug-bounty program/i);
  assert.match(page, /does not itself grant permission to test any target/i);
});

test("private authorization cases and independent review are wired into the UI", () => {
  for (const id of ["researchCaseTitle", "researchAuthorizationReference", "researchAuthorizedOrigin", "researchReviewerUserId", "researchCases", "researchApprovals"]) {
    assert.match(page, new RegExp('id="' + id + '"'));
  }
  for (const action of ["create-research-case", "assign-research-reviewer", "submit-research-case", "review-research-case", "request-research-plan-approval", "decide-research-plan-approval", "revoke-research-plan-approval", "check-research-scope"]) {
    assert.ok(page.includes('data-action="' + action + '"') || app.includes('"' + action + '"'), action);
  }
});

test("case and plan approvals are separate and reviewer-bound", () => {
  for (const action of ["create_case", "assign_reviewer", "submit_case_for_review", "review_case", "request_plan_approval", "decide_plan_approval", "revoke_plan_approval", "check_scope"]) {
    assert.ok(api.includes('action === "' + action + '"'), action);
  }
  assert.match(api, /decision_only: true/);
  assert.match(app, /No target traffic was sent/);
});

test("Researcher workflow remains analysis-only and prohibits exploit traffic", () => {
  assert.match(page, /does not send active test traffic/i);
  assert.match(page, /does not\s+issue active-testing authorization or run exploit traffic/i);
  assert.match(guide, /Do not perform denial-of-service/i);
  assert.match(guide, /redacted evidence/i);
  assert.match(guide, /If any of these details are missing, do not begin testing/i);
});
