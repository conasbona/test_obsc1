// core/liveConfig.js - Live config loader with file watching and debounced reload
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const configEvents = new EventEmitter();

const CONFIG_PATH = path.resolve(__dirname, '../config/config.json');

let config = {};
let reloadTimeout = null;

function loadConfigSync() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    config = JSON.parse(raw);
    console.log('[LiveConfig] Initial config loaded.');
  } catch (err) {
    console.error('[LiveConfig] Failed to load config:', err);
    config = {};
  }
}

function reloadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    config = JSON.parse(raw);
    console.log('[LiveConfig] Reloaded config:', config.protectionToggles);
    configEvents.emit('change', config);
  } catch (err) {
    console.error('[LiveConfig] Failed to reload config:', err);
  }
}

// Initial load
loadConfigSync();
console.log('[LiveConfig] Watching config at:', CONFIG_PATH);

// Watch for changes with debounce
fs.watch(CONFIG_PATH, (eventType) => {
  if (eventType === 'change') {
    if (reloadTimeout) clearTimeout(reloadTimeout);
    reloadTimeout = setTimeout(reloadConfig, 150);
  }
});

function getConfig() {
  return config;
}

module.exports = { getConfig, configEvents };
