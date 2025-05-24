/**
 * Moves the mouse to a random position on the page.
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Object} [options] - Optional parameters
 * @returns {Promise<void>}
 */
export default async function mouse(page, options = {}) {
  const viewport = page.viewportSize() || {width: 1280, height: 720};
  const x = Math.floor(Math.random() * viewport.width);
  const y = Math.floor(Math.random() * viewport.height);
  await page.mouse.move(x, y, {steps: Math.floor(Math.random() * 10) + 5});
  await page.waitForTimeout(Math.floor(Math.random() * 600) + 300);
}
