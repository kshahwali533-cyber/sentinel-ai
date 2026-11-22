import test from "node:test";
import assert from "node:assert/strict";
import { extractVerificationMetaToken } from "../api/_lib/domain-verification.js";

const token = "a".repeat(48);

test("extracts the Sentinel verification meta tag with normal attributes", () => {
  assert.equal(
    extractVerificationMetaToken('<html><head><meta name="sentinel-ai-verification" content="' + token + '"></head></html>'),
    token
  );
});

test("meta verification is case-insensitive and supports reordered or unquoted attributes", () => {
  assert.equal(
    extractVerificationMetaToken('<META content=' + token + ' NAME=sentinel-ai-verification>'),
    token
  );
});

test("ignores meta-like text inside HTML comments", () => {
  assert.equal(
    extractVerificationMetaToken('<!-- <meta name="sentinel-ai-verification" content="' + token + '"> -->'),
    null
  );
});

test("rejects duplicate verification tags and duplicate security-sensitive attributes", () => {
  assert.equal(
    extractVerificationMetaToken('<meta name="sentinel-ai-verification" content="' + token + '"><meta name="sentinel-ai-verification" content="' + token + '">'),
    null
  );
  assert.equal(
    extractVerificationMetaToken('<meta name="sentinel-ai-verification" name="other" content="' + token + '">'),
    null
  );
});

test("rejects missing, malformed, and oversized HTML", () => {
  assert.equal(extractVerificationMetaToken("<html><head></head></html>"), null);
  assert.equal(extractVerificationMetaToken(null), null);
  assert.equal(extractVerificationMetaToken("x".repeat(65537)), null);
});
