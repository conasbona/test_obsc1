let originalPlugins = null;
let originalMimeTypes = null;
let isPatched = false;

function getPersonaPlugins(persona) {
  // Defensive: fallback to empty array if persona/plugins missing
  if (persona && persona.plugins) return persona.plugins;
  if (window.__OBSCURA_PERSONA__ && window.__OBSCURA_PERSONA__.plugins)
    return window.__OBSCURA_PERSONA__.plugins;
  return [];
}

function getPersonaMimeTypes(persona) {
  if (persona && persona.mimeTypes) return persona.mimeTypes;
  if (window.__OBSCURA_PERSONA__ && window.__OBSCURA_PERSONA__.mimeTypes)
    return window.__OBSCURA_PERSONA__.mimeTypes;
  return [];
}

function createFakePluginArray(plugins) {
  function FakePlugin(name, desc, filename) {
    this.name = name;
    this.description = desc;
    this.filename = filename;
  }
  function FakePluginArray(items) {
    items.forEach((p, i) => { this[i] = p; });
    this.length = items.length;
    this.item = function(i) { return this[i]; };
    this.namedItem = function(name) { return items.find(p => p.name === name) || null; };
  }
  FakePluginArray.prototype = Object.create(Array.prototype);
  return new FakePluginArray(plugins.map(p => new FakePlugin(p.name, p.description, p.filename)));
}

function createFakeMimeTypeArray(mimeTypes) {
  function FakeMimeType(type, desc, suffixes, enabledPlugin) {
    this.type = type;
    this.description = desc;
    this.suffixes = suffixes || '';
    this.enabledPlugin = enabledPlugin || null;
  }
  function FakeMimeTypeArray(items) {
    items.forEach((m, i) => { this[i] = m; });
    this.length = items.length;
    this.item = function(i) { return this[i]; };
    this.namedItem = function(type) { return items.find(m => m.type === type) || null; };
  }
  FakeMimeTypeArray.prototype = Object.create(Array.prototype);
  return new FakeMimeTypeArray(mimeTypes.map(m => new FakeMimeType(m.type, m.description, m.suffixes, m.enabledPlugin)));
}

export function patch(personaSubtree) {
  if (isPatched) return;
  const plugins = getPersonaPlugins(personaSubtree);
  const mimeTypes = getPersonaMimeTypes(personaSubtree);
  // Patch navigator.plugins
  try {
    originalPlugins = Object.getOwnPropertyDescriptor(Navigator.prototype, 'plugins') ||
                     Object.getOwnPropertyDescriptor(window.navigator, 'plugins');
    Object.defineProperty(window.navigator, 'plugins', {
      get() { return createFakePluginArray(plugins); },
      configurable: true,
      enumerable: false
    });
  } catch (e) {}
  // Patch navigator.mimeTypes
  try {
    originalMimeTypes = Object.getOwnPropertyDescriptor(Navigator.prototype, 'mimeTypes') ||
                        Object.getOwnPropertyDescriptor(window.navigator, 'mimeTypes');
    Object.defineProperty(window.navigator, 'mimeTypes', {
      get() { return createFakeMimeTypeArray(mimeTypes); },
      configurable: true,
      enumerable: false
    });
  } catch (e) {}
  isPatched = true;
}

export function unpatch() {
  if (!isPatched) return;
  // Restore plugins
  if (originalPlugins) {
    try {
      Object.defineProperty(window.navigator, 'plugins', originalPlugins);
    } catch (e) {}
    originalPlugins = null;
  }
  // Restore mimeTypes
  if (originalMimeTypes) {
    try {
      Object.defineProperty(window.navigator, 'mimeTypes', originalMimeTypes);
    } catch (e) {}
    originalMimeTypes = null;
  }
  isPatched = false;
}

export function getStatus() {
  return {
    isPatched,
    pluginsSpoofed: !!originalPlugins,
    mimeTypesSpoofed: !!originalMimeTypes
  };
}
