import assert from "node:assert/strict";
import test from "node:test";
import assistantHandler from "../api/assistant.js";
import reportHandler from "../api/report.js";

async function invoke(handler, body, method = "POST") {
  let statusCode;
  let payload;
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; return this; },
    setHeader() { return this; }
  };
  await handler({ method, body, headers: {} }, res);
  return { statusCode, payload };
}

test("AI Mentor rejects malformed bodies and invalid findings", async () => {
  assert.equal((await invoke(assistantHandler, [])).statusCode, 400);
  assert.equal((await invoke(assistantHandler, { finding: "" })).statusCode, 400);
  assert.equal((await invoke(assistantHandler, { finding: "x".repeat(161) })).statusCode, 400);
});

test("AI Mentor rejects unsupported website schemes and invalid types", async () => {
  assert.equal((await invoke(assistantHandler, { finding: "HSTS", website: "javascript:alert(1)" })).statusCode, 400);
  assert.equal((await invoke(assistantHandler, { finding: "HSTS", website: 42 })).statusCode, 400);
});

test("Report API rejects malformed bodies, invalid URLs, scores and check arrays", async () => {
  assert.equal((await invoke(reportHandler, [])).statusCode, 400);
  assert.equal((await invoke(reportHandler, { website: "javascript:alert(1)", securityScore: 10, checks: [] })).statusCode, 400);
  assert.equal((await invoke(reportHandler, { website: "https://example.com", securityScore: 101, checks: [] })).statusCode, 400);
  assert.equal((await invoke(reportHandler, { website: "https://example.com", securityScore: 10, checks: Array(201).fill({}) })).statusCode, 400);
});

test("Report API rejects invalid check objects and oversized text", async () => {
  assert.equal((await invoke(reportHandler, { website: "https://example.com", securityScore: 50, checks: [[]] })).statusCode, 400);
  assert.equal((await invoke(reportHandler, { website: "https://example.com", securityScore: 50, checks: [{ message: "x".repeat(2001) }] })).statusCode, 400);
});
