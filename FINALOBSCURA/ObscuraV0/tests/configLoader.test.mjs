// tests/configLoader.test.mjs
import { loadConfig } from '../core/configLoader.js';

const REQUIRED_TOGGLES = [
  'canvas', 'webgl', 'fonts', 'navigator', 'plugins', 'proxy', 'userAgent', 'puppets', 'headless'
];

(async () => {
  try {
    const config = await loadConfig();
    console.log('Loaded config:', JSON.stringify(config, null, 2));
    if (config.protectionToggles) {
      console.log('Protection toggles:', config.protectionToggles);
      const missing = REQUIRED_TOGGLES.filter(k => !(k in config.protectionToggles));
      if (missing.length) {
        console.warn('Warning: Missing toggles:', missing);
        process.exit(1);
      } else {
        console.log('All required toggles are present.');
        process.exit(0);
      }
    } else {
      console.error('protectionToggles not found in config!');
      process.exit(1);
    }
  } catch (err) {
    console.error('Failed to load config:', err);
    process.exit(1);
  }
})();
