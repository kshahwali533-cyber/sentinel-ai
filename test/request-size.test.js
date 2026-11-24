import test from "node:test";
import assert from "node:assert/strict";
import { isWithinJsonBodyLimit } from "../api/_lib/request-size.js";

test("accepts JSON bodies at or below the byte limit", () => {
  assert.equal(isWithinJsonBodyLimit({ message: "hello" }, 32), true);
  assert.equal(isWithinJsonBodyLimit({ message: "hello" }, 16), true);
});

test("rejects oversized UTF-8 payloads using byte length rather than character count", () => {
  assert.equal(isWithinJsonBodyLimit({ message: "x".repeat(100) }, 32), false);
  assert.equal(isWithinJsonBodyLimit({ message: "🙂" }, 5), false);
});

test("rejects values that cannot be safely serialized and invalid limits", () => {
  const circular = {};
  circular.self = circular;
  assert.equal(isWithinJsonBodyLimit(circular, 100), false);
  assert.equal(isWithinJsonBodyLimit({ ok: true }, 0), false);
  assert.equal(isWithinJsonBodyLimit({ ok: true }, 1.5), false);
  assert.equal(isWithinJsonBodyLimit(undefined, 100), false);
});
