// Fonts spoofing protection module
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file's directory for reliable path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Apply font fingerprinting protection directly to a page
 * @param {import('playwright').Page} page - Playwright page to protect
 * @param {Array} personaFonts - Array of fonts to use for this persona
 * @param {Object} persona - Persona configuration
 * @param {Object} options - Protection options
 */
export async function applyFonts(page, personaFonts = [], persona = {}, options = {}) {
  console.log('[Obscura] Fonts protection called with options:', JSON.stringify(options));
  
  if (!options.fonts) {
    console.log('[Obscura] Fonts protection disabled, skipping');
    return;
  }
  
  console.log('[Obscura] Applying fonts protection directly');
  
  try {
    // Get fonts from persona if available, otherwise use personaFonts parameter
    const fonts = persona.extra?.fonts?.length ? persona.extra.fonts : personaFonts;
    
    if (fonts && fonts.length) {
      // Create a fonts patch script
      const fontsPatchScript = `
      (function() {
        console.log('[Obscura] Fonts patch script injected');
        
        // Override font enumeration API if available
        if (window.queryLocalFonts) {
          const originalQueryLocalFonts = window.queryLocalFonts;
          window.queryLocalFonts = async function() {
            // Return a limited set of common fonts
            return [
              { family: 'Arial' },
              { family: 'Times New Roman' },
              { family: 'Courier New' },
              { family: 'Verdana' },
              { family: 'Georgia' }
            ];
          };
          console.log('[Obscura] Font enumeration API patched');
        }
      })();
      `;
      
      // Inject the script with persona data
      const scriptWithPersona = `window.__OBSCURA_PERSONA = ${JSON.stringify(persona || {})};
${fontsPatchScript}`;
      
      // Add the script to the page
      await page.addInitScript({ content: scriptWithPersona });
      console.log('[Obscura] Fonts patch script injected');
      
      // Add a style tag to override fonts - this needs to be done after page load
      await page.addInitScript({
        content: `
        (function() {
          // Add a style tag to override fonts
          const style = document.createElement('style');
          style.textContent = "body, * { font-family: ${fonts.map(f => `'${f}'`).join(', ')}, sans-serif !important; }";
          document.head.appendChild(style);
          console.log('[Obscura] Font style override applied');
        })();
        `
      });
      
      return true;
    }
  } catch (error) {
    console.error('[Obscura] Error injecting fonts protection:', error);
    return false;
  }
}
