import { getSessionSeed, createPRNG, log, logError } from './utils.js';
import { MODULE_CONFIG } from '../config/config.js';

let originalMethods = {};
let isPatched = false;
let sessionSeed = null;
let prng = null;
let config = null;

function getCanvasConfig(persona) {
  // Prefer persona.canvas config, fallback to global config
  return (persona && persona.canvas) ? persona.canvas : MODULE_CONFIG.canvas;
}

function hashCanvasContent(canvasEl, imageData) {
  // Simple hash using canvas size and some pixel data
  let entropy = `${canvasEl.width}x${canvasEl.height}`;
  if (imageData && imageData.data && imageData.data.length > 1000) {
    entropy += ':' + imageData.data[0] + imageData.data[100] + imageData.data[1000];
  }
  let hash = 2166136261;
  for (let i = 0; i < entropy.length; i++) {
    hash ^= entropy.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function applyCanvasTransform(ctx, prng) {
  try {
    // Subtle, deterministic transform per draw
    const scaleX = 1 + (prng() - 0.5) * 0.004; // ±0.2%
    const scaleY = 1 + (prng() - 0.5) * 0.004;
    const translateX = (prng() - 0.5) * 0.6; // ±0.3px
    const translateY = (prng() - 0.5) * 0.6;
    const rotate = (prng() - 0.5) * 0.004; // ±0.002 radians
    ctx.translate(translateX, translateY);
    ctx.rotate(rotate);
    ctx.scale(scaleX, scaleY);
    return true;
  } catch (e) {
    logError('canvas', e, 'applyCanvasTransform failed');
    return false;
  }
}

// Helper function for consistent error handling
function tryOrFallback(originalFn, spoofFn, context, args, operationName) {
  try {
    return spoofFn.apply(context, args);
  } catch (e) {
    logError('canvas', e, `${operationName} spoofing failed, falling back to original`);
    return originalFn.apply(context, args);
  }
}

function spoofGetImageData(originalFn, sx, sy, sw, sh) {
  try {
    const imageData = originalFn.call(this, sx, sy, sw, sh);
    
    // Safety check for imageData
    if (!imageData || !imageData.data) {
      return imageData;
    }
    
    const { data } = imageData;
    
    // Per-content PRNG: hash canvas + imageData
    const canvasEl = this.canvas || this;
    const contentHash = hashCanvasContent(canvasEl, imageData);
    const contentPRNG = createPRNG(sessionSeed ^ contentHash);
    
    // Defensive coding for config access
    const noiseStrength = (config && config.noise && config.noise.enabled) ? 
      config.noise.strength : 0;
      
    if (noiseStrength > 0) {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.max(0, Math.min(255, data[i] + Math.floor((contentPRNG() - 0.5) * 2 * 255 * noiseStrength)));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + Math.floor((contentPRNG() - 0.5) * 2 * 255 * noiseStrength)));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + Math.floor((contentPRNG() - 0.5) * 2 * 255 * noiseStrength)));
      }
    }
    return imageData;
  } catch (e) {
    logError('canvas', e, 'spoofGetImageData internal error');
    return originalFn.call(this, sx, sy, sw, sh);
  }
}

function spoofToDataURL(originalFn, type, quality) {
  try {
    const canvasEl = this;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasEl.width;
    tempCanvas.height = canvasEl.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Check if context was obtained successfully
    if (!tempCtx) {
      logError('canvas', new Error('Failed to get 2d context for temp canvas'), 'spoofToDataURL');
      return originalFn.call(this, type, quality);
    }
    
    tempCtx.save();
    if (applyCanvasTransform(tempCtx, prng)) {
      tempCtx.drawImage(canvasEl, 0, 0);
    } else {
      // If transform failed, still draw but log warning
      log('canvas', 'warn', 'Canvas transform failed, using untransformed canvas');
      tempCtx.drawImage(canvasEl, 0, 0);
    }
    tempCtx.restore();
    
    return originalFn.call(tempCanvas, type, quality);
  } catch (e) {
    logError('canvas', e, 'spoofToDataURL failed');
    return originalFn.call(this, type, quality);
  }
}

