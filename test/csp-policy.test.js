import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Sentinel sends an enforced CSP with required application origins", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  const headers = config.headers.flatMap((entry) => entry.headers || []);
  const csp = headers.find((header) => header.key === "Content-Security-Policy");

  assert.ok(csp, "enforced CSP header must be present");
  assert.equal(headers.some((header) => header.key === "Content-Security-Policy-Report-Only"), false,
    "the enforced policy replaces the observation-only policy");

  const directives = new Map(csp.value.split(";").map((part) => {
    const [name, ...values] = part.trim().split(/\\s+/);
    return [name, values];
  }));

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
  assert.ok(csp.value.includes("'unsafe-inline'"),
    "inline compatibility is explicit until inline handlers are migrated");
});
