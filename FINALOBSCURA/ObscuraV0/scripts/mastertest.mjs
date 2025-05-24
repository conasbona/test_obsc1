// test-fingerprint-all-protections.js
// Comprehensive test: launches separate browser instances for all major fingerprinting test sites
// Applies ALL anti-fingerprinting protections found in obscura/test/*

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import fetch from 'node-fetch';
import getPort from 'get-port';
import { fileURLToPath } from 'url';
import personaProxyLoader from '../core/persona/persona_proxy_loader.js';
import proxySession from '../config/proxy_session.js';
import { getOxylabsProxyUrl, validateProxyConfig, PROXY_DEFAULTS } from '../core/proxy/proxy_config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Proxy session setup ===
validateProxyConfig();
const region = proxySession.getRandomRegion();
const sessionId = proxySession.getUniqueSessionId();
const proxyUsername = `${process.env.OXYLABS_USERNAME}-cc-${region}-session-${sessionId}`;
const oxylabsProxyUrl = getOxylabsProxyUrl({ username: proxyUsername });

console.log('[Obscura] Proxy region:', region);
console.log('[Obscura] Proxy session ID:', sessionId);
console.log('[Obscura] Proxy username:', proxyUsername);
console.log('[Obscura] Full Oxylabs proxy URL:', oxylabsProxyUrl);
console.log('[Obscura] mitmdump upstream host:', PROXY_DEFAULTS.upstreamHost);
console.log('[Obscura] mitmdump upstream-auth:', `${proxyUsername}:${process.env.OXYLABS_PASSWORD}`);

const PROTECTION_PATH = path.resolve(__dirname, '../dist/obscura.bundle.js');
const WINDOWS_FONTS_PATH = path.resolve(__dirname, '../core/persona/personas/windows_fonts.json');
const personaFonts = JSON.parse(fs.readFileSync(WINDOWS_FONTS_PATH, 'utf-8'));

const TESTS = [
  { label: 'IP Check', url: 'https://browserleaks.com/ip' },
  { label: 'Canvas', url: 'https://browserleaks.com/canvas' },
  { label: 'WebGL', url: 'https://browserleaks.com/webgl' },
  { label: 'Amiunique', url: 'https://amiunique.org/fingerprint' },
  { label: 'Fingerprint.com', url: 'https://fingerprint.com/demo' },
];

const REST_PORT = 9999;
let flaskProcess, mitmproxyProcess;

function randomUserAgent() {
  const chromeMajor = Math.floor(Math.random() * 20) + 100;
  const safariMajor = Math.floor(Math.random() * 4) + 14;
  const iosVersion = `${Math.floor(Math.random() * 4) + 14}_${Math.floor(Math.random() * 3)}`;
  const macver = `${Math.floor(Math.random() * 6) + 10}_${Math.floor(Math.random() * 4)}`;
  const rv = Math.floor(Math.random() * 40) + 80;
  const androidVersion = `${Math.floor(Math.random() * 6) + 8}`;

  const templates = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:{rv}) Gecko/20100101 Firefox/{rv}.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X {macver}; rv:{rv}) Gecko/20100101 Firefox/{rv}.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:{rv}) Gecko/20100101 Firefox/{rv}.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chrome}.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X {macver}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chrome}.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chrome}.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X {macver}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/{safari}.0 Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS {ios} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/{safari}.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chrome}.0.0.0 Safari/537.36 Edg/{chrome}.0.0.0',
    'Mozilla/5.0 (Linux; Android {android}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chrome}.0.0.0 Mobile Safari/537.36',
  ];

  const tpl = templates[Math.floor(Math.random() * templates.length)];
  return tpl
    .replace(/{rv}/g, rv)
    .replace(/{chrome}/g, chromeMajor)
    .replace(/{safari}/g, safariMajor)
    .replace(/{ios}/g, iosVersion)
    .replace(/{macver}/g, macver)
    .replace(/{android}/g, androidVersion);
}

async function startFlask() {
  flaskProcess = spawn('python', [path.resolve(__dirname, '../core/ua/ua_rest_server.py')], {
    stdio: 'inherit',
    shell: false,
  });
  // Wait for Flask REST API to be ready
  for (let i = 0; i < 40; ++i) {
    try {
      const resp = await fetch(`http://127.0.0.1:${REST_PORT}/get_ua`);
      if (resp.ok) return;
    } catch (e) {}
    await new Promise(res => setTimeout(res, 500));
  }
  throw new Error('Flask REST API did not become ready');
}

async function startMitmproxy(proxyPort, proxyUsername, proxyPassword) {
  // Launch mitmdump with Oxylabs as upstream proxy using --upstream-auth
  mitmproxyProcess = spawn('mitmdump', [
    '-p', proxyPort,
    '--mode', 'upstream:pr.oxylabs.io:7777',
    '--upstream-auth', `${proxyUsername}:${proxyPassword}`,
    '-s', path.resolve(__dirname, '../core/ua/ua_spoof_addon.py')
  ], {
    stdio: 'inherit',
    shell: false,
  });
  // Wait for mitmproxy to be ready
  await new Promise(res => setTimeout(res, 2500));
}

async function setMitmproxyUA(ua) {
  await fetch(`http://127.0.0.1:${REST_PORT}/set_ua`, {
    method: 'POST',
    body: JSON.stringify({ ua }),
    headers: { 'Content-Type': 'application/json' }
  });
}

