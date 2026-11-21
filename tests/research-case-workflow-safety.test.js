import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync(new URL("../api/research.js", import.meta.url), "utf8");
const gate = readFileSync(new URL("../api/_lib/research-scope-gate.js", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261120115348_sentinel_research_authorization_foundation.sql", import.meta.url), "utf8");

test("research case creation requires bounded written authorization and HTTPS scope", () => {
  assert.match(api, /action === "create_case"/);
  assert.match(api, /authorizationReference/);
  assert.match(api, /authorizationEvidence/);
  assert.match(api, /url\.protocol === "https:"/);
  assert.match(api, /31 \* 24 \* 60 \* 60 \* 1000/);
});

test("authorization evidence labels and references must be non-empty", () => {
  assert.match(api, /item\.label\.trim\(\)\.length >= 1/);
  assert.match(api, /item\.reference\.trim\(\)\.length >= 1/);
});

test("case authorization requires a separate assigned reviewer", () => {
  assert.match(api, /action === "assign_reviewer"/);
  assert.match(api, /action === "submit_case_for_review"/);
  assert.match(api, /action === "review_case"/);
  assert.match(api, /researchCase\.owner_user_id === user\.id/);
  assert.match(api, /reviewer_user_id", user\.id/);
});

test("per-plan approval is separate, reviewer-bound, and short-lived", () => {
  assert.match(api, /action === "request_plan_approval"/);
  assert.match(api, /action === "decide_plan_approval"/);
  assert.match(api, /60 \* 60 \* 1000/);
  assert.match(gate, /human_plan_approval_missing/);
  assert.match(gate, /approved_plan_does_not_match_request/);
});

test("authorization tables are additive, RLS-protected, and client-inaccessible", () => {
  for (const table of ["research_cases", "research_case_reviewers", "research_case_approvals", "research_case_events"]) {
    assert.match(migration, new RegExp("create table public\\." + table));
    assert.match(migration, new RegExp("alter table public\\." + table + " enable row level security"));
    assert.match(migration, new RegExp("revoke all on public\\." + table + " from anon, authenticated"));
  }
});

test("case owners can revoke authorization and invalidate every pending or approved plan", () => {
  assert.match(api, /action === "revoke_case_authorization"/);
  assert.match(api, /eq\("owner_user_id", user\.id\)/);
  assert.match(api, /authorization_status: "revoked"/);
  assert.match(api, /case\.authorization_revoked/);
  assert.match(api, /in\("status", \["pending", "approved"\]\)/);
});

test("case owners can revoke reviewers and invalidate that reviewer's plans", () => {
  assert.match(api, /action === "revoke_reviewer"/);
  assert.match(api, /eq\("reviewer_user_id", body\.reviewerUserId\)\.eq\("status", "active"\)/);
  assert.match(api, /reviewer\.revoked/);
});

test("approved plans can be revoked only by their assigned active reviewer", () => {
  assert.match(api, /action === "revoke_plan_approval"/);
  assert.match(api, /\.eq\("reviewer_user_id", user\.id\)/);
  assert.match(api, /\.eq\("status", "active"\)/);
  assert.match(api, /\.eq\("status", "approved"\)/);
  assert.match(api, /status: "revoked"/);
  assert.match(api, /eventType: "plan\.revoked"/);
});
