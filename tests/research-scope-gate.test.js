import test from "node:test";
import assert from "node:assert/strict";
import { evaluateResearchScope } from "../api/_lib/research-scope-gate.js";

const NOW = Date.parse("2026-11-20T12:00:00.000Z");
const baseCase = {
  case_id: "case-123",
  authorization_status: "authorized",
  scope_starts_at: "2026-11-20T11:00:00.000Z",
  scope_expires_at: "2026-11-20T13:00:00.000Z",
  authorized_assets: [{
    origin: "https://example.test:443",
    paths: ["/security/"],
    excluded_paths: ["/security/admin/"]
  }],
  allowed_methods: ["GET"],
  excluded_methods: ["POST"]
};
const approval = {
  status: "approved",
  case_id: "case-123",
  reviewer_user_id: "reviewer-1",
  expires_at: "2026-11-20T12:30:00.000Z",
  target_origin: "https://example.test:443",
  target_path: "/security/report",
  method: "GET",
  test_category: "passive_header_review"
};
const request = {
  authorizationRecord: baseCase,
  planApproval: approval,
  targetUrl: "https://example.test/security/report",
  method: "GET",
  testCategory: "passive_header_review",
  now: NOW
};

test("allows an exact, current, human-approved in-scope plan", () => {
  assert.equal(evaluateResearchScope(request).allowed, true);
});

test("denies when authorization is absent or not approved", () => {
  assert.equal(evaluateResearchScope({ ...request, authorizationRecord: null }).allowed, false);
  assert.equal(evaluateResearchScope({
    ...request,
    authorizationRecord: { ...baseCase, authorization_status: "pending_review" }
  }).reason, "authorization_not_approved");
});

test("denies an out-of-scope origin and path", () => {
  assert.equal(evaluateResearchScope({ ...request, targetUrl: "https://other.test/security/report" }).reason, "target_origin_out_of_scope");
  assert.equal(evaluateResearchScope({ ...request, targetUrl: "https://example.test/private" }).reason, "target_path_out_of_scope");
});

test("denies excluded paths and unsafe methods", () => {
  assert.equal(evaluateResearchScope({ ...request, targetUrl: "https://example.test/security/admin/panel" }).reason, "target_path_excluded");
  assert.equal(evaluateResearchScope({ ...request, method: "POST" }).reason, "method_not_permitted_by_safe_mvp");
});

test("denies expired scope and future scope", () => {
  assert.equal(evaluateResearchScope({
    ...request,
    authorizationRecord: { ...baseCase, scope_expires_at: "2026-11-20T11:59:00.000Z" }
  }).reason, "scope_expired");
  assert.equal(evaluateResearchScope({
    ...request,
    authorizationRecord: { ...baseCase, scope_starts_at: "2026-11-20T12:01:00.000Z" }
  }).reason, "scope_not_started");
});

test("denies missing or mismatched human approval", () => {
  assert.equal(evaluateResearchScope({ ...request, planApproval: null }).reason, "human_plan_approval_missing");
  assert.equal(evaluateResearchScope({
    ...request,
    planApproval: { ...approval, target_path: "/security/other" }
  }).reason, "approved_plan_does_not_match_request");
});

test("denies insecure URLs and dangerous test categories", () => {
  assert.equal(evaluateResearchScope({ ...request, targetUrl: "http://example.test/security/report" }).reason, "target_url_invalid");
  assert.equal(evaluateResearchScope({ ...request, testCategory: "denial_of_service" }).reason, "test_category_blocked");
});

test("fails closed when the scope schema is incomplete", () => {
  assert.equal(evaluateResearchScope({
    ...request,
    authorizationRecord: { ...baseCase, authorized_assets: null }
  }).reason, "scope_definition_invalid");
});
