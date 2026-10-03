import { expect, test } from "@playwright/test";

const verdict = (page: import("@playwright/test").Page) => page.locator("#verdict-heading");

test.describe("checking a message", () => {
  test("pasting a scam message shows a verdict, highlighted red flags and a safe plan", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Paste the suspicious message").fill(
      "URGENT: your bank account is locked. Verify your password at chase-secure-verify.top within 24 hours.",
    );
    await page.getByRole("button", { name: "Unmask it" }).click();
    await expect(verdict(page)).toHaveText(/scam/i);
    await expect(page.locator(".exhibit mark").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "How to check safely" })).toBeVisible();
    await expect(page.getByText(/don't use any link, phone number or email in the message/i)).toBeVisible();
  });

  test("a gallery example gives a verdict and plan within three clicks", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Missed delivery fee/ }).click();
    await expect(verdict(page)).toBeVisible();
    await expect(page.getByRole("heading", { name: "How to check safely" })).toBeVisible();
  });

  test("a legitimate 2FA message is not called a scam", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Real 2FA code/ }).click();
    await expect(verdict(page)).toHaveText(/likely safe/i);
  });

  test("a screenshot is read and analysed", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("screenshot-input").setInputFiles("e2e/fixtures/screenshot.png");
    await expect(page.getByText("screenshot.png")).toBeVisible();
    await page.getByRole("button", { name: "Unmask it" }).click();
    await expect(verdict(page)).toBeVisible();
    await expect(page.locator(".exhibit")).toContainText("usps-redelivery.top");
  });

  test("when the AI is down the verdict is clearly labeled as rules-only", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Paste the suspicious message").fill("[[mock:fail]] Buy gift cards urgently and keep this between us");
    await page.getByRole("button", { name: "Unmask it" }).click();
    await expect(page.getByText(/comes from our automatic checks only/i)).toBeVisible();
    await expect(verdict(page)).not.toHaveText(/likely safe/i);
  });

  test("malformed AI output is repaired transparently", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Paste the suspicious message").fill("[[mock:malformed]] Your account is suspended, verify now");
    await page.getByRole("button", { name: "Unmask it" }).click();
    await expect(verdict(page)).toBeVisible();
    await expect(page.getByText(/comes from our automatic checks only/i)).toHaveCount(0);
  });
});

test.describe("responding", () => {
  test("the already-paid flow gives ordered recovery steps and report links", async ({ page }) => {
    await page.goto("/#help");
    await page.getByRole("radio", { name: /gift cards/i }).click();
    await expect(page.getByText(/do this now/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /ReportFraud\.ftc\.gov/ })).toHaveAttribute("href", "https://reportfraud.ftc.gov/");
  });

  test("the safe word is generated on the device without any network request", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const requests: string[] = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.getByRole("button", { name: "Generate a safe word" }).click();
    await expect(page.getByTestId("safe-word")).toHaveText(/“[a-z]+ [a-z]+ [a-z]+”/);
    expect(requests).toEqual([]);
  });
});

test.describe("limits and safety", () => {
  test("oversized requests are rejected with a friendly message", async ({ page, request }) => {
    const response = await request.post("/api/analyze", { data: { text: "a".repeat(4_500_000) } });
    expect(response.status()).toBe(413);

    await page.route("**/api/analyze", (route) => route.fulfill({ status: 413, body: "Request Entity Too Large" }));
    await page.goto("/");
    await page.getByLabel("Paste the suspicious message").fill("hello");
    await page.getByRole("button", { name: "Unmask it" }).click();
    // Next.js also renders a route-announcer alert, so match ours by its text.
    await expect(page.getByRole("alert").filter({ hasText: /too large to check/i })).toBeVisible();
  });

  test("the page hydrates under the production CSP with no violations", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && /Content Security Policy/i.test(msg.text())) violations.push(msg.text());
    });
    const response = await page.goto("/");
    expect(response?.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    await page.getByRole("button", { name: "Generate a safe word" }).click();
    await expect(page.getByTestId("safe-word")).toBeVisible();
    expect(violations).toEqual([]);
  });
});
