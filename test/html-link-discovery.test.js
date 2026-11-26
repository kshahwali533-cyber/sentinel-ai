import assert from "node:assert/strict";
import test from "node:test";
import { extractHTMLLinks } from "../api/_lib/html-link-discovery.js";

test("extracts document anchors while excluding script and style contents", () => {
  const html = `
    <html><body>
      <a href="/about">About</a>
      <script>const template = '<a href="/script-only">not a link</a>';</script>
      <style>.x::after { content: '<a href="/style-only">'; }</style>
      <a href='/contact'>Contact</a>
    </body></html>
  `;
  assert.deepEqual(extractHTMLLinks(html), ["/about", "/contact"]);
});

test("uses browser-compatible parsing for malformed script end tags", () => {
  const html = `
    <script>
      const payload = '<a href="/inside-script">fake</a>';
    </script
      data-extra="accepted by HTML parsing">
    <a href="/outside-script">real</a>
  `;
  assert.deepEqual(extractHTMLLinks(html), ["/outside-script"]);
});

test("handles uppercase tags and HTML comment close syntax", () => {
  const html = `
    <!-- <a href="/comment-one">hidden</a> --!>
    <A HREF="/uppercase">Visible</A>
    <!-- <a href="/comment-two">hidden</a> -->
  `;
  assert.deepEqual(extractHTMLLinks(html), ["/uppercase"]);
});

test("does not treat inert template contents as document links", () => {
  const html = `
    <template><a href="/template-only">inert</a></template>
    <a href="/live">live</a>
  `;
  assert.deepEqual(extractHTMLLinks(html), ["/live"]);
});

test("supports unquoted hrefs and decodes HTML character references", () => {
  const html = '<a href=/plain>Plain</a><a href="/search?a=1&amp;b=2">Search</a>';
  assert.deepEqual(extractHTMLLinks(html), ["/plain", "/search?a=1&b=2"]);
});

test("returns an empty list for invalid or empty input", () => {
  assert.deepEqual(extractHTMLLinks(""), []);
  assert.deepEqual(extractHTMLLinks(null), []);
  assert.deepEqual(extractHTMLLinks(undefined), []);
});