function spoofGetContext(originalFn, contextType, contextAttributes) {
  try {
    if (contextType !== '2d') {
      return originalFn.call(this, contextType, contextAttributes);
    }
    
    const ctx = originalFn.call(this, contextType, contextAttributes);
    
    // Check if context was obtained successfully
    if (!ctx) {
      logError('canvas', new Error('Failed to get 2d context'), 'spoofGetContext');
      return null;
    }
    
    if (!ctx.__obscura_processed) {
      ctx.__obscura_processed = true;
      
      // Patch getImageData method
      const origGetImageData = ctx.getImageData;
      ctx.getImageData = function(sx, sy, sw, sh) {
        return tryOrFallback(
          origGetImageData,
          function() { return spoofGetImageData.call(this, origGetImageData, sx, sy, sw, sh); },
          this,
          [sx, sy, sw, sh],
          'getImageData'
        );
      };
      
      // Patch putImageData to apply transform
      const origPutImageData = ctx.putImageData;
      ctx.putImageData = function(imageData, dx, dy, ...rest) {
        return tryOrFallback(
          origPutImageData,
          function() {
            this.save();
            applyCanvasTransform(this, prng);
            const result = origPutImageData.call(this, imageData, dx, dy, ...rest);
            this.restore();
            return result;
          },
          this,
          [imageData, dx, dy, ...rest],
          'putImageData'
        );
      };
    }
    
    return ctx;
  } catch (e) {
    logError('canvas', e, 'spoofGetContext failed');
    return originalFn.call(this, contextType, contextAttributes);
  }
}

export function patch(persona = {}) {
  if (isPatched) return;
  
  try {
    // Initialize configuration and PRNG
    config = getCanvasConfig(persona);
    sessionSeed = (persona && persona.canvas && persona.canvas.seed) || getSessionSeed();
    prng = createPRNG(sessionSeed);
    
    // Store original methods
    originalMethods.getImageData = CanvasRenderingContext2D.prototype.getImageData;
    originalMethods.toDataURL = HTMLCanvasElement.prototype.toDataURL;
    originalMethods.getContext = HTMLCanvasElement.prototype.getContext;
    
    // Patch methods with robust error handling
    CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
      try {
        return spoofGetImageData.call(this, originalMethods.getImageData, sx, sy, sw, sh);
      } catch (e) {
        logError('canvas', e, 'getImageData spoofing failed');
        return originalMethods.getImageData.call(this, sx, sy, sw, sh);
      }
    };
    
    HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
      try {
        return spoofToDataURL.call(this, originalMethods.toDataURL, type, quality);
      } catch (e) {
        logError('canvas', e, 'toDataURL spoofing failed');
        return originalMethods.toDataURL.call(this, type, quality);
      }
    };
    
    HTMLCanvasElement.prototype.getContext = function(contextType, contextAttributes) {
      try {
        return spoofGetContext.call(this, originalMethods.getContext, contextType, contextAttributes);
      } catch (e) {
        logError('canvas', e, 'getContext spoofing failed');
        return originalMethods.getContext.call(this, contextType, contextAttributes);
      }
    };
    
    // Attempt to patch existing canvases
    try {
      const existingCanvases = document.querySelectorAll('canvas');
      if (existingCanvases && existingCanvases.length) {
        log('canvas', 'info', `Attempting to patch ${existingCanvases.length} existing canvases`);
        for (let i = 0; i < existingCanvases.length; i++) {
          const canvas = existingCanvases[i];
          // Get existing context if it exists
          const existingContext = canvas.__context2d || 
                                  canvas.getContext('2d', { __internal_obscura_get: true });
          
          // If we have an existing context that's not processed, process it now
          if (existingContext && !existingContext.__obscura_processed) {
            const origGetImageData = existingContext.getImageData;
            existingContext.__obscura_processed = true;
            existingContext.getImageData = function(sx, sy, sw, sh) {
              try {
                return spoofGetImageData.call(this, origGetImageData, sx, sy, sw, sh);
              } catch (e) {
                logError('canvas', e, 'getImageData spoofing failed (existing canvas)');
                return origGetImageData.call(this, sx, sy, sw, sh);
              }
            };
          }
        }
      }
    } catch (e) {
      logError('canvas', e, 'Failed to patch existing canvases');
      // Non-fatal error, continue
    }
    
    isPatched = true;
    log('canvas', 'info', 'Canvas APIs patched');
  } catch (e) {
    logError('canvas', e, 'Failed to patch canvas APIs');
    
    // Attempt recovery
    try {
      unpatch();
    } catch (recoveryError) {
      logError('canvas', recoveryError, 'Failed to recover from patching error');
    }
    
    isPatched = false;
  }
}

export function unpatch() {
  if (!isPatched) return;
  
  try {
    CanvasRenderingContext2D.prototype.getImageData = originalMethods.getImageData;
    HTMLCanvasElement.prototype.toDataURL = originalMethods.toDataURL;
    HTMLCanvasElement.prototype.getContext = originalMethods.getContext;
    isPatched = false;
    log('canvas', 'info', 'Canvas APIs restored');
  } catch (e) {
    logError('canvas', e, 'Failed to unpatch canvas APIs');
  }
}

export function getStatus() {
  return {
    isPatched,
    sessionSeed,
    config
  };
}