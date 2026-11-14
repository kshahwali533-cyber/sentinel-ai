import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeResearchText,
  isValidResearchId,
  sanitizeResearchAssetUrl,
  normalizeResearchEndpointPath,
  normalizeResearchEvidence
} from "../api/_lib/research-validation.js";

test("research endpoint accepts only same-origin HTTPS paths", () => {
  assert.equal(
    normalizeResearchEndpointPath("/account/profile?token=secret#fragment", "https://example.org"),
    "/account/profile"
  );
  assert.equal(normalizeResearchEndpointPath("//evil.example/path", "https://example.org"), null);
  assert.equal(normalizeResearchEndpointPath("https://evil.example/path", "https://example.org"), null);
  assert.equal(normalizeResearchEndpointPath("/\\\\evil.example", "https://example.org"), null);
  assert.equal(normalizeResearchEndpointPath("/path", "http://example.org"), null);
});

test("research asset URLs are reduced to HTTPS origins", () => {
  assert.equal(sanitizeResearchAssetUrl("https://example.org/private?token=secret#x"), "https://example.org");
  assert.equal(sanitizeResearchAssetUrl("http://example.org"), null);
  assert.equal(sanitizeResearchAssetUrl("https://user:pass@example.org"), null);
});

test("evidence is bounded and normalized", () => {
  assert.deepEqual(normalizeResearchEvidence([{
    source: "HTTP response",
    signal: "HSTS",
    observed: "Header not present",
    expected: "Strict-Transport-Security"
  }]), [{
    source: "HTTP response",
    signal: "HSTS",
    observed: "Header not present",
    expected: "Strict-Transport-Security"
  }]);
  assert.equal(normalizeResearchEvidence(new Array(11).fill({})), null);
  assert.equal(normalizeResearchEvidence([null]), null);
});

test("text fields enforce required values and length", () => {
  assert.equal(normalizeResearchText("  title  ", 10, true), "title");
  assert.equal(normalizeResearchText(" ", 10, true), null);
  assert.equal(normalizeResearchText("123456", 5), null);
});

test("research identifiers must be UUIDs", () => {
  assert.equal(isValidResearchId("a3a3b3c3-d4d4-4e4e-8f8f-0123456789ab"), true);
  assert.equal(isValidResearchId("not-an-id"), false);
});
