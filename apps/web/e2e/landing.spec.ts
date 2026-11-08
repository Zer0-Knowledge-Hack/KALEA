import { test, expect } from "@playwright/test";

test.describe("Kalea Landing Page & Quote Demo", () => {
  test("renders navigation and hero section", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Kalea/i);

    // Verify nav and main sections
    await expect(page.locator("nav")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
  });

  test("interacts with the quote widget island and computes live rate", async ({ page }) => {
    await page.goto("/");

    // Locate quote section and ensure it is scrolled into viewport to trigger hydration
    const quoteSection = page.locator("#quote");
    await expect(quoteSection).toBeVisible();
    await quoteSection.scrollIntoViewIfNeeded();

    // Verify amount input renders and is interactive
    const amountInput = page.getByTestId("quote-amount-input");
    await expect(amountInput).toBeVisible();

    // Fill with valid amount
    await amountInput.fill("500");

    // Computed output must not be empty or placeholder "—"
    const usdcOutput = page.getByTestId("quote-usdc-amount");
    await expect(usdcOutput).toBeVisible();
    await expect(usdcOutput).not.toHaveText("—");
    await expect(usdcOutput).not.toHaveText("");

    // Assert rate row displays a valid 1 USDC = X conversion
    const rateRow = quoteSection.locator("dl dd").first();
    await expect(rateRow).toContainText("1 USDC =");
  });

  test("displays coverage, developers and pricing sections", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("#coverage")).toBeVisible();
    await expect(page.locator("#developers")).toBeVisible();
    await expect(page.locator("#pricing")).toBeVisible();
  });
});
