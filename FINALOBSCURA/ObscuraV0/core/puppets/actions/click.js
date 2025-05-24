/**
 * Clicks a random clickable element on the page.
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Object} [options] - Optional parameters
 * @returns {Promise<void>}
 */
export default async function click(page, options = {}) {
  const clickable = await page.$$('a, button, [role="button"], input[type="submit"]');
  if (clickable.length === 0) return;
  const el = clickable[Math.floor(Math.random() * clickable.length)];
  await el.scrollIntoViewIfNeeded();
  await el.click({delay: Math.floor(Math.random() * 150) + 50});
  await page.waitForTimeout(Math.floor(Math.random() * 800) + 400);
}
