import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  isApprovedProductionRequest,
  normalizeRequestHostname
} from "../api/_lib/runtime-config.js";

test("normalizes hostnames without accepting URLs, paths, or malformed host values", () => {
  assert.equal(normalizeRequestHostname(" Example.COM "), "example.com");
  assert.equal(normalizeRequestHostname("example.com:443"), "example.com");
  assert.equal(normalizeRequestHostname("https://example.com/path"), null);
  assert.equal(normalizeRequestHostname("example.com,evil.com"), null);
  assert.equal(normalizeRequestHostname(""), null);
});

test("allows a known legacy hostname only in the Vercel Production runtime", () => {
  assert.equal(isApprovedProductionRequest({
    env: { VERCEL_ENV: "production" },
    host: "project-3jyda.vercel.app"
  }), true);
});

test("allows the Vercel production URL and an explicitly configured future domain", () => {
  const env = {
    VERCEL_ENV: "production",
    VERCEL_PROJECT_PRODUCTION_URL: "sentinel.example.com",
    SENTINEL_PRODUCTION_HOSTNAMES: "www.sentinel.example.com, app.sentinel.example.com"
  };
  assert.equal(isApprovedProductionRequest({ env, host: "sentinel.example.com" }), true);
  assert.equal(isApprovedProductionRequest({ env, host: "WWW.SENTINEL.EXAMPLE.COM" }), true);
  assert.equal(isApprovedProductionRequest({ env, host: "app.sentinel.example.com" }), true);
});

test("fails closed for Preview even if its Host header matches a production domain", () => {
  const env = {
    VERCEL_ENV: "preview",
    VERCEL_PROJECT_PRODUCTION_URL: "sentinel.example.com",
    SENTINEL_PRODUCTION_HOSTNAMES: "sentinel.example.com"
  };
  assert.equal(isApprovedProductionRequest({ env, host: "sentinel.example.com" }), false);
});

test("fails closed for unknown hosts and missing deployment environment", () => {
  assert.equal(isApprovedProductionRequest({
    env: { VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "sentinel.example.com" },
    host: "attacker.example.net"
  }), false);
  assert.equal(isApprovedProductionRequest({
    env: { VERCEL_PROJECT_PRODUCTION_URL: "sentinel.example.com" },
    host: "sentinel.example.com"
  }), false);
  assert.equal(isApprovedProductionRequest({
    env: { VERCEL_ENV: "production" },
    host: "attacker.example.net"
  }), false);
});

test("runtime config reuses the existing scan function without adding a Vercel function", () => {
  const scanSource = fs.readFileSync(new URL("../api/scan.js", import.meta.url), "utf8");
  assert.match(scanSource, /req\.method === "GET" && req\.query\?\.runtime_config === "1"/);
  assert.match(scanSource, /isApprovedProductionRequest\(/);
  assert.equal(fs.existsSync(new URL("../api/runtime-config.js", import.meta.url)), false);
});
