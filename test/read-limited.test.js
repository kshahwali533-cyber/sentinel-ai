import assert from "node:assert/strict";
import test from "node:test";
import { readTextLimited } from "../api/_lib/read-limited.js";

test("reads a response body within the byte and time limits", async () => {
  const response = new Response("Sentinel AI ✓");
  assert.equal(await readTextLimited(response, 100, 1000), "Sentinel AI ✓");
});

test("rejects a response body that exceeds the byte limit", async () => {
  const response = new Response("123456789");
  await assert.rejects(
    readTextLimited(response, 4, 1000),
    error => error.code === "RESPONSE_TOO_LARGE"
  );
});

test("times out a slow response body after headers have arrived", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("first"));
    },
    pull() {
      return new Promise(resolve => setTimeout(() => {
        resolve();
      }, 250));
    },
    cancel() {
      cancelled = true;
    }
  });
  const response = new Response(stream);

  await assert.rejects(
    readTextLimited(response, 1024, 40),
    error => error.code === "RESPONSE_BODY_TIMEOUT"
  );
  assert.equal(cancelled, true);
});

test("decodes UTF-8 correctly when a character spans stream chunks", async () => {
  const bytes = new TextEncoder().encode("A🔐B");
  const response = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(bytes.slice(0, 3));
      controller.enqueue(bytes.slice(3, 5));
      controller.enqueue(bytes.slice(5));
      controller.close();
    }
  }));

  assert.equal(await readTextLimited(response, bytes.byteLength), "A🔐B");
});

test("rejects invalid byte and timeout limits", async () => {
  const response = new Response("ok");
  await assert.rejects(readTextLimited(response, 0), TypeError);
  await assert.rejects(readTextLimited(response, 10, 0), TypeError);
});

test("rejects responses without a readable body stream", async () => {
  await assert.rejects(
    readTextLimited(new Response(null), 16),
    /Response body stream is unavailable/
  );
});
