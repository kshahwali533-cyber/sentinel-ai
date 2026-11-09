import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createPinnedLookup } from "../api/_lib/pinned-lookup.js";

test("HTTP request connects using the pinned IP without a second DNS lookup", async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("pinned-connection-ok");
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address();
    const body = await new Promise((resolve, reject) => {
      const request = http.get({
        hostname: "sentinel-dns-rebind-test.invalid",
        port: address.port,
        lookup: createPinnedLookup(
          "sentinel-dns-rebind-test.invalid",
          { address: "127.0.0.1", family: 4 }
        )
      }, response => {
        let content = "";
        response.setEncoding("utf8");
        response.on("data", chunk => { content += chunk; });
        response.on("end", () => resolve(content));
      });

      request.once("error", reject);
    });

    assert.equal(body, "pinned-connection-ok");
  } finally {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
});

test("lookup returns only the pinned address when all:true is requested", async () => {
  const lookup = createPinnedLookup(
    "example.test",
    { address: "93.184.216.34", family: 4 }
  );

  const addresses = await new Promise((resolve, reject) => {
    lookup("example.test", { all: true }, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });

  assert.deepEqual(addresses, [
    { address: "93.184.216.34", family: 4 }
  ]);
});

test("lookup rejects an unexpected hostname", async () => {
  const lookup = createPinnedLookup(
    "example.test",
    { address: "93.184.216.34", family: 4 }
  );

  await assert.rejects(
    new Promise((resolve, reject) => {
      lookup("other.example", {}, error => {
        if (error) reject(error);
        else resolve();
      });
    }),
    /Unexpected hostname/
  );
});

test("lookup normalizes bracketed IPv6 hostnames", async () => {
  const lookup = createPinnedLookup(
    "[2001:db8::1]",
    { address: "2001:db8::1", family: 6 }
  );

  const result = await new Promise((resolve, reject) => {
    lookup("2001:db8::1", {}, (error, address, family) => {
      if (error) reject(error);
      else resolve({ address, family });
    });
  });

  assert.deepEqual(result, { address: "2001:db8::1", family: 6 });
});
