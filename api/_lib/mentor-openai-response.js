import { readTextLimited } from "./read-limited.js";

/**
 * Read and parse the OpenAI Responses API payload without buffering an
 * unbounded upstream response in memory.
 */
export async function readOpenAIResponse(
  response,
  maxBytes = 256 * 1024,
  timeoutMs = 10000
) {
  const responseText = await readTextLimited(response, maxBytes, timeoutMs);

  try {
    return JSON.parse(responseText);
  } catch {
    const error = new Error("OpenAI returned an invalid JSON response.");
    error.code = "INVALID_UPSTREAM_JSON";
    throw error;
  }
}
