// session_utils.js
// Utilities for launching browsers, applying protections, and managing session lifecycle.
// Extracted from scripts for modularization and reuse.

import { chromium } from 'playwright';
import { applyProtections } from '../protections/protection_manager.js';
import getPort from 'get-port';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generic session launcher for Playwright. Does not inject protections by default.
 * @param {Object} options - { proxy, userAgent, headless }
 * @returns {Promise<{browser, context, page}>}
 */
export async function launchSession({ proxy, userAgent, headless = true } = {}) {
  const browser = await chromium.launch({ headless });
  const contextOptions = {};
  if (proxy) {
    contextOptions.proxy = proxy;
  }
  if (userAgent) {
    contextOptions.userAgent = userAgent;
  }
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  return { browser, context, page };
}

/**
 * Cleanly closes a browser session.
 * @param {Object} session - { browser }
 */
export async function closeSession({ browser }) {
  if (browser) await browser.close();
}

/**
 * Launch a browser with the given persona and protections.
 * @param {object} options - { persona, proxy, protections, testUrls, ... }
 * @returns {Promise<{browser, context, pages}>}
 */
export async function launchBrowserWithProtections(options = {}) {
  const { persona, proxy, protections = {}, testUrls = [] } = options;
  const browser = await chromium.launch({ headless: false });
  const contextOptions = proxy ? { proxy: { server: proxy } } : {};
  const context = await browser.newContext(contextOptions);
  if (persona || protections) {
    await applyProtections(context, null, persona, protections);
  }
  // Optionally open test pages
  const pages = [];
  for (const url of testUrls) {
    const page = await context.newPage();
    await page.goto(url);
    pages.push(page);
  }
  return { browser, context, pages };
}

/**
 * Helper to load persona data from a given path.
 */
export async function loadPersona(personaPath, index = 0) {
  const personas = JSON.parse(await fs.readFile(personaPath, 'utf-8'));
  return personas[index] || personas[0];
}

// Add more utilities as needed for session/test orchestration.
