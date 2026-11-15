import test from "node:test";
import assert from "node:assert/strict";
import { getUsageMonthStart, hasScanAllowance } from "../api/_lib/usage-metering.js";

test("usage period starts at UTC month boundary", () => {
  assert.equal(
    getUsageMonthStart(new Date("2026-11-14T12:00:00.000Z")),
    "2026-11-01T00:00:00.000Z"
  );
  assert.equal(
    getUsageMonthStart(new Date("2027-01-01T00:00:00.000Z")),
    "2027-01-01T00:00:00.000Z"
  );
  assert.throws(() => getUsageMonthStart("not-a-date"));
});

test("beta scan allowance denies exhausted or invalid limits", () => {
  assert.equal(hasScanAllowance(0, 100), true);
  assert.equal(hasScanAllowance(99, 100), true);
  assert.equal(hasScanAllowance(100, 100), false);
  assert.equal(hasScanAllowance(-1, 100), false);
  assert.equal(hasScanAllowance(1, 0), false);
});
