/**
 * Behavioral noise puppet runner
 * Launches a browser with a persona and generates human-like browsing noise.
 *
 * Usage: node puppet_runner.js <personaIndex>
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import personaProxyLoader from '../persona/persona_proxy_loader.js';
import { SessionLogger } from '../logging.js';
import { runPuppets } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadPersona(index = 0) {
  const personas = JSON.parse(await fs.readFile(path.resolve(__dirname, '../config/persona_proxy_pool.json'), 'utf-8'));
  const personaId = process.env.PERSONA_ID;
  if (personaId) {
    return personas.find(p => p.persona_id === personaId) || personas[0];
  }
  return personas[index] || personas[0];
}

async function loadWhitelist() {
  return JSON.parse(await fs.readFile(path.resolve(__dirname, '../config/site_whitelist.json'), 'utf-8'));
}

/**
 * Main puppet runner entry point
 */
async function run() {
  // Configurable parameters
  // TEST MODE: Speed up dwell and action times for faster testing
  const NUM_URLS = 5; // number of URLs per session
  const ACTIONS_PER_PAGE = 4; // number of action cycles per page
  const DWELL_MIN = 500; // ms (0.5s)
  const DWELL_MAX = 1500; // ms (1.5s)

  const sessionId = `${Date.now()}_${Math.floor(Math.random()*1000)}`;
  const logger = new SessionLogger(sessionId);
  const personaIndex = Number(process.argv[2] || 0);
  const persona = await loadPersona(personaIndex);
  const plannerType = (process.env.PLANNER_TYPE && process.env.PLANNER_TYPE.trim()) ? process.env.PLANNER_TYPE : (persona.planner || 'random');
  const whitelist = await loadWhitelist();

  // Pick N random URLs from whitelist
  const shuffled = [...whitelist].sort(() => Math.random() - 0.5);
  const urls = shuffled.slice(0, Math.min(NUM_URLS, whitelist.length));

  // === Protection Toggles from ENV ===
  const canvasSpoof = process.env.CANVAS_SPOOF === '1';
  const webglSpoof = process.env.WEBGL_SPOOF === '1';
  const navPluginsSpoof = process.env.NAV_PLUGINS_SPOOF === '1';
  const uaSpoof = process.env.UA_SPOOF === '1';
  const proxySpoof = process.env.PROXY_SPOOF === '1';
  const puppetsOn = process.env.PUPPETS_ON === '1';
  const headless = process.env.HEADLESS !== 'false';

  // Launch browser with persona proxy settings
  const browser = await chromium.launch({
    headless,
    proxy: proxySpoof && persona.proxy ? {
      server: `${persona.proxy.host}:${persona.proxy.port}`,
      username: persona.proxy.username,
      password: persona.proxy.password
    } : undefined
  });

  // User-Agent spoofing (toggle)
  const context = await browser.newContext({
    userAgent: uaSpoof ? persona.user_agent : undefined,
    timezoneId: persona.extra?.timezone || 'UTC',
  });
  const page = await context.newPage();

  // Canvas/WebGL spoofing (toggle)
  if (canvasSpoof) {
    try {
      const canvasScript = await fs.readFile(path.resolve(__dirname, '../spoofing/canvas.js'), 'utf-8');
      await page.addInitScript({ content: canvasScript });
    } catch (e) {
      console.warn('[puppet_runner] Failed to inject canvas spoofing:', e.message);
    }
  }
  if (webglSpoof) {
    try {
      const webglScript = await fs.readFile(path.resolve(__dirname, '../spoofing/webgl.js'), 'utf-8');
      await page.addInitScript({ content: webglScript });
    } catch (e) {
      console.warn('[puppet_runner] Failed to inject webgl spoofing:', e.message);
    }
  }

  // navigator.plugins spoofing (toggle)
  if (navPluginsSpoof) {
    try {
      const pluginsScript = await fs.readFile(path.resolve(__dirname, '../spoofing/utils.js'), 'utf-8');
      await page.addInitScript({ content: pluginsScript });
    } catch (e) {
      console.warn('[puppet_runner] Failed to inject plugins spoofing:', e.message);
    }
  }

  // Inject CSS for font spoofing (stub)
  if (persona.extra?.fonts && persona.extra.fonts.length > 0) {
    await page.addStyleTag({
      content: `body, * { font-family: ${persona.extra.fonts.map(f => `'${f}'`).join(', ')}, sans-serif !important; }`
    });
  }

  // Puppets (behavioral noise bots) toggle
  if (!puppetsOn) {
    console.log('[puppet_runner] Puppets OFF: Exiting before behavioral noise loop.');
    await browser.close();
    return;
  }

  // Log session start
  logger.log({
    type: 'session_start',
    persona_id: persona.persona_id,
    user_agent: persona.user_agent,
    proxy: persona.proxy,
    timezone: persona.extra?.timezone,
    fonts: persona.extra?.fonts,
    urls,
    plannerType
  });

  try {
    // --- Refactored main behavioral loop using runPuppets ---
    let context = {
      currentUrl: 'about:blank',
      persona,
      history: []
    };

    // Force initial navigation to the first allowed site
    await page.goto(urls[0], { waitUntil: 'domcontentloaded' });
    context.currentUrl = urls[0];
    context.history.push({ type: 'visit', params: { url: urls[0] } });
    console.log('[puppet_runner] Forced initial navigation to:', urls[0]);
    console.log('[puppet_runner] Browser page URL after nav:', await page.url());

    // Log the selected planner type
    console.log("Selected plannerType:", plannerType);

    // Use modular puppets runner
    await runPuppets(page, {
      persona,
      siteWhitelist: urls,
      actionsPerPage: ACTIONS_PER_PAGE,
      logger,
      actionContext: context,
      plannerType,
      maxNavDepth: 4 // or make this configurable if desired
    });
    // --- End refactored loop ---
  } catch (err) {
    logger.log({ type: 'fatal_error', error: err.message, stack: err.stack });
  }

  // Log session end
  logger.log({ type: 'session_end' });
  await logger.flush();
  await browser.close();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch(err => {
    console.error('Puppet runner error:', err);
    process.exit(1);
  });
}
