import test from "node:test";
import assert from "node:assert/strict";
import { calculateScanScore } from "../api/_lib/scan-score.js";

test("INFO checks do not dilute the security score", () => {
  const result = calculateScanScore([
    ...Array(7).fill({ status: "PASS" }),
    ...Array(3).fill({ status: "WARNING" }),
    ...Array(10).fill({ status: "INFO" })
  ]);

  assert.deepEqual(result, {
    totalChecks: 20,
    passed: 7,
    warnings: 3,
    informational: 10,
    score: 70,
    riskLevel: "Medium"
  });
});

test("all passing scored checks produce a 100 Low result", () => {
  const result = calculateScanScore([
    { status: "PASS" },
    { status: "PASS" },
    { status: "INFO" }
  ]);

  assert.equal(result.score, 100);
  assert.equal(result.riskLevel, "Low");
});

test("warnings without passes produce a zero High result", () => {
  const result = calculateScanScore([
    { status: "WARNING" },
    { status: "WARNING" }
  ]);

  assert.equal(result.score, 0);
  assert.equal(result.riskLevel, "High");
});

test("five warnings trigger High risk even at a 50 score", () => {
  const result = calculateScanScore([
    ...Array(5).fill({ status: "PASS" }),
    ...Array(5).fill({ status: "WARNING" })
  ]);

  assert.equal(result.score, 50);
  assert.equal(result.riskLevel, "High");
});

test("informational and unknown statuses do not enter the score denominator", () => {
  const result = calculateScanScore([
    { status: "PASS" },
    { status: "INFO" },
    { status: "OTHER" }
  ]);

  assert.equal(result.totalChecks, 3);
  assert.equal(result.score, 100);
  assert.equal(result.informational, 1);
});

test("non-array input is rejected", () => {
  assert.throws(() => calculateScanScore(null), {
    name: "TypeError",
    message: "checks must be an array."
  });
});
