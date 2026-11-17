import assert from "node:assert/strict";
import test from "node:test";

const previous = {
  cron: process.env.CRON_SECRET,
  supabaseUrl: process.env.SUPABASE_URL,
  serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY
};
delete process.env.CRON_SECRET;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { default: handler } = await import("../api/monitoring-run.js");

for (const [key, value] of [
  ["CRON_SECRET", previous.cron],
  ["SUPABASE_URL", previous.supabaseUrl],
  ["SUPABASE_SERVICE_ROLE_KEY", previous.serviceRole]
]) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

async function invoke(method, authorization) {
  let statusCode = null;
  let payload = null;
  let allow = null;
  const res = {
    setHeader(name, value) {
      if (name.toLowerCase() === "allow") allow = value;
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
  await handler({ method, headers: { authorization } }, res);
  return { statusCode, payload, allow };
}

test("monitoring worker accepts only GET requests", async () => {
  const result = await invoke("POST", undefined);
  assert.equal(result.statusCode, 405);
  assert.equal(result.allow, "GET");
});

test("monitoring worker rejects requests when CRON_SECRET is absent", async () => {
  delete process.env.CRON_SECRET;
  const result = await invoke("GET", undefined);
  assert.equal(result.statusCode, 401);
  assert.match(result.payload.error, /Unauthorized/);
});

test("monitoring worker refuses to run without Supabase service configuration", async () => {
  process.env.CRON_SECRET = "test-only-cron-secret";
  const result = await invoke("GET", "Bearer test-only-cron-secret");
  assert.equal(result.statusCode, 503);
  assert.match(result.payload.error, /not configured/i);
});


test("monitoring worker rejects an incorrect bearer secret before accessing Supabase", async () => {
  process.env.CRON_SECRET = "expected-test-secret";
  const result = await invoke("GET", "Bearer wrong-test-secret");
  assert.equal(result.statusCode, 401);
  assert.match(result.payload.error, /Unauthorized/);
});

test("monitoring worker rejects non-string authorization headers", async () => {
  process.env.CRON_SECRET = "expected-test-secret";
  const result = await invoke("GET", ["Bearer expected-test-secret"]);
  assert.equal(result.statusCode, 401);
  assert.match(result.payload.error, /Unauthorized/);
});
