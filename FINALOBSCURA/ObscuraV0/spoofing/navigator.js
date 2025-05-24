let originalDescriptors = {};
let isPatched = false;
let spoofedProps = [
  'userAgent', 'platform', 'product', 'productSub', 'vendor', 'vendorSub',
  'hardwareConcurrency', 'language', 'languages', 'deviceMemory'
];

function getPersonaNavigator(persona) {
  // Defensive: fallback to empty object if persona/navigator missing
  if (persona && persona.navigator) return persona.navigator;
  if (window.__OBSCURA_PERSONA__ && window.__OBSCURA_PERSONA__.navigator)
    return window.__OBSCURA_PERSONA__.navigator;
  return {};
}

export function patch(personaSubtree) {
  if (isPatched) return;
  const navPersona = getPersonaNavigator(personaSubtree);
  const nav = window.navigator;
  spoofedProps.forEach(prop => {
    if (navPersona[prop] !== undefined) {
      try {
        // Save original descriptor
        if (!originalDescriptors[prop]) {
          const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, prop) ||
                       Object.getOwnPropertyDescriptor(nav, prop);
          if (desc) originalDescriptors[prop] = desc;
        }
        Object.defineProperty(nav, prop, {
          get() { return navPersona[prop]; },
          configurable: true,
          enumerable: false
        });
      } catch (e) {
        // Some props may not be patchable in all browsers
      }
    }
  });
  // Patch languages array for stealth
  if (navPersona.languages) {
    try {
      Object.defineProperty(nav, 'languages', {
        get() { return navPersona.languages; },
        configurable: true,
        enumerable: false
      });
    } catch (e) {}
  }
  isPatched = true;
}

export function unpatch() {
  if (!isPatched) return;
  const nav = window.navigator;
  Object.entries(originalDescriptors).forEach(([prop, desc]) => {
    try {
      Object.defineProperty(nav, prop, desc);
    } catch (e) {}
  });
  originalDescriptors = {};
  isPatched = false;
}

export function getStatus() {
  return {
    isPatched,
    spoofedProps: Object.keys(originalDescriptors)
  };
}
