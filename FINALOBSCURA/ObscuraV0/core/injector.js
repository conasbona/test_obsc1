// Obscura Central Injector
// Responsible for orchestrating all spoofing modules and exposing the global API.

import { modules, registerModule } from '../spoofing/index.js';
import { DEBUG_MODE, AUTO_PATCH } from '../config/config.js';

// Persona loading/validation (stubbed for now)
function loadPersona() {
  // Load from global or config
  return window.__OBSCURA_PERSONA__ || {};
}

// Patch all modules
function patchAll(options = {}) {
  const persona = loadPersona();
  Object.entries(modules).forEach(([name, mod]) => {
    if (typeof mod.patch === 'function') {
      try {
        mod.patch(persona[name] || persona);
      } catch (e) {
        logIntegrationError(name, 'patch', e);
      }
    }
  });
}

// Unpatch all modules
function unpatchAll(options = {}) {
  Object.entries(modules).forEach(([name, mod]) => {
    if (typeof mod.unpatch === 'function') {
      try {
        mod.unpatch();
      } catch (e) {
        logIntegrationError(name, 'unpatch', e);
      }
    }
  });
}

// Get status from all modules
function getStatusAll() {
  const status = {};
  Object.entries(modules).forEach(([name, mod]) => {
    if (typeof mod.getStatus === 'function') {
      try {
        status[name] = mod.getStatus();
      } catch (e) {
        status[name] = { error: e.message };
        logIntegrationError(name, 'getStatus', e);
      }
    }
  });
  return status;
}

function logIntegrationError(module, fn, error) {
  if (DEBUG_MODE) {
    console.error(`[Obscura][Injector] Error in ${module}.${fn}:`, error);
  }
}

// Expose global API
window.obscura = {
  patch: patchAll,
  unpatch: unpatchAll,
  getStatus: getStatusAll,
  registerModule,
};

// Optionally auto-patch on load
if (AUTO_PATCH) {
  patchAll();
}
