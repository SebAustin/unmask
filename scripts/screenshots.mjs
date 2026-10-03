// Captures README/Devpost screenshots. Usage: AI_MOCK=1 pnpm start -p 3300 & node scripts/screenshots.mjs
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3300";
const OUT = "docs/screenshots";
const browser = await chromium.launch();

async function shot(name, { width, height, scheme = "light", sample, recovery = false, fullPage = false }) {
  const page = await browser.newPage({ viewport: { width, height }, colorScheme: scheme, deviceScaleFactor: 2 });
  await page.goto(BASE);
  if (sample) {
    await page.getByRole("button", { name: sample }).click();
    await page.locator("#verdict-heading").waitFor();
    await page.waitForTimeout(900);
    await page.locator("#verdict-heading").scrollIntoViewIfNeeded();
  }
  if (recovery) {
    await page.goto(`${BASE}/#help`);
    await page.getByText("I paid with gift cards").click();
    await page.waitForTimeout(600);
    await page.locator("#recovery-heading").scrollIntoViewIfNeeded();
  }
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  await page.close();
}

await shot("home", { width: 1440, height: 900 });
await shot("verdict-scam", { width: 1440, height: 1000, sample: /Boss needs gift cards/ });
await shot("verdict-scam-dark", { width: 1440, height: 1000, scheme: "dark", sample: /Spoofed PayPal email/ });
await shot("verdict-safe", { width: 1440, height: 900, sample: /Real 2FA code/ });
await shot("verdict-mobile", { width: 390, height: 844, sample: /Missed delivery fee/ });
await shot("recovery", { width: 1440, height: 900, recovery: true });
await browser.close();
console.log("screenshots written to", OUT);
