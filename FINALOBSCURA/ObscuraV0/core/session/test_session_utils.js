// test_session_utils.js
// Minimal test for launchSession and closeSession utilities

import { launchSession, closeSession } from './session_utils.js';

(async () => {
  try {
    console.log('Launching session...');
    // You can adjust proxy/userAgent as needed for further testing
    const { browser, context, page } = await launchSession({
      headless: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    await page.goto('https://example.com');
    console.log('Visited example.com');
    await closeSession({ browser });
    console.log('Session closed successfully.');
  } catch (err) {
    console.error('Session test failed:', err);
  }
})();
