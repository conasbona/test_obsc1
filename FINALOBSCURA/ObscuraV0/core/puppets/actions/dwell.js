/**
 * Waits for a random period to simulate human idleness (dwell).
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Object} [options] - Optional parameters
 * @returns {Promise<void>}
 */
export default async function dwell(page, options = {}) {
  const ms = Math.floor(Math.random() * 2000) + 1000;
  await page.waitForTimeout(ms);
}
