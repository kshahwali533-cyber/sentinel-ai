import test from "node:test";
import assert from "node:assert/strict";
import { hasValidFrameProtection, hasRecognizedReferrerPolicy, hasRecognizedCrossOriginPolicy } from "../api/_lib/security-header-analysis.js";

test("accepts supported X-Frame-Options values", () => {
  assert.equal(hasValidFrameProtection({ xFrameOptions: "DENY" }), true);
  assert.equal(hasValidFrameProtection({ xFrameOptions: " SAMEORIGIN " }), true);
});

test("rejects unsupported or malformed X-Frame-Options values", () => {
  assert.equal(hasValidFrameProtection({ xFrameOptions: "ALLOW-FROM https://example.com" }), false);
  assert.equal(hasValidFrameProtection({ xFrameOptions: "invalid" }), false);
  assert.equal(hasValidFrameProtection({ xFrameOptions: "DENY, SAMEORIGIN" }), false);
});

test("accepts valid CSP frame-ancestors source expressions", () => {
  assert.equal(hasValidFrameProtection({ contentSecurityPolicy: "default-src 'self'; frame-ancestors 'none'" }), true);
  assert.equal(hasValidFrameProtection({ contentSecurityPolicy: "frame-ancestors 'self' https://trusted.example" }), true);
  assert.equal(hasValidFrameProtection({ contentSecurityPolicy: "frame-ancestors *" }), true);
  assert.equal(hasValidFrameProtection({ contentSecurityPolicy: "frame-ancestors https:" }), true);
  assert.equal(hasValidFrameProtection({ contentSecurityPolicy: "frame-ancestors https://*.trusted.example:443/app" }), true);
});

test("rejects missing, malformed, arbitrary, or out-of-range CSP sources", () => {
  assert.equal(hasValidFrameProtection({ contentSecurityPolicy: "default-src 'self'" }), false);
  assert.equal(hasValidFrameProtection({ contentSecurityPolicy: "frame-ancestors" }), false);
  assert.equal(hasValidFrameProtection({ contentSecurityPolicy: "frame-ancestors 'none' https://evil.example" }), false);
  assert.equal(hasValidFrameProtection({ contentSecurityPolicy: "frame-ancestors 'unsafe-inline'" }), false);
  assert.equal(hasValidFrameProtection({ contentSecurityPolicy: "frame-ancestors https://trusted.example:99999" }), false);
});

test("honors the first duplicate frame-ancestors directive", () => {
  assert.equal(hasValidFrameProtection({ contentSecurityPolicy: "frame-ancestors 'unsafe-inline'; frame-ancestors 'self'" }), false);
});

test("recognizes valid Referrer-Policy values and rejects arbitrary text", () => {
  assert.equal(hasRecognizedReferrerPolicy("strict-origin-when-cross-origin"), true);
  assert.equal(hasRecognizedReferrerPolicy("invalid-policy"), false);
  assert.equal(hasRecognizedReferrerPolicy("invalid-policy, origin"), true);
  assert.equal(hasRecognizedReferrerPolicy(""), false);
});

test("recognizes only supported COOP, CORP, and COEP values", () => {
  assert.equal(hasRecognizedCrossOriginPolicy("same-origin", "coop"), true);
  assert.equal(hasRecognizedCrossOriginPolicy("unknown", "coop"), false);
  assert.equal(hasRecognizedCrossOriginPolicy("same-site", "corp"), true);
  assert.equal(hasRecognizedCrossOriginPolicy("public", "corp"), false);
  assert.equal(hasRecognizedCrossOriginPolicy("credentialless", "coep"), true);
  assert.equal(hasRecognizedCrossOriginPolicy("invalid", "coep"), false);
});
