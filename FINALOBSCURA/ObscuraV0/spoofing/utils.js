/**
 * Obscura - Core Utilities
 * Shared utilities for the Obscura anti-fingerprinting system.
 */

import {
  DEBUG_MODE,
  LOG_LEVEL,
  PERSISTENT_SEED,
  PRNG_CONFIG,
  CACHE_ENABLED,
  CACHE_TTL,
  STRICT_MODE,
} from '../config/config.js';

// =====================
// Session Seed Handling
// =====================
const SESSION_STORAGE_KEY = '__obscura_session_seed';

export function getSessionSeed() {
  if (PERSISTENT_SEED && typeof sessionStorage !== 'undefined') {
    let stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) return parseInt(stored, 10);
  }
  try {
    let entropy = '' + navigator.userAgent + navigator.language + (performance.now ? performance.now() : '') + Math.random() + Date.now();
    let hash = 2166136261;
    for (let i = 0; i < entropy.length; i++) {
      hash ^= entropy.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    let seed = hash >>> 0;
    if (PERSISTENT_SEED && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_STORAGE_KEY, seed.toString());
    }
    return seed;
  } catch (e) {
    return Math.floor(Math.random() * 4294967296);
  }
}

// =====================
// PRNG (xoshiro128**)
// =====================
export function createPRNG(seed) {
  // xoshiro128** implementation
  let s = new Uint32Array(4);
  s[0] = seed ^ 0xA3C59AC3;
  s[1] = (seed << 13) | (seed >>> 19);
  s[2] = (seed << 7) | (seed >>> 25);
  s[3] = seed ^ 0x1C69B3F5;
  function rotl(x, k) { return (x << k) | (x >>> (32 - k)); }
  return function() {
    const result = rotl(s[1] * 5, 7) * 9;
    const t = s[1] << 9;
    s[2] ^= s[0];
    s[3] ^= s[1];
    s[1] ^= s[2];
    s[0] ^= s[3];
    s[2] ^= t;
    s[3] = rotl(s[3], 11);
    return (result >>> 0) / 4294967296;
  };
}

// =====================
// Logging
// =====================
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLogLevel = LOG_LEVELS[LOG_LEVEL] ?? LOG_LEVELS.error;

export function log(module, level, message, data) {
  if (LOG_LEVELS[level] < currentLogLevel) return;
  const timestamp = new Date().toISOString().slice(11, 23);
  const prefix = `[Obscura:${module}:${level.toUpperCase()} ${timestamp}]`;
  const logFn = console[level] || console.log;
  if (data !== undefined) {
    logFn(prefix, message, data);
  } else {
    logFn(prefix, message);
  }
}

export function logError(module, error, context = '') {
  if (!DEBUG_MODE && !STRICT_MODE) return;
  const timestamp = new Date().toISOString().slice(11, 23);
  const prefix = `[Obscura:${module}:ERROR ${timestamp}]`;
  if (context) {
    console.error(prefix, context, error);
  } else {
    console.error(prefix, error);
  }
  if (STRICT_MODE) {
    throw new Error(`[Obscura] Fatal error in ${module}: ${error.message || error}`);
  }
}

// =====================
// Caching
// =====================
const cache = new Map();

export function withCache(key, fn, ttl = CACHE_TTL) {
  if (!CACHE_ENABLED) return fn();
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && (now - cached.time) < ttl) {
    return cached.value;
  }
  const value = fn();
  cache.set(key, { value, time: now });
  return value;
}

export { cache };
