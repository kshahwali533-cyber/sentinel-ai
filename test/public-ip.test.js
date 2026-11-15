import test from "node:test";
import assert from "node:assert/strict";
import { isPublicIP } from "../api/_lib/public-ip.js";

test("allows globally routable IPv4 and IPv6 examples", () => {
  assert.equal(isPublicIP("8.8.8.8"), true);
  assert.equal(isPublicIP("93.184.216.34"), true);
  assert.equal(isPublicIP("2606:4700:4700::1111"), true);
  assert.equal(isPublicIP("2001:4860:4860::8888"), true);
});

test("blocks private, loopback, link-local and shared IPv4 ranges", () => {
  for (const address of ["0.1.2.3", "10.0.0.1", "100.64.0.1", "127.0.0.1",
    "169.254.1.1", "172.16.0.1", "192.168.1.1"]) {
    assert.equal(isPublicIP(address), false, address);
  }
});

test("blocks IPv4 special-use, documentation, benchmark and multicast ranges", () => {
  for (const address of ["192.0.0.8", "192.0.2.1", "192.88.99.1", "198.18.0.1",
    "198.51.100.1", "203.0.113.1", "224.0.0.1", "240.0.0.1", "255.255.255.255"]) {
    assert.equal(isPublicIP(address), false, address);
  }
});

test("blocks non-global and special-use IPv6 ranges", () => {
  for (const address of ["::", "::1", "fc00::1", "fe80::1", "ff02::1",
    "2001:db8::1", "2001:2::1", "2002::1", "3fff::1", "::ffff:192.168.1.1"]) {
    assert.equal(isPublicIP(address), false, address);
  }
});

test("rejects malformed and non-IP input", () => {
  for (const address of ["not-an-ip", "999.1.1.1", "2001:::1", ""]) {
    assert.equal(isPublicIP(address), false, address);
  }
});
