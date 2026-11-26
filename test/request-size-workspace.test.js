import test from "node:test";
import assert from "node:assert/strict";
import { isWithinJsonBodyLimit } from "../api/_lib/request-size.js";

test("enforces UTF-8 JSON byte limits for workspace and research API payloads", () => {
  assert.equal(isWithinJsonBodyLimit({ action: "create", name: "Acme" }, 1024), true);
  assert.equal(isWithinJsonBodyLimit({ description: "x".repeat(70 * 1024) }, 64 * 1024), false);
  assert.equal(isWithinJsonBodyLimit({ text: "🙂".repeat(5000) }, 16 * 1024), false);
});

test("fails closed for circular payloads and invalid limits", () => {
  const circular = {}; circular.self = circular;
  assert.equal(isWithinJsonBodyLimit(circular, 1024), false);
  assert.equal(isWithinJsonBodyLimit({}, 0), false);
});
