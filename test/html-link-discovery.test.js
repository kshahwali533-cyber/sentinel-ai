import assert from "node:assert/strict";
import test from "node:test";
import { extractHTMLLinks } from "../api/_lib/html-link-discovery.js";

test("extracts real document anchors and ignores anchors inside scripts", () => {
  const html = '<html><body>' +
    '<a href="/about">About</a>' +
    '<script>const template = `<a href="${escapeHTML(result.sources?.nvd || "https://nvd.nist.gov/")}">NVD</a>`;</script>' +
    "<a href='/contact'>Contact</a>" +
    '</body></html>';
  assert.deepEqual(extractHTMLLinks(html), ["/about", "/contact"]);
});

test("ignores links inside styles and HTML comments", () => {
  const html = `
    <!-- <a href="/comment-only">comment</a> -->
    <style>.x::after { content: '<a href="/css-template">'; }</style>
    <a href="/real">Real</a>
  `;
  assert.deepEqual(extractHTMLLinks(html), ["/real"]);
});

test("returns an empty list for invalid or empty input", () => {
  assert.deepEqual(extractHTMLLinks(""), []);
  assert.deepEqual(extractHTMLLinks(null), []);
});
