import test from "node:test";
import assert from "node:assert/strict";
import { createSafeFetch } from "../api/_lib/safe-fetch.js";

function makeResponse(status, location = null, onCancel = () => {}) {
  return {
    status,
    headers: {
      get(name) {
        return name.toLowerCase() === "location" ? location : null;
      }
    },
    body: {
      async cancel() {
        onCancel();
      }
    }
  };
}

function safeValidation(url) {
  return {
    safe: true,
    addresses: [{ address: "93.184.216.34", family: 4 }]
  };
}

test("follows relative redirects and reuses the validated destination", async () => {
  const validationHosts = [];
  const requestedURLs = [];
  let cancelledBodies = 0;

  const safeFetch = createSafeFetch({
    validateTargetURL: async url => {
      validationHosts.push(url.hostname);
      return safeValidation(url);
    },
    requestPinned: async url => {
      requestedURLs.push(url.href);
      if (requestedURLs.length === 1) {
        return makeResponse(302, "/final", () => cancelledBodies++);
      }
      return makeResponse(200);
    }
  });

  const result = await safeFetch(new URL("https://start.test/path"));

  assert.equal(result.response.status, 200);
  assert.equal(result.finalURL.href, "https://start.test/final");
  assert.deepEqual(requestedURLs, [
    "https://start.test/path",
    "https://start.test/final"
  ]);
  assert.deepEqual(validationHosts, ["start.test", "start.test"]);
  assert.equal(cancelledBodies, 1);
});

test("blocks a private redirect before making a request to it", async () => {
  const requestedURLs = [];
  let cancelledBodies = 0;

  const safeFetch = createSafeFetch({
    validateTargetURL: async url => {
      if (url.hostname === "private.test") {
        return { safe: false, reason: "Private destination." };
      }
      return safeValidation(url);
    },
    requestPinned: async url => {
      requestedURLs.push(url.href);
      return makeResponse(302, "http://private.test/admin", () => cancelledBodies++);
    }
  });

  await assert.rejects(
    safeFetch(new URL("https://public.test/")),
    error => error.code === "SSRF_REDIRECT_BLOCKED"
  );

  assert.deepEqual(requestedURLs, ["https://public.test/"]);
  assert.equal(cancelledBodies, 1);
});

test("rejects malformed redirect locations and cancels the response body", async () => {
  let cancelledBodies = 0;

  const safeFetch = createSafeFetch({
    validateTargetURL: async url => safeValidation(url),
    requestPinned: async () =>
      makeResponse(302, "http://[invalid", () => cancelledBodies++)
  });

  await assert.rejects(
    safeFetch(new URL("https://public.test/")),
    error => error.code === "INVALID_REDIRECT"
  );

  assert.equal(cancelledBodies, 1);
});

test("stops after the configured maximum redirects and cancels the last response", async () => {
  let requests = 0;
  let cancelledBodies = 0;

  const safeFetch = createSafeFetch({
    maxRedirects: 2,
    validateTargetURL: async url => safeValidation(url),
    requestPinned: async () => {
      requests++;
      return makeResponse(
        302,
        `https://redirect-${requests}.test/next`,
        () => cancelledBodies++
      );
    }
  });

  await assert.rejects(
    safeFetch(new URL("https://start.test/")),
    error => error.code === "TOO_MANY_REDIRECTS"
  );

  assert.equal(requests, 3);
  assert.equal(cancelledBodies, 3);
});

test("returns a redirect response without a Location header to the caller", async () => {
  const safeFetch = createSafeFetch({
    validateTargetURL: async url => safeValidation(url),
    requestPinned: async () => makeResponse(302)
  });

  const result = await safeFetch(new URL("https://public.test/"));

  assert.equal(result.response.status, 302);
  assert.equal(result.finalURL.href, "https://public.test/");
});

test("rejects an unsafe initial destination before making a request", async () => {
  let requests = 0;

  const safeFetch = createSafeFetch({
    validateTargetURL: async () => ({
      safe: false,
      reason: "Private destination."
    }),
    requestPinned: async () => {
      requests++;
      return makeResponse(200);
    }
  });

  await assert.rejects(
    safeFetch(new URL("http://localhost/")),
    error => error.code === "SSRF_BLOCKED"
  );

  assert.equal(requests, 0);
});

test("validates the redirect target before requesting it", async () => {
  const sequence = [];

  const safeFetch = createSafeFetch({
    validateTargetURL: async url => {
      sequence.push(`validate:${url.hostname}`);
      return safeValidation(url);
    },
    requestPinned: async url => {
      sequence.push(`request:${url.hostname}`);
      return url.hostname === "start.test"
        ? makeResponse(307, "https://next.test/")
        : makeResponse(200);
    }
  });

  await safeFetch(new URL("https://start.test/"));

  assert.deepEqual(sequence, [
    "validate:start.test",
    "request:start.test",
    "validate:next.test",
    "request:next.test"
  ]);
});
