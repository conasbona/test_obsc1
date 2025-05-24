// Canvas anti-fingerprinting protection module
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file's directory for reliable path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Apply canvas fingerprinting protection directly to a page
 * @param {import('playwright').Page} page - Playwright page to protect
 * @param {Object} persona - Persona configuration
 * @param {Object} options - Protection options
 */
export async function applyCanvas(page, persona, options = {}) {
  if (!options.canvas) return;
  
  console.log('[Obscura] Applying canvas protection');
  
  // Read the original canvas.js spoofing file
  const canvasJsPath = path.resolve(__dirname, '../../spoofing/canvas.js');
  console.log(`[Obscura] Reading canvas spoofing code from: ${canvasJsPath}`);
  
  try {
    // Read the spoofing/canvas_patch.js file
    const canvasPatchPath = path.resolve(__dirname, '../../spoofing/canvas_patch.js');
    const canvasPatchScript = await fs.readFile(canvasPatchPath, 'utf-8');
    console.log(`[Obscura] Canvas patch script loaded: ${canvasPatchScript.length} bytes`);
    
    // Inject the script with persona data
    const scriptWithPersona = `window.__OBSCURA_PERSONA = ${JSON.stringify(persona || {})};
${canvasPatchScript}`;
    
    // Add the script to the page
    await page.addInitScript({ content: scriptWithPersona });
    console.log('[Obscura] Canvas patch script injected');
    
    return true;
  } catch (error) {
    console.error('[Obscura] Error injecting canvas protection:', error);
    return false;
  }
}

