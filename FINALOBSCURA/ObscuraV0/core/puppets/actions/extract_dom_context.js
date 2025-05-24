// extract_dom_context.js
// Extract visible links, search/text inputs, and page title/snippet from a Playwright page
// Returns a structured JS object for LLM context

/**
 * Extracts visible links, search/text inputs, and page title/snippet from the page.
 * @param {import('playwright').Page} page
 * @returns {Promise<{links: Array<{text: string, url: string, selector: string}>, searchInputs: Array<{selector: string}>, title: string, snippet: string}>}
 */
export async function extractDOMContext(page) {
  // Evaluate in browser context for best DOM access
  return await page.evaluate(() => {
    // Helper to get unique CSS selector for an element
    function getUniqueSelector(el) {
      if (!el) return '';
      if (el.id) return `#${el.id}`;
      let path = [];
      while (el && el.nodeType === 1 && el.tagName.toLowerCase() !== 'html') {
        let selector = el.tagName.toLowerCase();
        if (el.className) selector += '.' + Array.from(el.classList).join('.');
        path.unshift(selector);
        el = el.parentElement;
      }
      return path.length ? path.join(' > ') : '';
    }

    // Extract visible links (top 15, unique, non-empty)
    const seenUrls = new Set();
    const links = Array.from(document.querySelectorAll('a[href]'))
      .filter(a => a.offsetParent !== null && a.offsetWidth > 0 && a.offsetHeight > 0)
      .map(a => ({
        text: a.innerText.trim().slice(0, 128),
        url: a.href
      }))
      .filter(link => link.text && !seenUrls.has(link.url) && seenUrls.add(link.url))
      .slice(0, 15);

    // Extract visible search/text inputs
    const searchInputs = Array.from(document.querySelectorAll('input[type="search"], input[type="text"]'))
      .filter(inp => inp.offsetParent !== null && inp.offsetWidth > 0 && inp.offsetHeight > 0)
      .map(inp => ({
        selector: getUniqueSelector(inp)
      }));

    // Page title and snippet
    const title = document.title || '';
    const snippet = document.body ? document.body.innerText.trim().slice(0, 700) : '';

    return { links, searchInputs, title, snippet };
  });
}
