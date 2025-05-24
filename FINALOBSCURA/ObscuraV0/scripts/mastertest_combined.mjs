// mastertest_combined.mjs
// Unified script: supports both persona-based and default proxy-based test runs
// Usage: node mastertest_combined.mjs [--mode=persona|default]
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fetch from 'node-fetch';
import getPort from 'get-port';
import personaProxyLoader from '../core/persona/persona_proxy_loader.js';
import { getRandomRegion, getUniqueSessionId } from '../config/proxy_session.js';
import { getOxylabsProxyUrl, validateProxyConfig, PROXY_DEFAULTS } from '../core/proxy/proxy_config.js';
import { applyProtections } from '../core/protections/protection_manager.js';
// import { loadConfig } from '../core/configLoader.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { getConfig, configEvents } = require('../core/liveConfig.cjs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Force persona mode ===
const mode = 'persona';
console.log(`[Obscura] Running in mode: persona (forced)`);
validateProxyConfig();

// === UA Randomizer (shared) ===
function randomUserAgent(personaUA) {
  if (personaUA) return personaUA;
  const UA_POOL_PATH = path.resolve(__dirname, '../config/user_agents.json');
  try {
    const uaPool = JSON.parse(fs.readFileSync(UA_POOL_PATH, 'utf-8'));
    return uaPool[Math.floor(Math.random() * uaPool.length)];
  } catch (err) {
    console.error('[UA Randomizer] Failed to load pool, using fallback:', err);
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0';
  }
}

// === Proxy/persona assignment ===
// All persona/proxy assignment is now handled by personaProxyLoader core API
let persona;
if (mode === 'persona') {
  persona = personaProxyLoader.getAvailablePersona();
  if (!persona) {
    throw new Error('No persona available from personaProxyLoader!');
  }
  // All downstream logic (proxyHost, proxyPort, etc.) should use persona fields directly
} else {
  // Fallback for non-persona mode (legacy, not used in current flow)
  persona = null;
}

// Logging using persona values, if desired
if (persona) {
  const proxy = persona.proxy || {};
  console.log('[Obscura] Persona ID:', persona.persona_id);
  console.log('[Obscura] Proxy host:', proxy.host || PROXY_DEFAULTS.host);
  console.log('[Obscura] Proxy port:', proxy.port || PROXY_DEFAULTS.port);
  console.log('[Obscura] Proxy username:', proxy.username || process.env.OXYLABS_USERNAME);
} else {
  console.log('[Obscura] No persona selected.');
}

// === Puppets integration (behavioral noise, persona mode only) ===
import { runPuppets } from '../core/puppets/index.js';

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

// === Always load puppet browsing sites from config/site_whitelist.json to avoid interfering with user experience ===
const puppetsWhitelist = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../config/site_whitelist.json'), 'utf-8'));
console.log('[Obscura] Puppets will browse only these sites:', puppetsWhitelist);

let puppetsOptions = {
  persona,
  siteWhitelist: puppetsWhitelist,
  actionsPerPage: Infinity, // or set a limit if desired
  logger: console,
  // You can add more options here if needed
};
if (!Array.isArray(puppetsOptions.siteWhitelist) || puppetsOptions.siteWhitelist.length === 0) {
  throw new Error('Puppets site whitelist is empty or not loaded!');
}
console.log('[Obscura] Puppets behavioral noise will ALWAYS run for this session (forced on, using config/site_whitelist.json).');

// === Flask/mitmdump process management (placeholder, should use process_manager.js) ===
// ... (Add integration with process_manager.js as needed)

// === Main test runner ===
// === Launch puppet browsers in parallel for behavioral noise ===
// Live puppets controller for runtime start/stop
let puppetsController = null;

