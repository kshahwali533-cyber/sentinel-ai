/**
 * Read a response body with both a byte ceiling and an overall time limit.
 * The timer covers the entire body stream, not just receipt of response headers.
 */
export async function readTextLimited(response, maxBytes, timeoutMs = 10000) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError("maxBytes must be a positive safe integer.");
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("timeoutMs must be a positive number.");
  }

  const reader = response?.body?.getReader();
  if (!reader) {
    throw new Error("Response body stream is unavailable.");
  }

  const decoder = new TextDecoder();
  let text = "";
  let totalBytes = 0;
  let timeoutHandle;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      const error = new Error("Response body timed out.");
      error.code = "RESPONSE_BODY_TIMEOUT";
      // Do not wait for cancellation: a hostile stream may never settle it.
      reader.cancel(error).catch(() => {});
      reject(error);
    }, timeoutMs);
  });

  const readPromise = (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        const error = new Error("Response body exceeded the allowed size.");
        error.code = "RESPONSE_TOO_LARGE";
        reader.cancel(error).catch(() => {});
        throw error;
      }

      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  })();

  try {
    return await Promise.race([readPromise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle);
    try {
      reader.releaseLock();
    } catch {
      // A timed-out pending read may still be settling after cancellation.
    }
  }
}
