import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const headers = config.headers.find(item => item.source === "/(.*)")?.headers || [];
const get = name => headers.find(item => item.key.toLowerCase() === name.toLowerCase())?.value || "";
const csp = get("Content-Security-Policy");
const app = readFileSync(new URL("../sentinel-app.js", import.meta.url), "utf8");
const cssFile = readFileSync(new URL("../sentinel.css", import.meta.url), "utf8");

test("CSP limits images and fonts to first-party and data sources", () => {
  assert.match(csp, /img-src 'self' data:/);
  assert.match(csp, /font-src 'self' data:/);
  assert.doesNotMatch(csp, /img-src[^;]*https:/);
  assert.doesNotMatch(csp, /font-src[^;]*https:/);
});

test("cross-origin policies are explicit without requiring cross-origin isolation", () => {
  assert.equal(get("Access-Control-Allow-Origin"), "", "same-origin APIs must not emit a stale fixed-origin CORS grant");
  assert.equal(get("Cross-Origin-Opener-Policy"), "same-origin-allow-popups");
  assert.equal(get("Cross-Origin-Resource-Policy"), "same-origin");
  assert.equal(get("X-Content-Type-Options"), "nosniff");
  assert.equal(get("Strict-Transport-Security"), "max-age=31536000; includeSubDomains");
  assert.equal(get("Permissions-Policy"), "camera=(), microphone=(), geolocation=()");
  assert.equal(get("Cross-Origin-Embedder-Policy"), "");
});

test("CSP keeps required same-origin, Supabase, and Vercel telemetry endpoints", () => {
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /https:\/\/cdn\.jsdelivr\.net/);
  assert.match(csp, /https:\/\/vceqmqwszvisvxxbgbfs\.supabase\.co/);
  assert.match(csp, /wss:\/\/vceqmqwszvisvxxbgbfs\.supabase\.co/);
  assert.match(csp, /https:\/\/vitals\.vercel-insights\.com/);
});

test("Preview safety banner uses a stylesheet class compatible with strict CSP", () => {
  assert.match(app, /safetyNotice\.className = "preview-safe-mode-banner"/);
  assert.match(cssFile, /\.preview-safe-mode-banner\s*\{/);
  assert.doesNotMatch(app, /safetyNotice\.style\.cssText/);
});
