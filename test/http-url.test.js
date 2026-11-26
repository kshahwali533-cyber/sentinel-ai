import assert from "node:assert/strict";
import test from "node:test";
import { parseHttpUrl } from "../api/_lib/http-url.js";

const base = "https://example.com/start";

test("accepts absolute HTTP(S) and relative web URLs", () => {
  assert.equal(parseHttpUrl("https://example.com/a", base)?.href, "https://example.com/a");
  assert.equal(parseHttpUrl("http://example.com/a", base)?.href, "http://example.com/a");
  assert.equal(parseHttpUrl("/api/scan", base)?.href, "https://example.com/api/scan");
  assert.equal(parseHttpUrl("//example.com/app.js", base)?.href, "https://example.com/app.js");
});

test("rejects executable and non-web schemes", () => {
  for (const value of [
    "javascript:alert(1)", " JAVASCRIPT:alert(1)", "data:text/html,hello",
    "vbscript:msgbox(1)", "blob:https://example.com/id", "file:///etc/passwd",
    "ftp://example.com/file"
  ]) assert.equal(parseHttpUrl(value, base), null, value);
});

test("rejects empty, non-string and malformed inputs", () => {
  for (const value of ["", "   ", null, undefined, "http://[invalid"]) {
    assert.equal(parseHttpUrl(value, base), null);
  }
});
