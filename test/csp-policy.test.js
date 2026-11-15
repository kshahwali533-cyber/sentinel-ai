import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Vercel CSP remains report-only while the app is being audited", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  const headers = config.headers.flatMap((entry) => entry.headers || []);
  const csp = headers.find((header) => header.key === "Content-Security-Policy-Report-Only");

  assert.ok(csp, "report-only CSP header must be present");
  assert.equal(headers.some((header) => header.key === "Content-Security-Policy"), false,
    "do not enforce CSP until inline scripts/handlers have been migrated and browser-tested");

  const directives = new Map(
    csp.value.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values];
    })
  );

  assert.deepEqual(directives.get("default-src"), ["'self'"]);
  assert.ok(directives.get("script-src")?.includes("https://cdn.jsdelivr.net"));
  assert.ok(directives.get("connect-src")?.includes("https://vceqmqwszvisvxxbgbfs.supabase.co"));
  assert.ok(directives.get("connect-src")?.includes("wss://vceqmqwszvisvxxbgbfs.supabase.co"));
  assert.deepEqual(directives.get("object-src"), ["'none'"]);
  assert.deepEqual(directives.get("base-uri"), ["'self'"]);
  assert.deepEqual(directives.get("form-action"), ["'self'"]);
  assert.deepEqual(directives.get("frame-ancestors"), ["'none'"]);
  assert.deepEqual(directives.get("frame-src"), ["'none'"]);
  assert.deepEqual(directives.get("manifest-src"), ["'self'"]);
  assert.deepEqual(directives.get("media-src"), ["'self'"]);
  assert.ok(directives.has("upgrade-insecure-requests"));
  assert.ok(!csp.value.includes("'unsafe-eval'"), "unsafe-eval must not be enabled");
});
