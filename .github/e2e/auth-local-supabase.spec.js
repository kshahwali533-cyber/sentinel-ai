import { test, expect } from "@playwright/test";

const baseURL = process.env.BASE_URL || "http://127.0.0.1:4173";
const mailpitURL = process.env.MAILPIT_URL || "http://127.0.0.1:54324";

test("local Supabase Auth supports signup, login, logout, recovery email, and password update", async ({ page, request }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const email = "sentinel-e2e-" + Date.now() + "@example.test";
  const initialPassword = "Sentinel-E2E-Password-2026!";
  const updatedPassword = "Sentinel-E2E-Updated-2026!";

  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#authEmail")).toBeVisible();

  await page.locator("#authEmail").fill(email);
  await page.locator("#authPassword").fill("short");
  await page.locator('[data-action="sign-up-user"]').click();
  await expect(page.locator("#authStatus")).toContainText("at least 12 characters");

  await page.locator("#authPassword").fill(initialPassword);
  await page.locator('[data-action="sign-up-user"]').click();
  await expect(page.locator("#loggedInEmail")).toHaveText(email, { timeout: 30000 });

  await page.locator('[data-action="sign-out-user"]').click();
  await expect(page.locator("#authStatus")).toContainText("logged out successfully");
  await expect(page.locator("#authForm")).toBeVisible();

  await page.locator("#authEmail").fill(email);
  await page.locator("#authPassword").fill(initialPassword);
  await page.locator('[data-action="sign-in-user"]').click();
  await expect(page.locator("#loggedInEmail")).toHaveText(email, { timeout: 30000 });

  await page.locator('[data-action="sign-out-user"]').click();
  await expect(page.locator("#authStatus")).toContainText("logged out successfully");
  await page.locator("#authEmail").fill(email);
  await page.locator('[data-action="reset-password"]').click();
  await expect(page.locator("#authStatus")).toContainText("Password reset link sent", { timeout: 30000 });

  let recoveryMessage = null;
  for (let attempt = 0; attempt < 20 && !recoveryMessage; attempt += 1) {
    const response = await request.get(mailpitURL + "/api/v1/messages");
    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    const messages = payload.messages || payload.Messages || [];
    recoveryMessage = messages.find((message) =>
      JSON.stringify(message).toLowerCase().includes(email.toLowerCase())
    ) || null;
    if (!recoveryMessage) await page.waitForTimeout(500);
  }
  expect(recoveryMessage, "Supabase local Auth recovery email should reach Mailpit").toBeTruthy();

  const messageId = recoveryMessage.ID || recoveryMessage.Id || recoveryMessage.id;
  expect(messageId).toBeTruthy();
  const detailResponse = await request.get(mailpitURL + "/api/v1/message/" + encodeURIComponent(messageId));
  expect(detailResponse.ok()).toBeTruthy();
  const detail = await detailResponse.json();
  const emailBody = String(detail.HTML || detail.html || "") + "\n" + String(detail.Text || detail.text || "");
  const links = (emailBody.match(/https?:\\/\\/[^\s"'<>]+/g) || [])
    .map((link) => link.replace(/&amp;/g, "&"));
  const recoveryLink = links.find((link) => link.includes("type=recovery") || link.includes("token="));
  expect(recoveryLink, "Recovery email should contain a usable recovery link").toBeTruthy();

  await page.goto(recoveryLink, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#passwordResetArea")).toBeVisible({ timeout: 30000 });
  await page.locator("#newPassword").fill(updatedPassword);
  await page.locator("#confirmPassword").fill(updatedPassword);
  await page.locator('[data-action="update-password"]').click();
  await expect(page.locator("#authStatus")).toContainText("Password updated successfully", { timeout: 30000 });

  await page.locator("#authEmail").fill(email);
  await page.locator("#authPassword").fill(updatedPassword);
  await page.locator('[data-action="sign-in-user"]').click();
  await expect(page.locator("#loggedInEmail")).toHaveText(email, { timeout: 30000 });

  expect(pageErrors).toEqual([]);
});
