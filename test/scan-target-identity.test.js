import test from "node:test";
import assert from "node:assert/strict";
import { isSameSiteRedirectHost } from "../api/_lib/scan-target-identity.js";

test("scan target identity accepts an unchanged hostname", () => {
  assert.equal(isSameSiteRedirectHost("example.com", "example.com"), true);
});

test("scan target identity accepts only the www/non-www canonical pair", () => {
  assert.equal(isSameSiteRedirectHost("example.com", "www.example.com"), true);
  assert.equal(isSameSiteRedirectHost("www.example.com", "example.com"), true);
});

test("scan target identity rejects unrelated redirect hosts", () => {
  assert.equal(isSameSiteRedirectHost("blog.example.com", "www.google.com"), false);
  assert.equal(isSameSiteRedirectHost("example.com", "example.net"), false);
  assert.equal(isSameSiteRedirectHost("example.com", "cdn.example.com"), false);
});

test("scan target identity normalizes case, trailing dots and IPv6 brackets", () => {
  assert.equal(isSameSiteRedirectHost("EXAMPLE.COM.", "www.example.com"), true);
  assert.equal(isSameSiteRedirectHost("[2001:db8::1]", "2001:db8::1"), true);
});

test("scan target identity rejects missing or malformed host values", () => {
  assert.equal(isSameSiteRedirectHost("", "example.com"), false);
  assert.equal(isSameSiteRedirectHost("example.com", null), false);
});
