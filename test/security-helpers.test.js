import assert from "node:assert/strict";
import test from "node:test";
import { isPublicIP } from "../api/_lib/public-ip.js";
import { createPinnedLookup } from "../api/_lib/pinned-lookup.js";
import { readTextLimited } from "../api/_lib/read-limited.js";

test("public IP policy rejects private, loopback, link-local and reserved IPv4", () => {
  for (const ip of ["10.0.0.1", "127.0.0.1", "169.254.1.1", "192.168.1.1", "100.64.0.1", "192.0.2.1", "224.0.0.1", "240.0.0.1"]) {
    assert.equal(isPublicIP(ip), false, ip);
  }
  assert.equal(isPublicIP("8.8.8.8"), true);
});

test("public IP policy rejects private and non-global IPv6", () => {
  for (const ip of ["::1", "::", "fc00::1", "fe80::1", "2001:db8::1", "::ffff:192.168.1.1"]) {
    assert.equal(isPublicIP(ip), false, ip);
  }
  assert.equal(isPublicIP("2606:4700:4700::1111"), true);
});

test("pinned lookup only answers for the expected hostname and pinned address", async () => {
  const lookup = createPinnedLookup("example.com", { address: "8.8.8.8", family: 4 });
  const answer = await new Promise((resolve, reject) => {
    lookup("example.com", {}, (error, address, family) => error ? reject(error) : resolve({ address, family }));
  });
  assert.deepEqual(answer, { address: "8.8.8.8", family: 4 });
  await new Promise(resolve => {
    lookup("attacker.example", {}, error => {
      assert.ok(error);
      resolve();
    });
  });
});

test("limited response reader rejects bodies above the byte ceiling", async () => {
  const response = new Response("123456789");
  await assert.rejects(readTextLimited(response, 8), error => error.code === "RESPONSE_TOO_LARGE");
});

test("limited response reader returns a body within the byte ceiling", async () => {
  const response = new Response("safe");
  assert.equal(await readTextLimited(response, 8), "safe");
});
