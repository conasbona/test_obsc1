// proxy_config.js
// Centralized proxy configuration loader for ObscuraV0
// Loads non-sensitive defaults from config, sensitive info from environment variables

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default proxy config (non-sensitive)
export const PROXY_DEFAULTS = {
  host: 'pr.oxylabs.io',
  port: 7777,
  upstreamHost: 'proxy.pr.oxylabs.io:7777',
  // Add more defaults as needed
};

// Load sensitive info from environment variables
export const OXYLABS_USERNAME = process.env.OXYLABS_USERNAME || '';
export const OXYLABS_PASSWORD = process.env.OXYLABS_PASSWORD || '';

/**
 * Get the full Oxylabs proxy URL (http://username:password@host:port)
 */
export function getOxylabsProxyUrl({
  username = OXYLABS_USERNAME,
  password = OXYLABS_PASSWORD,
  host = PROXY_DEFAULTS.host,
  port = PROXY_DEFAULTS.port,
} = {}) {
  if (!username || !password) {
    throw new Error('Missing Oxylabs proxy credentials. Set OXYLABS_USERNAME and OXYLABS_PASSWORD in your environment.');
  }
  return `http://${username}:${password}@${host}:${port}`;
}

/**
 * Validate that all required proxy config is present
 */
export function validateProxyConfig() {
  if (!OXYLABS_USERNAME || !OXYLABS_PASSWORD) {
    throw new Error('Missing Oxylabs proxy credentials. Set OXYLABS_USERNAME and OXYLABS_PASSWORD in your environment.');
  }
}
