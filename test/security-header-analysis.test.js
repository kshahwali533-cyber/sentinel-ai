import test from "node:test";
import assert from "node:assert/strict";
import { hasValidFrameProtection } from "../api/_lib/security-header-analysis.js";

test("accepts supported X-Frame-Options values", () => {
  assert.equal(hasValidFrameProtection({ xFrameOptions: "DENY" }), true);
  assert.equal(hasValidFrameProtection({ xFrameOptions: " SAMEORIGIN " }), true);
});

test("rejects unsupported or malformed X-Frame-Options values", () => {
  assert.equal(hasValidFrameProtection({ xFrameOptions: "ALLOW-FROM https://example.com" }), false);
  assert.equal(hasValidFrameProtection({ xFrameOptions: "invalid" }), false);
  assert.equal(hasValidFrameProtection({ xFrameOptions: "DENY, SAMEORIGIN" }), false);
});

test("accepts CSP frame-ancestors with a source expression", () => {
  assert.equal(hasValidFrameProtection({ contentSecurityPolicy: "default-src 'self'; frame-ancestors 'none'" }), true);
  assert.equal(hasValidFrameProtection({ contentSecurityPolicy: "frame-ancestors 'self' https://trusted.example" }), true);
});

test("rejects missing, empty, or malformed CSP frame-ancestors directives", () => {
  assert.equal(hasValidFrameProtection({ contentSecurityPolicy: "default-src 'self'" }), false);
  assert.equal(hasValidFrameProtection({ contentSecurityPolicy: "frame-ancestors" }), false);
  assert.equal(hasValidFrameProtection({ contentSecurityPolicy: "frame-ancestors 'none' https://evil.example" }), false);
});
