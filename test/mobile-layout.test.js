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

test("research selects have explicit labels and links meet dark-background contrast styling", () => {
  for (const id of [
    "researchReviewerCaseSelect",
    "researchPlanCaseSelect",
    "researchPlanMethod",
    "researchProjectSelect",
    "researchAssetSelect",
    "researchFindingSeverity"
  ]) {
    assert.ok(html.includes('<label for="' + id + '">'), id);
  }
  assert.match(css, /a\s*\{[^}]*color:\s*#8ab4f8/s);
  assert.match(css, /label\s*\{[^}]*color:\s*#dbeafe/s);
});

test("site provides an explicit SVG favicon to avoid browser 404 requests", () => {
  assert.match(html, /rel="icon" type="image\/svg\+xml" href="\/favicon\.svg"/);
  const favicon = readFileSync(new URL("../public/favicon.svg", import.meta.url), "utf8");
  assert.match(favicon, /<svg[\s\S]*viewBox="0 0 64 64"/);
});
