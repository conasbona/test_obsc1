// Obscura Spoofing Module Registry
// This file exports all spoofing modules for unified loading and management.

import * as canvas from './canvas.js';
import * as webgl from '../../obscura/spoofing/webgl.js';
import * as fonts from './fonts.js';
import * as navigator from './navigator.js';
import * as plugins from './plugins.js';

export const modules = {
  canvas,
  webgl,
  fonts,
  navigator,
  plugins
};

// For extensibility: allow dynamic registration of custom modules
export function registerModule(name, mod) {
  modules[name] = mod;
}
