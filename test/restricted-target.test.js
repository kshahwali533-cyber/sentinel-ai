import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("api/scan.js", "utf8");

test("scanner refuses to score access-restricted target responses", () => {
  assert.match(source, /if \(\[401, 403\]\.includes\(response\.status\)\)/);
  assert.match(source, /code: "TARGET_ACCESS_RESTRICTED"/);
  assert.match(source, /cannot verify the page security headers or produce a reliable score/i);
  assert.match(source, /await response\.body\?\.cancel\(\)/);
});

test("scanner refuses to score an unrelated cross-domain redirect response", () => {
  assert.match(source, /isSameSiteRedirectHost\(target\.hostname, mainResult\.finalURL\.hostname\)/);
  assert.match(source, /code: "TARGET_REDIRECTED_OFF_SITE"/);
  assert.match(source, /await response\.body\?\.cancel\(\)/);
  const guardIndex = source.indexOf('code: "TARGET_REDIRECTED_OFF_SITE"');
  const scoringIndex = source.indexOf("const checks = []", guardIndex);
  assert.ok(guardIndex >= 0 && scoringIndex > guardIndex, "off-site redirect guard must run before security checks are scored");
});

test("scanner does not score target rate limits, server errors or incomplete redirects", () => {
  assert.match(source, /code: "TARGET_RATE_LIMITED"/);
  assert.match(source, /code: response\.status >= 500 \? "TARGET_UPSTREAM_ERROR" : "TARGET_REDIRECT_INCOMPLETE"/);
  const guardIndex = source.indexOf('code: "TARGET_RATE_LIMITED"');
  const scoringIndex = source.indexOf("const checks = []", guardIndex);
  assert.ok(guardIndex >= 0 && scoringIndex > guardIndex, "unreliable upstream responses must be rejected before scoring");
});
