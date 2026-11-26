import assert from "node:assert/strict";
import test from "node:test";
import handler from "../api/agent-security.js";

function invoke(method, body) {
  const headers = {};
  let statusCode = null;
  let payload = null;
  const res = {
    setHeader(name, value) {
      headers[name] = value;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    }
  };
  handler({ method, body }, res);
  return { headers, statusCode, payload };
}

const completeConfig = {
  capabilities: {
    networkAccess: false,
    shellExecution: false,
    fileWrite: false,
    secretsAccess: false,
    databaseWrite: false,
    externalMessaging: false,
    browserAutomation: false
  },
  controls: {
    humanApproval: true,
    toolAllowlist: true,
    sandboxedExecution: true,
    scopedSecrets: true,
    outputValidation: true,
    auditLogging: true,
    promptInjectionTesting: true,
    dataExfiltrationControls: true
  }
};

test("agent security endpoint accepts POST and returns a no-store assessment", () => {
  const result = invoke("POST", completeConfig);
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.assessmentStatus, "complete");
  assert.equal(result.payload.riskLevel, "Low");
  assert.equal(result.headers["Cache-Control"], "no-store");
  assert.equal(result.headers["X-Content-Type-Options"], "nosniff");
});

test("agent security endpoint rejects methods other than POST", () => {
  const result = invoke("GET", completeConfig);
  assert.equal(result.statusCode, 405);
  assert.equal(result.headers.Allow, "POST");
});

test("agent security endpoint rejects oversized payloads before assessment", () => {
  const result = invoke("POST", { data: "x".repeat(17 * 1024) });
  assert.equal(result.statusCode, 413);
});

test("agent security endpoint rejects malformed assessment input", () => {
  const result = invoke("POST", []);
  assert.equal(result.statusCode, 400);
  assert.match(result.payload.error, /configuration object/i);
});
