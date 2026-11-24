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

test("rejects arbitrary or unsupported CSP frame-ancestor tokens", () => {
  assert.equal(hasValidFrameProtection({ contentSecurityPolicy: "frame-ancestors definitely-not-a-source" }), false);
  assert.equal(hasValidFrameProtection({ contentSecurityPolicy: "frame-ancestors 'unsafe-inline'" }), false);
  assert.equal(hasValidFrameProtection({ contentSecurityPolicy: "frame-ancestors https://trusted.example:99999" }), false);
});

test("accepts valid wildcard, scheme, and host sources", () => {
  assert.equal(hasValidFrameProtection({ contentSecurityPolicy: "frame-ancestors *" }), true);
  assert.equal(hasValidFrameProtection({ contentSecurityPolicy: "frame-ancestors https:" }), true);
  assert.equal(hasValidFrameProtection({ contentSecurityPolicy: "frame-ancestors https://*.trusted.example:443/app" }), true);
});

test("honors the first duplicate frame-ancestors directive", () => {
  assert.equal(hasValidFrameProtection({
    contentSecurityPolicy: "frame-ancestors invalid-token; frame-ancestors 'self'"
  }), false);
});
