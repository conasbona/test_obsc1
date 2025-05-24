// tests/liveConfig.test.js - Test for liveConfig.js
const fs = require('fs');
const path = require('path');
const { getConfig } = require('../core/liveConfig.cjs');

const CONFIG_PATH = path.resolve(__dirname, '../config/config.json');

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function testLiveReload() {
  console.log('Initial config:', getConfig().protectionToggles);
  // Backup current config
  const original = fs.readFileSync(CONFIG_PATH, 'utf-8');
  try {
    // Change a toggle
    const config = JSON.parse(original);
    config.protectionToggles.canvas = !config.protectionToggles.canvas;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    await delay(300); // Wait for debounce and reload
    const newConfig = getConfig();
    console.log('Updated config:', newConfig.protectionToggles);
    if (newConfig.protectionToggles.canvas !== JSON.parse(original).protectionToggles.canvas) {
      console.log('PASS: live reload detected config change.');
    } else {
      console.error('FAIL: live reload did not detect config change.');
    }
  } finally {
    // Restore original config
    fs.writeFileSync(CONFIG_PATH, original);
    await delay(300);
  }
}

testLiveReload();
