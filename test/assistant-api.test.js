import assert from "node:assert/strict";
import test from "node:test";
import handler from "../api/assistant.js";

async function invoke(body, method = "POST", headers = {}) {
  let statusCode = null;
  let payload = null;
  const responseHeaders = {};
  const res = {
    setHeader(name, value) {
      responseHeaders[name] = value;
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

  await handler({ method, body, headers, socket: {} }, res);
  return { statusCode, payload, responseHeaders };
}

test("AI Security Mentor rejects non-POST requests", async () => {
  const result = await invoke({}, "GET");
  assert.equal(result.statusCode, 405);
  assert.match(result.payload.error, /POST/);
  assert.equal(result.responseHeaders["Cache-Control"], "no-store");
});

test("AI Security Mentor rejects malformed and missing findings", async () => {
  const malformed = await invoke([]);
  assert.equal(malformed.statusCode, 400);

  const missingFinding = await invoke({ website: "https://example.com" });
  assert.equal(missingFinding.statusCode, 400);
  assert.match(missingFinding.payload.error, /finding/i);
});

test("AI Security Mentor returns safe built-in guidance without paid AI credentials", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const result = await invoke({
      finding: "Content Security Policy",
      severity: "Medium",
      website: "https://example.com"
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.payload.success, true);
    assert.equal(result.payload.aiPowered, false);
    assert.equal(result.payload.fallback, true);
    assert.equal(result.payload.assistant.title, "Content Security Policy");
    assert.ok(result.payload.assistant.explanation.length > 0);
    assert.ok(result.payload.assistant.steps.length > 0);
    assert.ok(result.payload.assistant.steps.length <= 8);
  } finally {
    if (previousKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousKey;
    }
  }
});

test("AI Security Mentor bounds website input and normalizes severity", async () => {
  const tooLong = await invoke({
    finding: "HSTS",
    website: "https://example.com/" + "a".repeat(2050)
  });
  assert.equal(tooLong.statusCode, 400);

  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const result = await invoke({
      finding: "HSTS",
      severity: "not-a-severity",
      website: "https://example.com"
    });
    assert.equal(result.statusCode, 200);
    assert.equal(result.payload.assistant.severity, "Unknown");
  } finally {
    if (previousKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousKey;
    }
  }
});
