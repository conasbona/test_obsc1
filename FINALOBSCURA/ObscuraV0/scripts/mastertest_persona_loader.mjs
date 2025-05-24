// mastertest_persona_loader.mjs
// Fork of mastertest.mjs using persona_proxy_loader for persona/proxy assignment

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === UA Randomizer ===
try {
  const UA_POOL_PATH = path.resolve(__dirname, '../config/user_agents.json');
  const uaStatePath = path.resolve(__dirname, '../../ua_state.json');
  const uaPool = JSON.parse(fs.readFileSync(UA_POOL_PATH, 'utf-8'));
  const randomUA = uaPool[Math.floor(Math.random() * uaPool.length)];
  fs.writeFileSync(uaStatePath, JSON.stringify({ user_agent: randomUA }, null, 2));
  const logMsg = `[${new Date().toISOString()}] UA selected: ${randomUA}\n`;
  fs.appendFileSync(path.resolve(__dirname, '../../ua_randomizer.log'), logMsg);
  console.log(`[UA Randomizer] Selected UA: ${randomUA}`);
} catch (err) {
  console.error('[UA Randomizer] Failed to select/write UA:', err);
}

import { chromium } from 'playwright';

import { spawn } from 'child_process';
import fetch from 'node-fetch';
import getPort from 'get-port';
import personaProxyLoader from '../core/persona/persona_proxy_loader.js';
import { getOxylabsProxyUrl, validateProxyConfig, PROXY_DEFAULTS } from '../core/proxy/proxy_config.js';

// === Persona/proxy assignment ===
validateProxyConfig();
const persona = personaProxyLoader.getAvailablePersona();
const { region, proxy, user_agent, persona_id, extra } = persona;
const { host = PROXY_DEFAULTS.host, port = PROXY_DEFAULTS.port, username, password } = proxy;
const oxylabsProxyUrl = getOxylabsProxyUrl({ username, password, host, port });

// === Launch behavioral noise puppet tied to this session ===
const puppetScript = path.resolve(__dirname, '../scripts/puppet_runner.js');
const puppetEnv = { ...process.env, PERSONA_ID: persona_id, PUPPETS_ON: process.env.PUPPETS_ON || '1' };
const puppet = spawn('node', [puppetScript], {
  env: puppetEnv,
  stdio: 'inherit'
});

// === Coordinate shutdown: kill puppet when main process exits ===
function shutdownPuppet() {
  if (puppet && !puppet.killed) {
    puppet.kill();
  }
}
process.on('exit', shutdownPuppet);
process.on('SIGINT', () => { shutdownPuppet(); process.exit(0); });
process.on('SIGTERM', () => { shutdownPuppet(); process.exit(0); });

console.log('[Obscura] Persona ID:', persona_id);
console.log('[Obscura] Proxy region:', region);
console.log('[Obscura] Proxy username:', username);
console.log('[Obscura] Full Oxylabs proxy URL:', oxylabsProxyUrl);

const PROTECTION_PATH = path.resolve(__dirname, '../dist/obscura.bundle.js');
const WINDOWS_FONTS_PATH = path.resolve(__dirname, '../core/persona/personas/windows_fonts.json');
const personaFonts = JSON.parse(fs.readFileSync(WINDOWS_FONTS_PATH, 'utf-8'));

const TESTS = [
  { label: 'IP Check', url: 'https://browserleaks.com/ip' },
  { label: 'Canvas', url: 'https://browserleaks.com/canvas' },
  { label: 'WebGL', url: 'https://browserleaks.com/webgl' },
  { label: 'Amiunique', url: 'https://amiunique.org/fingerprint' },
  { label: 'UserAgent', url: 'https://www.whatismybrowser.com/detect/what-is-my-user-agent/' },
  { label: 'Fingerprint.com', url: 'https://fingerprint.com/demo' },
];

const REST_PORT = 9999;

function randomUserAgent() {
  // Use persona's user_agent if present, else fallback to a random one
  if (user_agent) return user_agent;
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

let flaskProcess, mitmproxyProcess;

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

async function startMitmproxy(proxyPort, username, password) {
  mitmproxyProcess = spawn('mitmdump', [
    '-p', proxyPort,
    '--mode', `upstream:${host}:${port}`,
    '--upstream-auth', `${username}:${password}`,
    '-s', path.resolve(__dirname, '../core/ua/ua_spoof_addon.py')
  ], {
    stdio: 'inherit',
    shell: false,
  });
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
  userAgent: user_agent || 'Mozilla/5.0 (Windows TESTNT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0',
  platform: extra?.platform || 'Win32',
  language: extra?.language || 'en-US',
  languages: extra?.languages || ['en-US', 'en'],
  hardwareConcurrency: extra?.hardwareConcurrency || 8,
  vendor: '',
  vendorSub: '',
  product: 'Gecko',
  productSub: '20100101',
  deviceMemory: extra?.deviceMemory || 8
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
  let currentUA = personaNavigator.userAgent;
  await setMitmproxyUA(currentUA);

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

  await page.exposeFunction('obscuraGenerateUA', async () => {
    const newUA = randomUserAgent();
    await setMitmproxyUA(newUA);
    currentUA = newUA;
    return newUA;
  });

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

  page.on('framenavigated', async (frame) => {
    if (frame === page.mainFrame()) {
      await applyProtections(page);
    }
  });

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
  await startMitmproxy(proxyPort, username, password);

  let browser, context;
  try {
    browser = await chromium.launch({ headless: false });
    context = await browser.newContext({
      proxy: { server: `http://127.0.0.1:${proxyPort}` }
    });
    await context.addInitScript({
      content: `window.__OBSCURA_PERSONA__ = {
        fonts: ${JSON.stringify(personaFonts)},
        navigator: ${JSON.stringify(personaNavigator)},
        plugins: ${JSON.stringify(personaPlugins)},
        mimeTypes: ${JSON.stringify(personaMimeTypes)}
      };`
    });
    await context.addInitScript({ path: PROTECTION_PATH });
    for (const { label, url } of TESTS) {
      await launchTestPage(context, label, url, proxyPort);
    }
    console.log('\n[Obscura] Browser is open. Close the browser window to exit and shut down mitmproxy/flask.');
    await new Promise(resolve => {
      browser.on('disconnected', resolve);
    });
  } finally {
    if (browser) await browser.close();
    if (mitmproxyProcess) mitmproxyProcess.kill();
    if (flaskProcess) flaskProcess.kill();
    personaProxyLoader.releasePersona(persona_id);
  }
}

main();
