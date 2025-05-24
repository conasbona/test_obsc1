// protection_manager.js
// Centralized manager for applying all browser fingerprinting protections
import { standardizeOptions } from './index.js';
import { applyCanvas } from './canvas.js';
import { applyWebGL } from './webgl.js';
import { applyFonts } from './fonts.js';
import { applyNavigator } from './navigator.js';
import { applyPlugins } from './plugins.js';

/**
 * Apply all enabled protections to a Playwright page.
 * @param {import('playwright').Page} page
 * @param {Object} options - { canvas: bool, webgl: bool, fonts: bool, navigator: bool, plugins: bool, personaFonts: Array, persona: Object }
 */
export async function applyProtections(page, options = {}) {
  // Standardize option names for backward compatibility
  const standardizedOptions = standardizeOptions(options);
  
  const {
    canvas: canvasEnabled = true,
    webgl: webglEnabled = true,
    fonts: fontsEnabled = true,
    navigator: navigatorEnabled = true,
    plugins: pluginsEnabled = true,
    personaFonts = [],
    persona = {},
  } = standardizedOptions;
  
  console.log('[Obscura] Applying protections to page');
  
  // Apply each protection directly using page.evaluate()
  if (canvasEnabled) {
    await applyCanvas(page, persona, standardizedOptions);
  }
  
  if (webglEnabled) {
    await applyWebGL(page, persona, standardizedOptions);
  }
  
  if (fontsEnabled) {
    await applyFonts(page, personaFonts, persona, standardizedOptions);
  }
  
  if (navigatorEnabled) {
    await applyNavigator(page, persona, standardizedOptions);
  }
  
  if (pluginsEnabled) {
    await applyPlugins(page, persona, standardizedOptions);
  }
  
  // Add a trivial test script to verify browser execution
  await page.evaluate(() => {
    console.log('***OBSCURA PROTECTIONS APPLIED***');
  });
}
