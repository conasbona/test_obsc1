// core/ua/ua_randomizer.js
// Utility to select a random UA from user_agents.json and write it to ua_state.json (with logging)

import fs from 'fs';
import path from 'path';

/**
 * Randomly selects a UA from the pool and writes it to ua_state.json.
 * Logs the selection to ua_randomizer.log.
 * @param {string} baseDir - The base directory (project root) for config/log paths.
 * @returns {string} The selected User-Agent string.
 */
export function randomizeUA(baseDir = process.cwd()) {
  try {
    const uaPoolPath = path.resolve(baseDir, 'config/user_agents.json');
    const uaStatePath = path.resolve(baseDir, 'config/ua_state.json');
    const logPath = path.resolve(baseDir, 'logs/ua_randomizer.log');
    const uaPool = JSON.parse(fs.readFileSync(uaPoolPath, 'utf-8'));
    const randomUA = uaPool[Math.floor(Math.random() * uaPool.length)];
    fs.writeFileSync(uaStatePath, JSON.stringify({ user_agent: randomUA }, null, 2));
    const logMsg = `[${new Date().toISOString()}] UA selected: ${randomUA}\n`;
    fs.appendFileSync(logPath, logMsg);
    console.log(`[UA Randomizer] Selected UA: ${randomUA}`);
    return randomUA;
  } catch (err) {
    console.error('[UA Randomizer] Failed to select/write UA:', err);
    throw err;
  }
}

// If run directly (CLI), randomize UA using current working directory
if (import.meta && import.meta.url && process.argv[1] === url.fileURLToPath(import.meta.url)) {
  randomizeUA();
}
