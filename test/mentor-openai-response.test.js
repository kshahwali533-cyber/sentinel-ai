import assert from "node:assert/strict";
import test from "node:test";
import { readOpenAIResponse } from "../api/_lib/mentor-openai-response.js";

test("parses a valid OpenAI response within the configured byte limit", async () => {
  const payload = { output_text: "Safe defensive guidance" };
  const response = new Response(JSON.stringify(payload));

  assert.deepEqual(
    await readOpenAIResponse(response, 1024, 1000),
    payload
  );
});

test("rejects an OpenAI response that exceeds the byte limit", async () => {
  const response = new Response(JSON.stringify({ output_text: "x".repeat(100) }));

  await assert.rejects(
    readOpenAIResponse(response, 32, 1000),
    error => error.code === "RESPONSE_TOO_LARGE"
  );
});

test("rejects malformed JSON from the upstream AI service", async () => {
  await assert.rejects(
    readOpenAIResponse(new Response("{not-json"), 1024, 1000),
    error => error.code === "INVALID_UPSTREAM_JSON"
  );
});

test("applies a time limit while reading the upstream response body", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("{"));
    },
    pull() {
      return new Promise(resolve => setTimeout(resolve, 200));
    }
  });

  await assert.rejects(
    readOpenAIResponse(new Response(stream), 1024, 30),
    error => error.code === "RESPONSE_BODY_TIMEOUT"
  );
});
