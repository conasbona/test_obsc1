// WebGL anti-fingerprinting protection module
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file's directory for reliable path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Apply WebGL fingerprinting protection directly to a page
 * @param {import('playwright').Page} page - Playwright page to protect
 * @param {Object} persona - Persona configuration
 * @param {Object} options - Protection options
 */
export async function applyWebGL(page, persona, options = {}) {
  if (!options.webgl) return;
  
  console.log('[Obscura] Applying WebGL protection');
  
  // Read the original webgl.js spoofing file
  const webglJsPath = path.resolve(__dirname, '../../spoofing/webgl.js');
  
  try {
    // Read the self-contained spoofing/webgl_patch.js file
    const webglPatchPath = path.resolve(__dirname, '../../spoofing/webgl_patch.js');
    const webglPatchScript = await fs.readFile(webglPatchPath, 'utf-8');
    // Inject the script with persona data
    const scriptWithPersona = `window.__OBSCURA_PERSONA = ${JSON.stringify(persona || {})};\n${webglPatchScript}`;
    await page.addInitScript({ content: scriptWithPersona });
    console.log('[Obscura] WebGL patch script injected (IIFE)');
    return true;
  } catch (error) {
    console.error('[Obscura] Error injecting WebGL protection:', error);
    return false;
  }
}
