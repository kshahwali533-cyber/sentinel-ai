import assert from "node:assert/strict";
import test from "node:test";
import handler from "../api/assistant.js";

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
  return Promise.resolve(handler({ method, body, headers: {} }, res)).then(() => ({ headers, statusCode, payload }));
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

test("assistant endpoint routes agent security assessment and returns no-store output", async () => {
  const result = await invoke("POST", { action: "agent_security_assessment", assessment: completeConfig });
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.assessmentStatus, "complete");
  assert.equal(result.payload.riskLevel, "Low");
  assert.equal(result.headers["Cache-Control"], "no-store");
  assert.equal(result.headers["X-Content-Type-Options"], "nosniff");
});

test("assistant endpoint rejects methods other than POST", async () => {
  const result = await invoke("GET", { action: "agent_security_assessment", assessment: completeConfig });
  assert.equal(result.statusCode, 405);
  assert.equal(result.headers.Allow, "POST");
});

test("assistant endpoint rejects oversized agent assessment payloads", async () => {
  const result = await invoke("POST", { action: "agent_security_assessment", assessment: { data: "x".repeat(17 * 1024) } });
  assert.equal(result.statusCode, 413);
});

test("assistant endpoint rejects malformed agent assessment input", async () => {
  const result = await invoke("POST", { action: "agent_security_assessment", assessment: [] });
  assert.equal(result.statusCode, 400);
  assert.match(result.payload.error, /configuration object/i);
});
