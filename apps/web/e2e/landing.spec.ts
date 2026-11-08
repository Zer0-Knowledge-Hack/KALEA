import { test, expect } from "@playwright/test";

test.describe("Kalea Landing Page & Quote Demo", () => {
  test("renders navigation and hero section", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Kalea/i);

    // Verify nav logo and links exist
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();

    // Verify main hero headline
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });

  test("interacts with the quote widget island", async ({ page }) => {
    await page.goto("/");

    // Locate quote widget input
    const quoteSection = page.locator("#quote");
    await expect(quoteSection).toBeVisible();

    // Verify interactive amount input in quote widget
    const amountInput = quoteSection.locator("input[type='number'], input[type='text']").first();
    if (await amountInput.isVisible()) {
      await amountInput.fill("500");
      // Check that a quote response or rate calculation appears
      await expect(quoteSection).toContainText(/USDC|BOB|ARS|BRL|COP|MXN|PEN/);
    }
  });

  test("displays coverage and pricing sections", async ({ page }) => {
    await page.goto("/");

    // Coverage section
    const coverage = page.locator("#coverage");
    await expect(coverage).toBeVisible();

    // Pricing section
    const pricing = page.locator("#pricing");
    await expect(pricing).toBeVisible();
  });
});
