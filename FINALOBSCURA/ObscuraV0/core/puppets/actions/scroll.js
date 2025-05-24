/**
 * Scrolls the page by a random amount and direction.
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Object} [options] - Optional parameters
 * @returns {Promise<void>}
 */
export default async function scroll(page, options = {}) {
  const direction = Math.random() > 0.5 ? 1 : -1;
  const distance = Math.floor(Math.random() * 400) + 100;
  await page.evaluate(({direction, distance}) => {
    window.scrollBy({
      top: direction * distance,
      left: 0,
      behavior: 'smooth'
    });
  }, {direction, distance});
  await page.waitForTimeout(Math.floor(Math.random() * 800) + 400);
}
