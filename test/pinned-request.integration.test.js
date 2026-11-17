import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createSafeFetch } from "../api/_lib/safe-fetch.js";
import { createPinnedRequest } from "../api/_lib/pinned-request.js";

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections?.();
  });
}

function localTestRequest() {
  // This exception is test-only: the server is bound to this process's
  // loopback interface. Production uses createPinnedRequest() with isPublicIP.
  return createPinnedRequest({
    isPublicIPAddress: address => address === "127.0.0.1"
  });
}

function pinnedLocalValidation() {
  return {
    safe: true,
    addresses: [{ address: "127.0.0.1", family: 4 }]
  };
}

test("real HTTP transport follows a relative redirect through the pinned IP", async t => {
  const hits = [];
  const server = createServer((req, res) => {
    hits.push({ path: req.url, host: req.headers.host });

    if (req.url === "/start") {
      res.writeHead(302, { Location: "/final" });
      res.end("redirect response body");
      return;
    }

    if (req.url === "/final") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("pinned-transport-ok");
      return;
    }

    res.writeHead(404);
    res.end("not found");
  });

  const port = await listen(server);
  t.after(() => close(server));

  const safeFetch = createSafeFetch({
    validateTargetURL: async () => pinnedLocalValidation(),
    requestPinned: localTestRequest()
  });

  const result = await safeFetch(
    new URL(`http://scanner-test.example:${port}/start`),
    { timeout: 2000 }
  );

  assert.equal(result.response.status, 200);
  assert.equal(await result.response.text(), "pinned-transport-ok");
  assert.equal(result.finalURL.href, `http://scanner-test.example:${port}/final`);
  assert.deepEqual(hits.map(hit => hit.path), ["/start", "/final"]);
  assert.ok(hits.every(hit => hit.host === `scanner-test.example:${port}`));
});

test("real HTTP redirect to a rejected private destination is blocked before a second socket request", async t => {
  const hits = [];
  const server = createServer((req, res) => {
    hits.push(req.url);
    res.writeHead(302, {
      Location: `http://internal.test:${server.address().port}/must-not-connect`
    });
    res.end("redirect response body");
  });

  const port = await listen(server);
  t.after(() => close(server));

  const safeFetch = createSafeFetch({
    validateTargetURL: async url => {
      if (url.hostname === "internal.test") {
        return { safe: false, reason: "Private destination blocked by test policy." };
      }
      return pinnedLocalValidation();
    },
    requestPinned: localTestRequest()
  });

  await assert.rejects(
    safeFetch(new URL(`http://scanner-test.example:${port}/start`), { timeout: 2000 }),
    error => error.code === "SSRF_REDIRECT_BLOCKED"
  );

  assert.deepEqual(hits, ["/start"]);
});

test("production pinned transport rejects loopback addresses before opening a socket", async () => {
  const requestPinned = createPinnedRequest();

  await assert.rejects(
    requestPinned(
      new URL("http://scanner-test.example/"),
      [{ address: "127.0.0.1", family: 4 }]
    ),
    /validated destination address is not safe/
  );
});
