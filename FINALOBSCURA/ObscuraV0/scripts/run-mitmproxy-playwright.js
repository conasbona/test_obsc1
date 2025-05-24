// run-mitmproxy-playwright.js
// Helper script to launch mitmdump with dynamic UA spoofing, then Playwright test
// On every page reload, generates and sets a new UA via REST, then reloads the page

const { spawn } = require('child_process');
const fetch = require('node-fetch').default;
const path = require('path');
const { chromium } = require('playwright');

const MITMDUMP_PATH = 'mitmdump'; // Assumes mitmdump is in PATH
const ADDON_PATH = path.resolve(__dirname, '../core/ua/ua_spoof_addon.py'); // Use new addon
const getPort = require('get-port').default;
const { REST_PORT } = require('../config/config.js');
const TEST_URL = 'https://httpbin.org/headers';

let PROXY_PORT = 0; // Will be set dynamically

async function randomUserAgent() {
  return randomizeUA();
}

async function setMitmproxyUA(ua) {
  const resp = await fetch(`http://127.0.0.1:${REST_PORT}/set_ua`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ua })
  });
  if (!resp.ok) throw new Error('Failed to set UA in mitmproxy');
}

async function runPlaywrightLoop() {
  const browser = await chromium.launch({
    headless: false,
    proxy: { server: `http://127.0.0.1:${PROXY_PORT}` }
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  while (true) {
    const ua = randomUserAgent();
    await setMitmproxyUA(ua);
    await page.goto(TEST_URL);
    const headersText = await page.textContent('pre');
    console.log('\n---\nNew UA:', ua);
    console.log('HTTP headers from server:', headersText);
    const jsUA = await page.evaluate(() => navigator.userAgent);
    console.log('navigator.userAgent (JS context):', jsUA);
    // Wait 5 seconds, then reload with a new UA
    await new Promise(res => setTimeout(res, 5000));
  }
}

function startMitmdump(port) {
  return spawn(MITMDUMP_PATH, ['-s', ADDON_PATH, '-p', port], {
    stdio: 'inherit'
  });
}

async function main() {
  // Dynamically find a free port for mitmdump
  const portRange = Array.from({length: 901-800}, (_, i) => 8000 + i);
  PROXY_PORT = await getPort({ port: portRange });
  console.log(`Using mitmproxy on port: ${PROXY_PORT}`);

  // Start Flask REST API server (ua_rest_server.py)
  const flaskProcess = spawn('python', [path.resolve(__dirname, '../core/ua/ua_rest_server.py')], {
    stdio: 'inherit'
  });

  // Ensure Flask server is killed on exit
  process.on('exit', () => flaskProcess.kill());
  process.on('SIGINT', () => process.exit());
  process.on('SIGTERM', () => process.exit());

  // Wait for Flask REST API to be ready
  let flaskReady = false;
  // Robust Flask REST API readiness check
  const healthCheck = async () => {
    try {
      const resp = await fetch(`http://127.0.0.1:${REST_PORT}/get_ua`);
      console.log('[HealthCheck] Status:', resp.status);
      return resp.ok;
    } catch (e) {
      console.error('[HealthCheck] Error:', e.message);
      return false;
    }
  };
  for (let i = 0; i < 40; ++i) { // increased retries
    if (await healthCheck()) {
      flaskReady = true;
      break;
    } else {
      await new Promise(res => setTimeout(res, 1000)); // increased delay
    }
  }
  if (!flaskReady) {
    console.error('Flask REST API did not become ready. Exiting.');
    flaskProcess.kill();
    process.exit(1);
  }

  // Start mitmdump
  const mitm = startMitmdump(PROXY_PORT);

  // Run Playwright loop
  try {
    await runPlaywrightLoop();
  } finally {
    mitm.kill();
    flaskProcess.kill();
  }
}

main();
