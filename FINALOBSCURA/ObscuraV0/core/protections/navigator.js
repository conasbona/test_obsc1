// Navigator spoofing protection module
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file's directory for reliable path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Apply navigator fingerprinting protection directly to a page
 * @param {import('playwright').Page} page - Playwright page to protect
 * @param {Object} persona - Persona configuration
 * @param {Object} options - Protection options
 */
export async function applyNavigator(page, persona, options = {}) {
  if (!options.navigator) return;
  
  console.log('[Obscura] Applying navigator protection');
  
  try {
    // Create a navigator patch script
    const navigatorPatchScript = `
    (function() {
      
      // Get persona from global variable
      const persona = window.__OBSCURA_PERSONA || {};
      
      // Store original properties and methods
      const originalProps = {};
      
      // Helper to safely override a property
      function overrideProperty(obj, prop, value) {
        try {
          // Store original if not already stored
          if (!(prop in originalProps) && obj[prop] !== undefined) {
            originalProps[prop] = obj[prop];
          }
          
          // Override the property
          Object.defineProperty(obj, prop, {
            get: function() { return value; },
            configurable: true
          });
        } catch (e) {
          console.error('[Obscura] Failed to override ' + prop + ':', e);
        }
      }
      
      // Override navigator properties
      if (persona.navigator) {
        // Override platform
        if (persona.navigator.platform) {
          overrideProperty(navigator, 'platform', persona.navigator.platform);
        }
        
        // Override hardware concurrency
        if (persona.navigator.hardwareConcurrency) {
          overrideProperty(navigator, 'hardwareConcurrency', persona.navigator.hardwareConcurrency);
        }
        
        // Override language
        if (persona.navigator.language) {
          overrideProperty(navigator, 'language', persona.navigator.language);
        }
      } else {
        // Default overrides if no persona-specific values
        // Randomize hardware concurrency between 2 and 8
        const cores = 2 + Math.floor(Math.random() * 7);
        overrideProperty(navigator, 'hardwareConcurrency', cores);
      }
      
      // Override navigator.mediaDevices.enumerateDevices
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices;
        navigator.mediaDevices.enumerateDevices = async function() {
          const devices = await originalEnumerateDevices.call(navigator.mediaDevices);
          // Return a limited subset with generic labels
          return devices.map(device => {
            return {
              deviceId: device.deviceId,
              kind: device.kind,
              groupId: 'default',
              label: ''
            };
          });
        };
      }
      
      console.log('[Obscura] Navigator properties patched');
    })();
    `;
    
    // Inject the script with persona data
    const scriptWithPersona = `window.__OBSCURA_PERSONA = ${JSON.stringify(persona || {})};
${navigatorPatchScript}`;
    
    // Add the script to the page
    await page.addInitScript({ content: scriptWithPersona });
    console.log('[Obscura] Navigator patch script injected');
    
    return true;
  } catch (error) {
    console.error('[Obscura] Error injecting navigator protection:', error);
    return false;
  }
}
