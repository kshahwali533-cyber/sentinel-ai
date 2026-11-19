import test from "node:test";
import assert from "node:assert/strict";
import { createResearchPlanFingerprint } from "../api/_lib/research-plan-hash.js";

const base = {
  caseId: "123e4567-e89b-12d3-a456-426614174000",
  targetUrl: "https://example.test/security/report",
  method: "get",
  testCategory: "passive_header_review"
};

test("creates a stable SHA-256 fingerprint for an exact plan", () => {
  const first = createResearchPlanFingerprint(base);
  const second = createResearchPlanFingerprint(base);
  assert.equal(first.plan_hash, second.plan_hash);
  assert.equal(first.method, "GET");
  assert.equal(first.target_origin, "https://example.test:443");
});

test("changes the fingerprint when any approved plan field changes", () => {
  const original = createResearchPlanFingerprint(base);
  const changed = createResearchPlanFingerprint({ ...base, targetUrl: "https://example.test/security/other" });
  assert.notEqual(original.plan_hash, changed.plan_hash);
});

test("rejects non-HTTPS URLs, query strings, fragments and credentials", () => {
  for (const targetUrl of [
    "http://example.test/security/report",
    "https://example.test/security/report?x=1",
    "https://example.test/security/report#fragment",
    "https://user:pass@example.test/security/report"
  ]) {
    assert.equal(createResearchPlanFingerprint({ ...base, targetUrl }), null);
  }
});
