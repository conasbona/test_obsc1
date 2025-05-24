// canvas_patch.js - Browser-injectable canvas anti-fingerprinting patch
(function() {
  console.log('[Obscura] Canvas patch script injected');
  
  // Use persona config if present
  const persona = window.__OBSCURA_PERSONA || {};
  
  // Module state
  let originalMethods = {};
  let isPatched = false;
  let sessionSeed = null;
  let prng = null;
  
  // PRNG implementation for consistent randomization
  function createPRNG(seed) {
    let s = seed || Math.random() * 1000000;
    return function() {
      s = Math.sin(s) * 10000;
      return s - Math.floor(s);
    };
  }
  
  function getSessionSeed() {
    return Math.floor(Math.random() * 1000000000);
  }
  
  function log(module, message) {
    console.log(`[Obscura] [${module}] ${message}`);
  }
  
  function logError(module, error, message) {
    console.error(`[Obscura] [${module}] ${message}:`, error);
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
  
  function applyCanvasTransform(ctx) {
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
      return false;
    }
  }
  
  // Helper function for consistent error handling
  function tryOrFallback(originalFn, spoofFn, context, args, operationName) {
    try {
      return spoofFn.apply(context, args);
    } catch (e) {
      logError('canvas', e, `${operationName} spoofing failed`);
      return originalFn.apply(context, args);
    }
  }
  
  function spoofGetImageData(originalFn, sx, sy, sw, sh) {
    // Get original image data
    const imageData = originalFn.call(this, sx, sy, sw, sh);
    
    // Apply subtle noise to the image data
    if (imageData && imageData.data) {
      const canvasEl = this.canvas;
      const contentHash = hashCanvasContent(canvasEl, imageData);
      const localPrng = createPRNG(contentHash + sessionSeed);
      
      // Apply very subtle noise to a small subset of pixels
      const data = imageData.data;
      const len = data.length;
      const noiseStrength = 1; // Very subtle, just 1 value difference
      
      // Only modify ~5% of pixels for minimal visual impact
      const pixelsToModify = Math.floor(len / 80);
      
      for (let i = 0; i < pixelsToModify; i++) {
        // Pick a random pixel
        const idx = Math.floor(localPrng() * (len - 4));
        // Ensure it's aligned to a pixel boundary (4 bytes per pixel)
        const pixelIdx = idx - (idx % 4);
        
        // Apply tiny noise to RGB (not alpha)
        for (let j = 0; j < 3; j++) {
          const noise = Math.floor(localPrng() * 3) - 1; // -1, 0, or 1
          data[pixelIdx + j] = Math.max(0, Math.min(255, data[pixelIdx + j] + noise * noiseStrength));
        }
      }
    }
    
    return imageData;
  }
  
  function spoofToDataURL(originalFn, type, quality) {
    const canvasEl = this;
    const ctx = canvasEl.getContext('2d');
    
    if (ctx) {
      // Save the current transformation matrix
      ctx.save();
      
      // Apply a subtle transformation based on the canvas content
      const contentHash = hashCanvasContent(canvasEl);
      const localPrng = createPRNG(contentHash + sessionSeed);
      
      // Apply very subtle transform
      const scaleX = 1 + (localPrng() - 0.5) * 0.002; // ±0.1%
      const scaleY = 1 + (localPrng() - 0.5) * 0.002;
      const translateX = (localPrng() - 0.5) * 0.4; // ±0.2px
      const translateY = (localPrng() - 0.5) * 0.4;
      const rotate = (localPrng() - 0.5) * 0.002; // ±0.001 radians
      
      ctx.translate(translateX, translateY);
      ctx.rotate(rotate);
      ctx.scale(scaleX, scaleY);
      
      // Draw a transparent pixel to apply the transform
      ctx.fillStyle = 'rgba(0,0,0,0.01)';
      ctx.fillRect(0, 0, 1, 1);
      
      // Restore the original transformation matrix
      ctx.restore();
    }
    
    // Call the original method
    return originalFn.call(this, type, quality);
  }
  
  function spoofGetContext(originalFn, contextType, contextAttributes) {
    // Get the original context
    const ctx = originalFn.call(this, contextType, contextAttributes);
    
    // Only patch 2D contexts
    if (contextType === '2d' && ctx && !ctx.__obscuraPatched) {
      // Mark as patched to avoid double-patching
      ctx.__obscuraPatched = true;
      
      // Store original methods for this context instance
      const origGetImageData = ctx.getImageData;
      
      // Patch getImageData for this context
      ctx.getImageData = function(sx, sy, sw, sh) {
        return spoofGetImageData.call(this, origGetImageData, sx, sy, sw, sh);
      };
    }
    
    return ctx;
  }
  
  // Main patching function
  function patch() {
    if (isPatched) return;
    
    try {
      // Initialize seed and PRNG
      sessionSeed = (persona && persona.canvas && persona.canvas.seed) || getSessionSeed();
      prng = createPRNG(sessionSeed);
      
      // Store original methods
      if (window.CanvasRenderingContext2D && window.CanvasRenderingContext2D.prototype) {
        originalMethods.getImageData = window.CanvasRenderingContext2D.prototype.getImageData;
      }
      
      if (window.HTMLCanvasElement && window.HTMLCanvasElement.prototype) {
        originalMethods.toDataURL = window.HTMLCanvasElement.prototype.toDataURL;
        originalMethods.getContext = window.HTMLCanvasElement.prototype.getContext;
      }
      
      // Patch methods with robust error handling
      if (window.CanvasRenderingContext2D && window.CanvasRenderingContext2D.prototype) {
        window.CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
          return tryOrFallback(
            originalMethods.getImageData,
            function() { return spoofGetImageData.call(this, originalMethods.getImageData, sx, sy, sw, sh); },
            this, [sx, sy, sw, sh],
            'getImageData'
          );
        };
      }
      
      if (window.HTMLCanvasElement && window.HTMLCanvasElement.prototype) {
        window.HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
          return tryOrFallback(
            originalMethods.toDataURL,
            function() { return spoofToDataURL.call(this, originalMethods.toDataURL, type, quality); },
            this, [type, quality],
            'toDataURL'
          );
        };
        
        window.HTMLCanvasElement.prototype.getContext = function(contextType, contextAttributes) {
          return tryOrFallback(
            originalMethods.getContext,
            function() { return spoofGetContext.call(this, originalMethods.getContext, contextType, contextAttributes); },
            this, [contextType, contextAttributes],
            'getContext'
          );
        };
      }
      
      isPatched = true;
      log('canvas', 'Canvas APIs patched successfully');
    } catch (e) {
      logError('canvas', e, 'Failed to patch Canvas APIs');
      isPatched = false;
    }
  }
  
  // Execute the patch immediately
  patch();
})();
