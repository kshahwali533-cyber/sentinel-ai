import assert from "node:assert/strict";
import test from "node:test";
import handler from "../api/report.js";

async function invoke(body, method = "POST") {
  let statusCode = null;
  let payload = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    }
  };

  await handler({ method, body }, res);
  return { statusCode, payload };
}

test("report API rejects non-POST requests", async () => {
  const result = await invoke({}, "GET");
  assert.equal(result.statusCode, 405);
  assert.match(result.payload.error, /POST/);
});

test("report API rejects malformed request bodies", async () => {
  const result = await invoke([]);
  assert.equal(result.statusCode, 400);
  assert.match(result.payload.error, /Invalid request body/);
});

test("report API accepts only HTTP and HTTPS website URLs", async () => {
  const result = await invoke({
    website: "javascript:alert(1)",
    securityScore: 80,
    checks: []
  });
  assert.equal(result.statusCode, 400);
  assert.match(result.payload.error, /HTTP or HTTPS/);
});

test("report API rejects invalid scores and oversized check arrays", async () => {
  const invalidScore = await invoke({
    website: "https://example.com",
    securityScore: 101,
    checks: []
  });
  assert.equal(invalidScore.statusCode, 400);

  const tooManyChecks = await invoke({
    website: "https://example.com",
    securityScore: 80,
    checks: Array(201).fill({ status: "INFO" })
  });
  assert.equal(tooManyChecks.statusCode, 400);
});

test("report API creates accurate summaries and normalized evidence", async () => {
  const result = await invoke({
    website: "https://example.com",
    securityScore: 75,
    riskLevel: "Medium",
    scanId: "scan-test-001",
    checks: [
      {
        name: "Content Security Policy",
        status: "WARNING",
        message: "CSP header is missing.",
        fix: "Configure a site-specific CSP.",
        evidence: {
          source: "HTTP response header",
          signal: "content-security-policy",
          observed: "missing",
          expected: "A site-specific CSP",
          ignored: "<script>alert(1)</script>"
        }
      },
      { name: "HTTPS", status: "PASS" },
      { name: "Technology information", status: "INFO" }
    ]
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.success, true);
  assert.equal(result.payload.report.website, "https://example.com");
  assert.equal(result.payload.report.scanId, "scan-test-001");
  assert.deepEqual(result.payload.report.executiveSummary, {
    totalChecks: 3,
    passed: 1,
    warnings: 1,
    informational: 1,
    priorityIssues: 1,
    evidenceBackedFindings: 1
  });
  assert.deepEqual(result.payload.report.priorityFindings[0].evidence, {
    source: "HTTP response header",
    signal: "content-security-policy",
    observed: "missing",
    expected: "A site-specific CSP"
  });
});