function startPuppets() {
  console.log('[DEBUG] startPuppets called. Controller:', puppetsController);
  if (puppetsController && !puppetsController.stopped) {
    console.log('[Obscura] Puppets already running.');
    return;
  }
  puppetsController = { stopped: false };
  (async () => {
    // Randomly select a persona/proxy for this puppet
    let puppetPersona;
    try {
      puppetPersona = personaProxyLoader.getAvailablePersona();
    } catch (e) {
      console.error('[Obscura] [PUPPET] No available persona for puppet:', e);
      return;
    }
    const puppetProxyHost = puppetPersona.proxy?.host || PROXY_DEFAULTS.host;
    const puppetProxyPort = puppetPersona.proxy?.port || PROXY_DEFAULTS.port;
    const puppetProxyUsername = puppetPersona.proxy?.username || process.env.OXYLABS_USERNAME;
    const puppetProxyPassword = puppetPersona.proxy?.password || process.env.OXYLABS_PASSWORD;
    const puppetUserAgent = puppetPersona.user_agent || randomUserAgent();
    const { launchSession, closeSession } = await import('../core/session/session_utils.js');
    const config = getConfig();
    const headless = !!config.protectionToggles.headless;
    console.log('[DEBUG] Launching puppets with headless:', headless);
    const { browser, context, page } = await launchSession({
      proxy: {
        server: `http://${puppetProxyHost}:${puppetProxyPort}`,
        username: puppetProxyUsername,
        password: puppetProxyPassword,
      },
      userAgent: puppetUserAgent,
      headless,
    });
    try {
      for (const url of puppetsOptions.siteWhitelist) {
        if (puppetsController.stopped) break;
        await page.goto(url);
        console.log(`[Obscura] [PUPPET] Visiting: ${url} | persona_id: ${puppetPersona.persona_id} | proxy: ${puppetProxyUsername}@${puppetProxyHost}:${puppetProxyPort}`);
        await runPuppets(page, { ...puppetsOptions, persona: puppetPersona, siteWhitelist: [url], shouldContinue: () => !puppetsController.stopped });
      }
    } finally {
      await closeSession({ browser });
      personaProxyLoader.releasePersona(puppetPersona.persona_id);
      puppetsController.stopped = true;
      console.log('[Obscura] Puppets stopped.');
    }
  })();
}

function stopPuppets() {
  console.log('[DEBUG] stopPuppets called. Controller:', puppetsController);
  if (puppetsController && !puppetsController.stopped) {
    puppetsController.stopped = true;
    console.log('[Obscura] Stopping puppets...');
  } else {
    console.log('[Obscura] Puppets are not running.');
  }
}

// === Register configEvents handler at top-level for live puppets toggling ===
let openPages = [];
let lastHeadless = getConfig().protectionToggles.headless;
configEvents.on('change', (newConfig) => {
  console.log('[mastertest_combined] Detected config change, re-applying protections to all open pages...');
  console.log('[DEBUG] Config change event:', newConfig.protectionToggles);
  for (const page of openPages) {
    applyProtections(page, {
      ...newConfig.protectionToggles,
      personaFonts,
      persona: persona || {},
      bundlePath: path.resolve(__dirname, '../dist/obscura.bundle.js'),
    });
    console.log('[mastertest_combined] Protections re-applied to page');
  }
  // Live toggle puppets
  const newHeadless = newConfig.protectionToggles.headless;
  if (newConfig.protectionToggles.puppets) {
    if (puppetsController && !puppetsController.stopped && newHeadless !== lastHeadless) {
      console.log('[DEBUG] Headless mode changed. Restarting puppets with new headless value:', newHeadless);
      stopPuppets();
      // Wait a moment for puppets to stop, then restart
      setTimeout(() => {
        startPuppets();
      }, 1000);
    } else {
      console.log('[DEBUG] Attempting to start puppets...');
      startPuppets();
    }
  } else {
    console.log('[DEBUG] Attempting to stop puppets...');
    stopPuppets();
  }
  lastHeadless = newHeadless;
});

async function main() {
  // Start puppet browsers in parallel if enabled in config
  if (getConfig().protectionToggles.puppets) {
    startPuppets();
  } else {
    console.log('[Obscura] Puppets are disabled in config, not launching puppet browsers.');
  }

  // Example: launch Playwright browser with selected proxy and persona
  const proxy = persona?.proxy || {};
  const userAgent = persona?.user_agent || randomUserAgent();
  const browser = await chromium.launch({ headless: false });
  const contextOptions = {
    proxy: {
      server: `http://${proxy.host || PROXY_DEFAULTS.host}:${proxy.port || PROXY_DEFAULTS.port}`,
      username: proxy.username || process.env.OXYLABS_USERNAME,
      password: proxy.password || process.env.OXYLABS_PASSWORD,
    },
    userAgent
  };
  const context = await browser.newContext(contextOptions);

  // === Main test loop: protections applied per page ===
  // Always get the latest config before each test (live reload)
  // Track open pages for live re-application of protections
  openPages = [];
  for (const test of TESTS) {
    const config = getConfig();
    console.log('[mastertest_combined] Using config:', config.protectionToggles);
    const page = await context.newPage();
    openPages.push(page);
    await applyProtections(page, {
      ...config.protectionToggles, // Use unified toggles from config.json (LIVE)
      personaFonts,
      persona: persona || {},
      bundlePath: path.resolve(__dirname, '../dist/obscura.bundle.js'),
    });
    // Protections are now handled by applyProtections
    console.log(`[Obscura] Running test: ${test.label} (${test.url})`);
    await page.goto(test.url);
    // Optionally: collect results, screenshots, etc.
  }

  // Keep browser open for manual inspection
  await new Promise(resolve => setTimeout(resolve, 60000));
  await browser.close();
}

main().catch(err => {
  console.error('[Obscura] Error in main:', err);
  process.exit(1);
});
