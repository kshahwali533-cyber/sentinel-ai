import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../sentinel.css", import.meta.url), "utf8");

test("mobile viewport is configured for device-width rendering", () => {
  assert.match(html, /name\s*=\s*"viewport"[\s\S]{0,120}content\s*=\s*"width=device-width, initial-scale=1(?:\.0)?"/i);
});

test("small-screen layout has explicit responsive rules for navigation and content grids", () => {
  assert.match(css, /@media\s*\(max-width:\s*650px\)/);
  assert.match(css, /header\s*\{[^}]*flex-direction:\s*column/s);
  assert.match(css, /\.summary\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(css, /\.auth-actions\s*\{[^}]*grid-template-columns:\s*1fr/s);
});

test("stylesheet does not impose large fixed minimum widths that force mobile overflow", () => {
  assert.doesNotMatch(css, /min-width:\s*[3-9][0-9]{2,}px/i);
  assert.match(css, /min-width:\s*0/);
});
