import test from "node:test";
import assert from "node:assert/strict";
import { getTrustedClientIp } from "../api/_lib/client-ip.js";

test("uses the proxy-provided x-real-ip address", () => {
  assert.equal(getTrustedClientIp({ "x-real-ip": "203.0.113.9" }, "10.0.0.1"), "203.0.113.9");
});

test("falls back to the socket address when x-real-ip is unavailable", () => {
  assert.equal(getTrustedClientIp({ "x-forwarded-for": "198.51.100.7" }, "10.0.0.1"), "10.0.0.1");
});

test("rejects malformed proxy values and falls back to the socket address", () => {
  assert.equal(getTrustedClientIp({ "x-real-ip": "not-an-ip" }, "192.0.2.4"), "192.0.2.4");
  assert.equal(getTrustedClientIp({ "x-real-ip": "203.0.113.4, 198.51.100.8" }, undefined), "unknown");
});

test("supports IPv6 proxy addresses", () => {
  assert.equal(getTrustedClientIp({ "x-real-ip": "2001:db8::1" }), "2001:db8::1");
});
