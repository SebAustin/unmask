import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const colorScheme of ["light", "dark"] as const) {
  test(`no serious accessibility violations with a verdict on screen (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/");
    await page.getByRole("button", { name: /Boss needs gift cards/ }).click();
    await expect(page.locator("#verdict-heading")).toBeVisible();
    await page.getByText("I paid with gift cards").click();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
  });
}

test("no horizontal overflow at 320px, even with a very long link", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  const longUrl = `https://secure-chase-verify.top/${"a1b2c3d4".repeat(40)}`;
  await page.getByLabel("Paste the suspicious message").fill(`Your Chase account is locked. Verify at ${longUrl} now`);
  await page.getByRole("button", { name: "Check this message" }).click();
  await expect(page.locator("#verdict-heading")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
