import test from "node:test";
import assert from "node:assert/strict";
import { createCheckEvidence } from "../api/_lib/finding-validation.js";

function headers(values = {}) {
  return {
    get(name) {
      return values[name.toLowerCase()] ?? null;
    },
    getSetCookie() {
      return values.cookies || [];
    }
  };
}

test("header evidence records the observed response value", () => {
  const evidence = createCheckEvidence({
    name: "HSTS",
    headers: headers({ "strict-transport-security": "max-age=31536000; includeSubDomains" })
  });
  assert.equal(evidence.source, "HTTP response header");
  assert.equal(evidence.signal, "strict-transport-security");
  assert.match(evidence.observed, /max-age=31536000/);
  assert.match(evidence.expected, /max-age/);
});

test("missing header evidence explicitly records absence", () => {
  const evidence = createCheckEvidence({ name: "X-Content-Type-Options", headers: headers() });
  assert.equal(evidence.observed, "Header not present");
});

test("clickjacking evidence records both relevant response headers", () => {
  const evidence = createCheckEvidence({
    name: "Clickjacking Protection",
    headers: headers({ "x-frame-options": "DENY", "content-security-policy": "frame-ancestors 'none'" })
  });
  assert.match(evidence.observed, /DENY/);
  assert.match(evidence.observed, /frame-ancestors/);
});

test("cookie evidence summarizes attributes without exposing cookie values", () => {
  const evidence = createCheckEvidence({
    name: "Cookie Security",
    headers: headers({ cookies: ["session=secret-value; Secure; HttpOnly; SameSite=Lax"] })
  });
  assert.match(evidence.observed, /1 Secure/);
  assert.match(evidence.observed, /1 HttpOnly/);
  assert.doesNotMatch(evidence.observed, /secret-value/);
});

test("destination evidence avoids query strings and full paths", () => {
  const evidence = createCheckEvidence({
    name: "HTTPS",
    finalTarget: new URL("https://example.org/private?token=do-not-log")
  });
  assert.equal(evidence.observed, "https://example.org");
  assert.doesNotMatch(evidence.observed, /token/);
});

test("status evidence records the observed HTTP code", () => {
  const evidence = createCheckEvidence({ name: "HTTP Response Status", responseStatus: 200 });
  assert.equal(evidence.observed, "200");
});

test("unknown checks do not receive invented evidence", () => {
  assert.equal(createCheckEvidence({ name: "Unknown future check" }), null);
});
