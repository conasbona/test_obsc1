import { chromium } from 'playwright';
import { extractDOMContext } from '../core/actions/extract_dom_context.js';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://www.reddit.com', { waitUntil: 'domcontentloaded' });
  const domContext = await extractDOMContext(page);
  console.log(JSON.stringify(domContext, null, 2));
  await browser.close();
})();