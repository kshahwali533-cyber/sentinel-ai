import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEvidence } from "../api/_lib/security-evidence.js";

test("normalizes only supported evidence fields", () => {
  assert.deepEqual(
    normalizeEvidence({
      source: "HTTP response header",
      signal: "content-security-policy",
      observed: "not present",
      expected: "A site-specific Content-Security-Policy",
      ignored: "<script>alert(1)</script>"
    }),
    {
      source: "HTTP response header",
      signal: "content-security-policy",
      observed: "not present",
      expected: "A site-specific Content-Security-Policy"
    }
  );
});

test("rejects missing, primitive, and array evidence", () => {
  assert.equal(normalizeEvidence(null), null);
  assert.equal(normalizeEvidence("evidence"), null);
  assert.equal(normalizeEvidence([]), null);
});

test("removes control characters and caps evidence field length", () => {
  const result = normalizeEvidence({
    observed: "  header\\u0000 value  ",
    expected: "x".repeat(800)
  });
  assert.equal(result.observed, "header value");
  assert.equal(result.expected.length, 500);
});

test("returns null when no supported non-empty values exist", () => {
  assert.equal(normalizeEvidence({ source: " ", signal: 42 }), null);
});
