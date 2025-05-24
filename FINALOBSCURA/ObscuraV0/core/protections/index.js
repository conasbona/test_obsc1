// Protections middleware aggregator
// Central utilities for protection modules

/**
 * Standardize protection option names (for backward compatibility)
 * @param {Object} options - Original options object
 * @returns {Object} - Options with standardized property names
 */
export function standardizeOptions(options = {}) {
  return {
    ...options,
    canvas: options.canvas ?? options.canvasSpoof,
    webgl: options.webgl ?? options.webglSpoof,
    fonts: options.fonts ?? options.fontsSpoof,
    navigator: options.navigator ?? options.navigatorSpoof,
    plugins: options.plugins ?? options.pluginsSpoof,
  };
}

// No longer needed as we're using direct page.evaluate() instead of script injection
