import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const baseURL = process.env.BASE_URL;
if (!baseURL) throw new Error("BASE_URL is required for the Preview browser audit.");

test("Preview renders and remains usable at mobile, tablet, and desktop widths", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(/Sentinel AI/);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("#scanner")).toBeAttached();
  await expect(page.locator("#monitoring")).toBeAttached();
  await expect(page.locator("#research")).toBeAttached();
  await expect(page.locator("#authEmail")).toBeVisible();

  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(100);
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth
    }));
    expect(
      dimensions.document,
      "Unexpected horizontal overflow at viewport width " + width
    ).toBeLessThanOrEqual(dimensions.viewport + 1);
  }

  await page.locator('a[href="#scanner"]').first().click();
  await expect(page).toHaveURL(/#scanner$/);

  await page.locator('[data-action="toggle-password"]').click();
  await expect(page.locator("#authPassword")).toHaveAttribute("type", "text");
  await page.locator('[data-action="toggle-password"]').click();
  await expect(page.locator("#authPassword")).toHaveAttribute("type", "password");

  expect(pageErrors).toEqual([]);
});

test("Preview serves canonical metadata from the configured Production origin", async ({ request }) => {
  const expectedOrigin = "https://project-3jyda.vercel.app";
  const robots = await request.get(baseURL + "/robots.txt");
  const sitemap = await request.get(baseURL + "/sitemap.xml");
  const security = await request.get(baseURL + "/.well-known/security.txt");

  expect(robots.status()).toBe(200);
  expect(sitemap.status()).toBe(200);
  expect(security.status()).toBe(200);
  expect(await robots.text()).toContain("Sitemap: " + expectedOrigin + "/sitemap.xml");
  expect(await sitemap.text()).toContain("<loc>" + expectedOrigin + "/</loc>");
  expect(await security.text()).toContain("Canonical: " + expectedOrigin + "/.well-known/security.txt");
  expect(security.headers()["x-robots-tag"]).toContain("noindex");
});

test("Preview meets the critical WCAG accessibility checks", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const critical = results.violations.filter((violation) => violation.impact === "critical");
  console.log("Axe accessibility findings:", JSON.stringify(
    results.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      affectedElements: nodes.length
    }))
  ));
  expect(critical).toEqual([]);
});