// Persona (fonts, navigator, plugins, mimeTypes) for all pages
const personaNavigator = {
  userAgent: 'Mozilla/5.0 (Windows TESTNT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0',
  platform: 'Win32',
  language: 'en-US',
  languages: ['en-US', 'en'],
  hardwareConcurrency: 8,
  vendor: '',
  vendorSub: '',
  product: 'Gecko',
  productSub: '20100101',
  deviceMemory: 8
};
const personaPlugins = [
  { name: 'PDF Viewer', description: 'Portable Document Format', filename: 'internal-pdf-viewer' },
  { name: 'Chrome PDF Viewer', description: 'Portable Document Format', filename: 'internal-pdf-viewer' }
];
const personaMimeTypes = [
  { type: 'application/pdf', description: 'PDF', suffixes: 'pdf', enabledPlugin: null }
];

async function launchTestPage(context, label, url, proxyPort) {
  const page = await context.newPage();
  let currentUA = randomUserAgent();
  await setMitmproxyUA(currentUA);

  // Helper to (re)inject all persona and protections
  async function applyProtections(page) {
    await page.addInitScript({
      content: `window.__OBSCURA_PERSONA__ = {
        fonts: ${JSON.stringify(personaFonts)},
        navigator: ${JSON.stringify(personaNavigator)},
        plugins: ${JSON.stringify(personaPlugins)},
        mimeTypes: ${JSON.stringify(personaMimeTypes)}
      };`
    });
    await page.addInitScript({ path: PROTECTION_PATH });
  }

  await applyProtections(page);
  await page.goto(url, { waitUntil: 'networkidle' });

  // Expose a function to the page so it can request a new UA
  await page.exposeFunction('obscuraGenerateUA', async () => {
    const newUA = randomUserAgent();
    await setMitmproxyUA(newUA);
    currentUA = newUA;
    return newUA;
  });

  // Inject a floating "Switch UA" button into the page
  await page.evaluate(() => {
    if (!window.__OBSCURA_UA_BUTTON__) {
      const btn = document.createElement('button');
      btn.textContent = 'Switch UA';
      btn.style.position = 'fixed';
      btn.style.bottom = '10px';
      btn.style.right = '10px';
      btn.style.zIndex = 10001;
      btn.style.background = '#007bff';
      btn.style.color = '#fff';
      btn.style.border = 'none';
      btn.style.padding = '10px 18px';
      btn.style.borderRadius = '5px';
      btn.style.fontSize = '16px';
      btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
      btn.style.cursor = 'pointer';
      btn.onclick = async () => {
        btn.disabled = true;
        btn.textContent = 'Switching UA...';
        const newUA = await window.obscuraGenerateUA();
        btn.textContent = 'Reloading...';
        setTimeout(() => { location.reload(); }, 400);
      };
      document.body.appendChild(btn);
      window.__OBSCURA_UA_BUTTON__ = true;
    }
  });

  // Re-inject protections on every navigation (refresh, SPA, etc.)
  page.on('framenavigated', async (frame) => {
    if (frame === page.mainFrame()) {
      await applyProtections(page);
    }
  });

  // Label the page visually
  await page.evaluate(({ label, ua }) => {
    let banner = document.createElement('div');
    banner.textContent = label + ' | UA: ' + ua;
    banner.style.position = 'fixed';
    banner.style.top = '0';
    banner.style.left = '0';
    banner.style.width = '100%';
    banner.style.background = '#222';
    banner.style.color = '#fff';
    banner.style.zIndex = 10000;
    banner.style.fontSize = '18px';
    banner.style.padding = '6px 0';
    banner.style.textAlign = 'center';
    document.body.appendChild(banner);
  }, { label, ua: currentUA });
  console.log(`\n---\n[${label}] UA:`, currentUA);
}


async function main() {
  const portRange = Array.from({length: 1001}, (_, i) => 8000 + i);
  const proxyPort = await getPort({ port: portRange });
  await startFlask();
  await startMitmproxy(proxyPort, proxyUsername, proxyPassword);

  let browser, context;
  try {
    browser = await chromium.launch({ headless: false });
    context = await browser.newContext({
      proxy: { server: `http://127.0.0.1:${proxyPort}` }
    });

    // Inject persona/protections at context level for all pages
    await context.addInitScript({
      content: `window.__OBSCURA_PERSONA__ = {
        fonts: ${JSON.stringify(personaFonts)},
        navigator: ${JSON.stringify(personaNavigator)},
        plugins: ${JSON.stringify(personaPlugins)},
        mimeTypes: ${JSON.stringify(personaMimeTypes)}
      };`
    });
    await context.addInitScript({ path: PROTECTION_PATH });

    // Launch all test pages in the same browser/context
    for (const { label, url } of TESTS) {
      await launchTestPage(context, label, url, proxyPort);
    }

    // Keep browser open for manual reloads/testing
    console.log('\n[Obscura] Browser is open. Close the browser window to exit and shut down mitmproxy/flask.');
    // Keep the process alive until the browser is closed
    await new Promise(resolve => {
      browser.on('disconnected', resolve);
    });
  } finally {
    // Only kill mitmproxy/flask after browser closes
    if (browser) await browser.close();
    if (mitmproxyProcess) mitmproxyProcess.kill();
    if (flaskProcess) flaskProcess.kill();
  }
}

main();
