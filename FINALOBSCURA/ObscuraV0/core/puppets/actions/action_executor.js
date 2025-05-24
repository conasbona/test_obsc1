/**
 * Action Executor: Executes a given Action on the provided Playwright page.
 *
 * @param {Action} action
 * @param {import('playwright').Page} page
 * @returns {Promise<void>}
 */
const BANNED_KEYWORDS = [
  'login', 'signin', 'signup', 'register', 'cart', 'checkout', 'pay', 'purchase',
  'form', 'input', 'email', 'password', 'address', 'order', 'billing', 'credit', 'card', 'subscribe'
];
const ALLOWED_ACTIONS = [
  {
    type: 'visit',
    params: ['url']
  },
  {
    type: 'scroll',
    params: ['direction', 'amount']
  },
  {
    type: 'click',
    params: ['selector']
  },
  {
    type: 'dwell',
    params: ['duration']
  },
  {
    type: 'search',
    params: ['query']
  },
  {
    type: 'type',
    params: ['selector', 'text']
  },
  {
    type: 'follow_link',
    params: ['selector', 'url']
  }
];

function isBanned(str) {
  if (!str) return false;
  return BANNED_KEYWORDS.some(keyword => str.toLowerCase().includes(keyword));
}

function validateAction(action) {
  if (!action || typeof action !== 'object') return false;
  const { type, params } = action;
  if (!type || typeof type !== 'string' || !params || typeof params !== 'object') return false;
  if (!ALLOWED_ACTIONS.some(a => a.type === type)) return false;
  switch (type) {
    case 'visit':
      if (typeof params.url !== 'string') return false;
      if (isBanned(params.url)) return false;
      break;
    case 'scroll':
      if (!['down', 'up'].includes(params.direction)) return false;
      if (typeof params.amount !== 'number' || params.amount < 100 || params.amount > 1500) return false;
      break;
    case 'click':
      if (typeof params.selector !== 'string') return false;
      if (isBanned(params.selector)) return false;
      break;
    case 'dwell':
      if (typeof params.duration !== 'number' || params.duration < 500 || params.duration > 5000) return false;
      break;
    case 'search':
      // Query must be a non-empty string and not contain banned keywords
      if (typeof params.query !== 'string' || !params.query.trim()) return false;
      if (isBanned(params.query)) return false;
      break;
    case 'type':
      // Selector and text must be non-empty strings, text must not contain banned keywords
      if (typeof params.selector !== 'string' || !params.selector.trim()) return false;
      if (typeof params.text !== 'string' || !params.text.trim()) return false;
      if (isBanned(params.text)) return false;
      break;
    case 'follow_link':
      // Selector must be a string, url must be a string, and not banned
      if (typeof params.selector !== 'string' || !params.selector.trim()) return false;
      if (typeof params.url !== 'string') return false;
      if (isBanned(params.url)) return false;
      break;
    default:
      return false;
  }
  return true;
}

/**
 * Action Executor: Executes a given Action on the provided Playwright page.
 * Enforces allowlist and banned keyword rules for safety.
 *
 * @param {Action} action
 * @param {import('playwright').Page} page
 * @param {object} logger - Logger for rejected actions
 * @param {Array<string>} siteWhitelist - Allowed URLs for 'visit' actions
 * @returns {Promise<void>}
 */
// Action Executor: Executes a given Action on the provided Playwright page.
// Enforces only banned keyword rules for safety.
//
// @param {Action} action
// @param {import('playwright').Page} page
// @param {object} logger - Logger for rejected actions
// @returns {Promise<void>}
async function executeAction(action, page, logger = null) {
  if (!validateAction(action)) {
    if (logger && typeof logger.log === 'function') {
      logger.log({
        type: 'rejected_by_executor',
        reason: 'invalid_or_unsafe_action',
        action
      });
    }
    return;
  }
  switch (action.type) {
    case 'visit': {
      if (action.params.url) {
        await page.goto(action.params.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      }
      break;
    }
    case 'search': {
      // Locate search input and submit query
      const { query } = action.params;
      // Try to find a visible input[type="search"] or input[type="text"]
      const input = await page.$('input[type="search"]:visible, input[type="text"]:visible');
      if (input) {
        await input.click({ clickCount: 3 });
        await input.fill('');
        await page.waitForTimeout(100 + Math.random() * 200);
        for (const char of query) {
          await input.type(char, { delay: 60 + Math.random() * 90 });
        }
        await input.press('Enter');
      } else {
        if (logger && typeof logger.log === 'function') {
          logger.log({ type: 'search_input_not_found', action });
        }
      }
      break;
    }
    case 'type': {
      // Type text into an input field
      const { selector, text } = action.params;
      const input = await page.$(selector);
      if (input) {
        await input.click({ clickCount: 3 });
        await input.fill('');
        await page.waitForTimeout(100 + Math.random() * 200);
        for (const char of text) {
          await input.type(char, { delay: 60 + Math.random() * 90 });
        }
      } else {
        if (logger && typeof logger.log === 'function') {
          logger.log({ type: 'type_input_not_found', action });
        }
      }
      break;
    }
    case 'follow_link': {
      // Click a link if allowed
      const { selector, url } = action.params;
      // Confirm the link exists and matches the intended URL
      const link = await page.$(selector);
      if (link) {
        const href = await link.getAttribute('href');
        if (href && href.includes(url)) {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
            link.click()
          ]);
        } else {
          if (logger && typeof logger.log === 'function') {
            logger.log({ type: 'follow_link_href_mismatch', action, foundHref: href });
          }
        }
      } else {
        if (logger && typeof logger.log === 'function') {
          logger.log({ type: 'follow_link_not_found', action });
        }
      }
      break;
    }
    case 'scroll': {
      const { direction = 'down', amount = 400 } = action.params;
      await page.evaluate(({ direction, amount }) => {
        window.scrollBy({
          top: direction === 'down' ? amount : -amount,
          left: 0,
          behavior: 'smooth'
        });
      }, { direction, amount });
      break;
    }
    case 'click': {
      const selector = action.params.selector || 'body';
      try {
        await page.click(selector, { timeout: 2000 });
      } catch (e) {
        // Ignore click errors for now
      }
      break;
    }
    case 'dwell': {
      const duration = action.params.duration || 1000;
      await page.waitForTimeout(duration);
      break;
    }
    default:
      // Unknown action, just wait a bit
      await page.waitForTimeout(500);
  }
}

export { executeAction };

