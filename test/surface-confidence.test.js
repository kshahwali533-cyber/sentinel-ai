import test from "node:test";
import assert from "node:assert/strict";
import { isConfirmedSurfaceReference } from "../api/_lib/surface-confidence.js";

test("accepts the exact URL submitted for scanning", () => {
  assert.equal(isConfirmedSurfaceReference({
    url: "https://example.test/dashboard",
    source: "scan-target"
  }), true);
});

test("accepts same-origin routes explicitly linked by the scanned page", () => {
  assert.equal(isConfirmedSurfaceReference({
    url: "https://example.test/dashboard",
    source: "html-link"
  }), true);
});

test("does not promote guessed common paths into confirmed sensitive findings", () => {
  for (const source of ["controlled-discovery", "controlled-parameter-discovery", "standard-path", "scanner"]) {
    assert.equal(isConfirmedSurfaceReference({
      url: "https://example.test/dashboard",
      source
    }), false, source);
  }
});

test("rejects missing or malformed resource records", () => {
  assert.equal(isConfirmedSurfaceReference(null), false);
  assert.equal(isConfirmedSurfaceReference({ source: "html-link" }), false);
  assert.equal(isConfirmedSurfaceReference({ url: "  ", source: "scan-target" }), false);
});
