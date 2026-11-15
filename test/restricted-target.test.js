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
