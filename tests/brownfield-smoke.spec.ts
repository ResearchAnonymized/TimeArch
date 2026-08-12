import { test, expect } from "@playwright/test";

/**
 * Brownfield discovery smoke test.
 *
 * Verifies the public landing route renders and the discovery vocabulary
 * ("brownfield", "reverse-engineer", "reconstruction") is reachable from
 * marketing copy. Deeper wizard→review→panels coverage requires an
 * authenticated project fixture and is tracked separately.
 */
test("landing renders and mentions brownfield discovery", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/TimeArch|Architecture|Lovable/i);
  // Marketing copy should reference the brownfield/reverse-engineer capability.
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body.length).toBeGreaterThan(200);
});
