/**
 * Obscura - Anti-Fingerprinting Configuration
 * Centralized configuration for the Obscura spoofing system.
 */

// Debug and Logging
export const DEBUG_MODE = false; // Enable detailed logging
export const LOG_LEVEL = DEBUG_MODE ? 'debug' : 'error'; // 'debug' | 'info' | 'warn' | 'error'

// Core Behavior
export const AUTO_PATCH = true; // Automatically patch fingerprinting surfaces on load
export const STRICT_MODE = false; // Throw errors on spoofing failures instead of falling back to native
export const PERSISTENT_SEED = true; // Use a consistent seed across page reloads (stored in sessionStorage)

// Performance
export const CACHE_ENABLED = true; // Enable caching for expensive operations
export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

// Default Persona (can be overridden by passing a persona to patch())
export const DEFAULT_PERSONA = {
  // Will be merged with the selected persona from /personas/
  // This allows for runtime overrides of specific fields
};

// PRNG Configuration
export const PRNG_CONFIG = {
  algorithm: 'xoshiro128**', // PRNG algorithm to use
  seed: null, // Auto-generated if null
};

// Module-Specific Configurations
export const MODULE_CONFIG = {
  canvas: {
    enabled: true,
    noise: {
      enabled: true,
      strength: 0.02, // Noise strength (0-1)
    },
  },
  webgl: {
    enabled: true,
    failIfNotSupported: false,
  },
  fonts: {
    enabled: true,
    extendNative: false, // Extend rather than replace system fonts
  },
  navigator: {
    enabled: true,
    spoofUserAgent: true,
    spoofPlatform: true,
    spoofLanguage: true,
  },
  plugins: {
    enabled: true,
    // List of plugins to expose (empty = use defaults)
    plugins: [],
  },
};

