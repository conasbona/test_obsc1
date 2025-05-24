// Plugins spoofing protection module
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file's directory for reliable path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Apply plugins fingerprinting protection directly to a page
 * @param {import('playwright').Page} page - Playwright page to protect
 * @param {Object} persona - Persona configuration
 * @param {Object} options - Protection options
 */
export async function applyPlugins(page, persona = {}, options = {}) {
  if (!options.plugins) return;
  
  console.log('[Obscura] Applying plugins protection');
  
  try {
    // Create a plugins patch script
    const pluginsPatchScript = `
    (function() {
      console.log('[Obscura] Plugins patch script injected');
      
      // Override navigator.plugins and navigator.mimeTypes
      if (navigator.plugins) {
        // Create empty plugins array-like object
        const emptyPlugins = {
          length: 0,
          item: function() { return null; },
          namedItem: function() { return null; },
          refresh: function() {}
        };
        
        // Override plugins
        Object.defineProperty(navigator, 'plugins', {
          get: function() { return emptyPlugins; },
          configurable: true
        });
        
        // Override mimeTypes
        if (navigator.mimeTypes) {
          const emptyMimeTypes = {
            length: 0,
            item: function() { return null; },
            namedItem: function() { return null; }
          };
          
          Object.defineProperty(navigator, 'mimeTypes', {
            get: function() { return emptyMimeTypes; },
            configurable: true
          });
        }
        
        console.log('[Obscura] Plugins and mimeTypes spoofed');
      }
    })();
    `;
    
    // Inject the script with persona data
    const scriptWithPersona = `window.__OBSCURA_PERSONA = ${JSON.stringify(persona || {})};
${pluginsPatchScript}`;
    
    // Add the script to the page
    await page.addInitScript({ content: scriptWithPersona });
    console.log('[Obscura] Plugins patch script injected');
    
    return true;
  } catch (error) {
    console.error('[Obscura] Error injecting plugins protection:', error);
    return false;
  }
}
