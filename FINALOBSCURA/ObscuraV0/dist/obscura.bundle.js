(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // spoofing/canvas.js
  var canvas_exports = {};
  __export(canvas_exports, {
    getStatus: () => getStatus,
    patch: () => patch,
    unpatch: () => unpatch
  });

  // config/config.js
  var DEBUG_MODE = false;
  var LOG_LEVEL = DEBUG_MODE ? "debug" : "error";
  var AUTO_PATCH = true;
  var STRICT_MODE = false;
  var PERSISTENT_SEED = true;
  var CACHE_TTL = 5 * 60 * 1e3;
  var MODULE_CONFIG = {
    canvas: {
      enabled: true,
      noise: {
        enabled: true,
        strength: 0.02
        // Noise strength (0-1)
      }
    },
    webgl: {
      enabled: true,
      failIfNotSupported: false
    },
    fonts: {
      enabled: true,
      extendNative: false
      // Extend rather than replace system fonts
    },
    navigator: {
      enabled: true,
      spoofUserAgent: true,
      spoofPlatform: true,
      spoofLanguage: true
    },
    plugins: {
      enabled: true,
      // List of plugins to expose (empty = use defaults)
      plugins: []
    }
  };

  // spoofing/utils.js
  var SESSION_STORAGE_KEY = "__obscura_session_seed";
  function getSessionSeed() {
    if (PERSISTENT_SEED && typeof sessionStorage !== "undefined") {
      let stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) return parseInt(stored, 10);
    }
    try {
      let entropy = "" + navigator.userAgent + navigator.language + (performance.now ? performance.now() : "") + Math.random() + Date.now();
      let hash = 2166136261;
      for (let i = 0; i < entropy.length; i++) {
        hash ^= entropy.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      let seed = hash >>> 0;
      if (PERSISTENT_SEED && typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(SESSION_STORAGE_KEY, seed.toString());
      }
      return seed;
    } catch (e) {
      return Math.floor(Math.random() * 4294967296);
    }
  }
  function createPRNG(seed) {
    let s = new Uint32Array(4);
    s[0] = seed ^ 2747636419;
    s[1] = seed << 13 | seed >>> 19;
    s[2] = seed << 7 | seed >>> 25;
    s[3] = seed ^ 476689397;
    function rotl(x, k) {
      return x << k | x >>> 32 - k;
    }
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
  var LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
  var currentLogLevel = LOG_LEVELS[LOG_LEVEL] ?? LOG_LEVELS.error;
  function log(module, level, message, data) {
    if (LOG_LEVELS[level] < currentLogLevel) return;
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().slice(11, 23);
    const prefix = `[Obscura:${module}:${level.toUpperCase()} ${timestamp}]`;
    const logFn = console[level] || console.log;
    if (data !== void 0) {
      logFn(prefix, message, data);
    } else {
      logFn(prefix, message);
    }
  }
  function logError(module, error, context = "") {
    if (!DEBUG_MODE && !STRICT_MODE) return;
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().slice(11, 23);
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

  // spoofing/canvas.js
  var originalMethods = {};
  var isPatched = false;
  var sessionSeed = null;
  var prng = null;
  var config = null;
  function getCanvasConfig(persona) {
    return persona && persona.canvas ? persona.canvas : MODULE_CONFIG.canvas;
  }
  function hashCanvasContent(canvasEl, imageData) {
    let entropy = `${canvasEl.width}x${canvasEl.height}`;
    if (imageData && imageData.data && imageData.data.length > 1e3) {
      entropy += ":" + imageData.data[0] + imageData.data[100] + imageData.data[1e3];
    }
    let hash = 2166136261;
    for (let i = 0; i < entropy.length; i++) {
      hash ^= entropy.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
  function applyCanvasTransform(ctx, prng3) {
    try {
      const scaleX = 1 + (prng3() - 0.5) * 4e-3;
      const scaleY = 1 + (prng3() - 0.5) * 4e-3;
      const translateX = (prng3() - 0.5) * 0.6;
      const translateY = (prng3() - 0.5) * 0.6;
      const rotate = (prng3() - 0.5) * 4e-3;
      ctx.translate(translateX, translateY);
      ctx.rotate(rotate);
      ctx.scale(scaleX, scaleY);
      return true;
    } catch (e) {
      logError("canvas", e, "applyCanvasTransform failed");
      return false;
    }
  }
  function tryOrFallback(originalFn, spoofFn, context, args, operationName) {
    try {
      return spoofFn.apply(context, args);
    } catch (e) {
      logError("canvas", e, `${operationName} spoofing failed, falling back to original`);
      return originalFn.apply(context, args);
    }
  }
  function spoofGetImageData(originalFn, sx, sy, sw, sh) {
    try {
      const imageData = originalFn.call(this, sx, sy, sw, sh);
      if (!imageData || !imageData.data) {
        return imageData;
      }
      const { data } = imageData;
      const canvasEl = this.canvas || this;
      const contentHash = hashCanvasContent(canvasEl, imageData);
      const contentPRNG = createPRNG(sessionSeed ^ contentHash);
      const noiseStrength = config && config.noise && config.noise.enabled ? config.noise.strength : 0;
      if (noiseStrength > 0) {
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.max(0, Math.min(255, data[i] + Math.floor((contentPRNG() - 0.5) * 2 * 255 * noiseStrength)));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + Math.floor((contentPRNG() - 0.5) * 2 * 255 * noiseStrength)));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + Math.floor((contentPRNG() - 0.5) * 2 * 255 * noiseStrength)));
        }
      }
      return imageData;
    } catch (e) {
      logError("canvas", e, "spoofGetImageData internal error");
      return originalFn.call(this, sx, sy, sw, sh);
    }
  }
  function spoofToDataURL(originalFn, type, quality) {
    try {
      const canvasEl = this;
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvasEl.width;
      tempCanvas.height = canvasEl.height;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) {
        logError("canvas", new Error("Failed to get 2d context for temp canvas"), "spoofToDataURL");
        return originalFn.call(this, type, quality);
      }
      tempCtx.save();
      if (applyCanvasTransform(tempCtx, prng)) {
        tempCtx.drawImage(canvasEl, 0, 0);
      } else {
        log("canvas", "warn", "Canvas transform failed, using untransformed canvas");
        tempCtx.drawImage(canvasEl, 0, 0);
      }
      tempCtx.restore();
      return originalFn.call(tempCanvas, type, quality);
    } catch (e) {
      logError("canvas", e, "spoofToDataURL failed");
      return originalFn.call(this, type, quality);
    }
  }
  function spoofGetContext(originalFn, contextType, contextAttributes) {
    try {
      if (contextType !== "2d") {
        return originalFn.call(this, contextType, contextAttributes);
      }
      const ctx = originalFn.call(this, contextType, contextAttributes);
      if (!ctx) {
        logError("canvas", new Error("Failed to get 2d context"), "spoofGetContext");
        return null;
      }
      if (!ctx.__obscura_processed) {
        ctx.__obscura_processed = true;
        const origGetImageData = ctx.getImageData;
        ctx.getImageData = function(sx, sy, sw, sh) {
          return tryOrFallback(
            origGetImageData,
            function() {
              return spoofGetImageData.call(this, origGetImageData, sx, sy, sw, sh);
            },
            this,
            [sx, sy, sw, sh],
            "getImageData"
          );
        };
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
            "putImageData"
          );
        };
      }
      return ctx;
    } catch (e) {
      logError("canvas", e, "spoofGetContext failed");
      return originalFn.call(this, contextType, contextAttributes);
    }
  }
  function patch(persona = {}) {
    if (isPatched) return;
    try {
      config = getCanvasConfig(persona);
      sessionSeed = persona && persona.canvas && persona.canvas.seed || getSessionSeed();
      prng = createPRNG(sessionSeed);
      originalMethods.getImageData = CanvasRenderingContext2D.prototype.getImageData;
      originalMethods.toDataURL = HTMLCanvasElement.prototype.toDataURL;
      originalMethods.getContext = HTMLCanvasElement.prototype.getContext;
      CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
        try {
          return spoofGetImageData.call(this, originalMethods.getImageData, sx, sy, sw, sh);
        } catch (e) {
          logError("canvas", e, "getImageData spoofing failed");
          return originalMethods.getImageData.call(this, sx, sy, sw, sh);
        }
      };
      HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
        try {
          return spoofToDataURL.call(this, originalMethods.toDataURL, type, quality);
        } catch (e) {
          logError("canvas", e, "toDataURL spoofing failed");
          return originalMethods.toDataURL.call(this, type, quality);
        }
      };
      HTMLCanvasElement.prototype.getContext = function(contextType, contextAttributes) {
        try {
          return spoofGetContext.call(this, originalMethods.getContext, contextType, contextAttributes);
        } catch (e) {
          logError("canvas", e, "getContext spoofing failed");
          return originalMethods.getContext.call(this, contextType, contextAttributes);
        }
      };
      try {
        const existingCanvases = document.querySelectorAll("canvas");
        if (existingCanvases && existingCanvases.length) {
          log("canvas", "info", `Attempting to patch ${existingCanvases.length} existing canvases`);
          for (let i = 0; i < existingCanvases.length; i++) {
            const canvas = existingCanvases[i];
            const existingContext = canvas.__context2d || canvas.getContext("2d", { __internal_obscura_get: true });
            if (existingContext && !existingContext.__obscura_processed) {
              const origGetImageData = existingContext.getImageData;
              existingContext.__obscura_processed = true;
              existingContext.getImageData = function(sx, sy, sw, sh) {
                try {
                  return spoofGetImageData.call(this, origGetImageData, sx, sy, sw, sh);
                } catch (e) {
                  logError("canvas", e, "getImageData spoofing failed (existing canvas)");
                  return origGetImageData.call(this, sx, sy, sw, sh);
                }
              };
            }
          }
        }
      } catch (e) {
        logError("canvas", e, "Failed to patch existing canvases");
      }
      isPatched = true;
      log("canvas", "info", "Canvas APIs patched");
    } catch (e) {
      logError("canvas", e, "Failed to patch canvas APIs");
      try {
        unpatch();
      } catch (recoveryError) {
        logError("canvas", recoveryError, "Failed to recover from patching error");
      }
      isPatched = false;
    }
  }
  function unpatch() {
    if (!isPatched) return;
    try {
      CanvasRenderingContext2D.prototype.getImageData = originalMethods.getImageData;
      HTMLCanvasElement.prototype.toDataURL = originalMethods.toDataURL;
      HTMLCanvasElement.prototype.getContext = originalMethods.getContext;
      isPatched = false;
      log("canvas", "info", "Canvas APIs restored");
    } catch (e) {
      logError("canvas", e, "Failed to unpatch canvas APIs");
    }
  }
  function getStatus() {
    return {
      isPatched,
      sessionSeed,
      config
    };
  }

  // spoofing/webgl.js
  var webgl_exports = {};
  __export(webgl_exports, {
    getStatus: () => getStatus2,
    patch: () => patch2,
    unpatch: () => unpatch2
  });
  var isPatched2 = false;
  var sessionSeed2 = null;
  var prng2 = null;
  var config2 = null;
  var originals = {};
  function getWebGLConfig(persona) {
    return persona && persona.webgl ? persona.webgl : MODULE_CONFIG.webgl;
  }
  function jitterNumber(val, prng3, strength = 0.03) {
    const jitter = 1 + (prng3() * strength - strength / 2);
    return Math.round(val * jitter);
  }
  function shuffleArray(arr, prng3) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(prng3() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function installDrawNoise(gl, prng3) {
    if (gl.__obscuraWebGLNoiseState) return;
    const orig = {
      drawArrays: gl.drawArrays,
      drawElements: gl.drawElements,
      drawArraysInstanced: gl.drawArraysInstanced || gl.drawArraysInstancedANGLE,
      drawElementsInstanced: gl.drawElementsInstanced || gl.drawElementsInstancedANGLE
    };
    function isSignificant(count) {
      return count > 10;
    }
    const vsrc = `attribute vec2 a_position; varying vec2 v_texCoord; void main() { v_texCoord = a_position * 0.5 + 0.5; gl_Position = vec4(a_position, 0.0, 1.0); }`;
    const fsrc = `precision mediump float; uniform float u_noiseAmount; uniform float u_seed; uniform vec2 u_noiseScale; varying vec2 v_texCoord; float rand(vec2 co) { return fract(sin(dot(co.xy, vec2(12.9898, 78.233)) * u_seed) * 43758.5453); } void main() { vec2 noiseCoord = floor(v_texCoord * u_noiseScale) / u_noiseScale; vec3 noiseColor = vec3(rand(noiseCoord + vec2(0.1, 0.0)), rand(noiseCoord + vec2(0.0, 0.1)), rand(noiseCoord + vec2(0.1, 0.1))) * u_noiseAmount; gl_FragColor = vec4(noiseColor - (u_noiseAmount * 0.5), 0.0); }`;
    function compileShader(gl2, type, src) {
      const shader = gl2.createShader(type);
      gl2.shaderSource(shader, src);
      gl2.compileShader(shader);
      return gl2.getShaderParameter(shader, gl2.COMPILE_STATUS) ? shader : null;
    }
    function createNoiseProgram(gl2) {
      const vs = compileShader(gl2, gl2.VERTEX_SHADER, vsrc);
      const fs = compileShader(gl2, gl2.FRAGMENT_SHADER, fsrc);
      if (!vs || !fs) return null;
      const prog = gl2.createProgram();
      gl2.attachShader(prog, vs);
      gl2.attachShader(prog, fs);
      gl2.linkProgram(prog);
      if (!gl2.getProgramParameter(prog, gl2.LINK_STATUS)) return null;
      return {
        program: prog,
        attrib: gl2.getAttribLocation(prog, "a_position"),
        uNoiseAmount: gl2.getUniformLocation(prog, "u_noiseAmount"),
        uSeed: gl2.getUniformLocation(prog, "u_seed"),
        uNoiseScale: gl2.getUniformLocation(prog, "u_noiseScale")
      };
    }
    const noiseProgram = createNoiseProgram(gl);
    function applyNoise() {
      if (!noiseProgram) return;
      gl.useProgram(noiseProgram.program);
      gl.uniform1f(noiseProgram.uNoiseAmount, 0.02);
      gl.uniform1f(noiseProgram.uSeed, prng3() * 100);
      gl.uniform2f(noiseProgram.uNoiseScale, 64, 64);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(noiseProgram.attrib);
      gl.vertexAttribPointer(noiseProgram.attrib, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disableVertexAttribArray(noiseProgram.attrib);
      gl.deleteBuffer(buffer);
    }
    gl.drawArrays = function(mode, first, count) {
      if (isSignificant(count)) applyNoise();
      return orig.drawArrays.call(this, mode, first, count);
    };
    gl.drawElements = function(mode, count, type, offset) {
      if (isSignificant(count)) applyNoise();
      return orig.drawElements.call(this, mode, count, type, offset);
    };
    if (orig.drawArraysInstanced) {
      gl.drawArraysInstanced = function(mode, first, count, instanceCount) {
        if (isSignificant(count * instanceCount)) applyNoise();
        return orig.drawArraysInstanced.call(this, mode, first, count, instanceCount);
      };
    }
    if (orig.drawElementsInstanced) {
      gl.drawElementsInstanced = function(mode, count, type, offset, instanceCount) {
        if (isSignificant(count * instanceCount)) applyNoise();
        return orig.drawElementsInstanced.call(this, mode, count, type, offset, instanceCount);
      };
    }
    gl.__obscuraWebGLNoiseState = true;
  }
  function installReadbackNoise(gl, prng3) {
    if (gl.__obscuraReadbackPatched) return;
    const origReadPixels = gl.readPixels;
    gl.readPixels = function(x, y, width, height, format, type, pixels) {
      origReadPixels.call(this, x, y, width, height, format, type, pixels);
      if (!gl.__obscuraWebGLNoiseState && pixels && pixels.length) {
        for (let i = 0; i < pixels.length; i++) {
          pixels[i] = Math.max(0, Math.min(255, pixels[i] + Math.floor((prng3() - 0.5) * 6)));
        }
      }
    };
    const canvas = gl.canvas;
    if (canvas) {
      const origToDataURL = canvas.toDataURL;
      canvas.toDataURL = function(...args) {
        if (gl.__obscuraWebGLNoiseState) return origToDataURL.apply(this, args);
        const temp = document.createElement("canvas");
        temp.width = this.width;
        temp.height = this.height;
        const ctx = temp.getContext("2d");
        ctx.drawImage(this, 0, 0);
        const imgData = ctx.getImageData(0, 0, temp.width, temp.height);
        for (let i = 0; i < imgData.data.length; i += 4) {
          imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + Math.floor((prng3() - 0.5) * 6)));
          imgData.data[i + 1] = Math.max(0, Math.min(255, imgData.data[i + 1] + Math.floor((prng3() - 0.5) * 6)));
          imgData.data[i + 2] = Math.max(0, Math.min(255, imgData.data[i + 2] + Math.floor((prng3() - 0.5) * 6)));
        }
        ctx.putImageData(imgData, 0, 0);
        return origToDataURL.apply(temp, args);
      };
      if (canvas.toBlob) {
        const origToBlob = canvas.toBlob;
        canvas.toBlob = function(callback, ...args) {
          if (gl.__obscuraWebGLNoiseState) return origToBlob.apply(this, [callback, ...args]);
          const temp = document.createElement("canvas");
          temp.width = this.width;
          temp.height = this.height;
          const ctx = temp.getContext("2d");
          ctx.drawImage(this, 0, 0);
          const imgData = ctx.getImageData(0, 0, temp.width, temp.height);
          for (let i = 0; i < imgData.data.length; i += 4) {
            imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + Math.floor((prng3() - 0.5) * 6)));
            imgData.data[i + 1] = Math.max(0, Math.min(255, imgData.data[i + 1] + Math.floor((prng3() - 0.5) * 6)));
            imgData.data[i + 2] = Math.max(0, Math.min(255, imgData.data[i + 2] + Math.floor((prng3() - 0.5) * 6)));
          }
          ctx.putImageData(imgData, 0, 0);
          origToBlob.call(temp, callback, ...args);
        };
      }
    }
    gl.__obscuraReadbackPatched = true;
  }
  function patchAllActiveWebGL(prng3) {
    const canvases = Array.from(document.getElementsByTagName("canvas"));
    for (const canvas of canvases) {
      let ctx = null;
      try {
        ctx = canvas.getContext("webgl") || canvas.getContext("webgl2");
      } catch (e) {
      }
      if (ctx) {
        installDrawNoise(ctx, prng3);
        installReadbackNoise(ctx, prng3);
      }
    }
  }
  function patchWebGLContexts(prng3) {
    const protoGL = window.WebGLRenderingContext && window.WebGLRenderingContext.prototype;
    if (!protoGL) return;
    if (!originals.getParameter) {
      originals.getParameter = protoGL.getParameter;
      protoGL.getParameter = function(pname) {
        let value = originals.getParameter.call(this, pname);
        if (typeof value === "number") {
          value = jitterNumber(value, prng3, 0.03);
        }
        return value;
      };
    }
    if (!originals.getSupportedExtensions) {
      originals.getSupportedExtensions = protoGL.getSupportedExtensions;
      protoGL.getSupportedExtensions = function() {
        let exts = originals.getSupportedExtensions.call(this) || [];
        if (Array.isArray(exts)) {
          exts = shuffleArray(exts, prng3);
        }
        return exts;
      };
    }
    if (!originals.getContext) {
      originals.getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, attrs) {
        const ctx = originals.getContext.call(this, type, attrs);
        if (type === "webgl" || type === "webgl2") {
          installDrawNoise(ctx, prng3);
          installReadbackNoise(ctx, prng3);
        }
        return ctx;
      };
    }
  }
  function patch2(persona = {}) {
    if (isPatched2) return;
    try {
      config2 = getWebGLConfig(persona);
      sessionSeed2 = persona && persona.webgl && persona.webgl.seed || getSessionSeed();
      prng2 = createPRNG(sessionSeed2);
      patchWebGLContexts(prng2);
      patchAllActiveWebGL(prng2);
      isPatched2 = true;
      log("webgl", "WebGL APIs patched");
    } catch (e) {
      logError("webgl", e, "Failed to patch WebGL APIs");
      isPatched2 = false;
    }
  }
  function unpatch2() {
    if (!isPatched2) return;
    try {
      const protoGL = window.WebGLRenderingContext && window.WebGLRenderingContext.prototype;
      if (protoGL && originals.getParameter) protoGL.getParameter = originals.getParameter;
      if (protoGL && originals.getSupportedExtensions) protoGL.getSupportedExtensions = originals.getSupportedExtensions;
      if (originals.getContext) HTMLCanvasElement.prototype.getContext = originals.getContext;
      isPatched2 = false;
      log("webgl", "WebGL APIs restored");
    } catch (e) {
      logError("webgl", e, "Failed to unpatch WebGL APIs");
    }
  }
  function getStatus2() {
    return {
      isPatched: isPatched2,
      sessionSeed: sessionSeed2,
      config: config2
    };
  }

  // spoofing/fonts.js
  var fonts_exports = {};
  __export(fonts_exports, {
    getStatus: () => getStatus3,
    patch: () => patch3,
    unpatch: () => unpatch3
  });
  var originalFontsCheck = null;
  var originalFontsValues = null;
  var originalMeasureText = null;
  var isPatched3 = false;
  var activeFonts = [];
  function getPersonaFonts() {
    return window.__OBSCURA_PERSONA__ && Array.isArray(window.__OBSCURA_PERSONA__.fonts) ? window.__OBSCURA_PERSONA__.fonts : [];
  }
  function patch3(personaFonts) {
    if (isPatched3) return;
    activeFonts = Array.isArray(personaFonts) ? personaFonts : getPersonaFonts();
    if (document.fonts && typeof document.fonts.check === "function") {
      originalFontsCheck = document.fonts.check;
      document.fonts.check = function(fontString, text) {
        let familyMatch = /(?:font-family:|\s)([\'\"\w\s\-,]+)/i.exec(fontString);
        let family = familyMatch ? familyMatch[1].replace(/[\'\"]/g, "").trim() : fontString;
        return activeFonts.some((f) => family.includes(f));
      };
    }
    if (document.fonts && typeof document.fonts.values === "function") {
      originalFontsValues = document.fonts.values;
      document.fonts.values = function* () {
        for (const font of activeFonts) {
          yield { family: font };
        }
      };
    }
    if (window.CanvasRenderingContext2D && typeof CanvasRenderingContext2D.prototype.measureText === "function") {
      originalMeasureText = CanvasRenderingContext2D.prototype.measureText;
      CanvasRenderingContext2D.prototype.measureText = function(text) {
        const metrics = originalMeasureText.call(this, text);
        if (this.font) {
          let familyMatch = /(?:font-family:|\s)([\'\"\w\s\-,]+)/i.exec(this.font);
          let family = familyMatch ? familyMatch[1].replace(/[\'\"]/g, "").trim() : this.font;
          if (!activeFonts.some((f) => family.includes(f))) {
            metrics.width = metrics.width * (0.95 + Math.random() * 0.1);
          }
        }
        return metrics;
      };
    }
    isPatched3 = true;
  }
  function unpatch3() {
    if (!isPatched3) return;
    if (document.fonts && originalFontsCheck) {
      document.fonts.check = originalFontsCheck;
      originalFontsCheck = null;
    }
    if (document.fonts && originalFontsValues) {
      document.fonts.values = originalFontsValues;
      originalFontsValues = null;
    }
    if (window.CanvasRenderingContext2D && originalMeasureText) {
      CanvasRenderingContext2D.prototype.measureText = originalMeasureText;
      originalMeasureText = null;
    }
    isPatched3 = false;
    activeFonts = [];
  }
  function getStatus3() {
    return {
      isPatched: isPatched3,
      activeFonts: [...activeFonts]
    };
  }

  // spoofing/navigator.js
  var navigator_exports = {};
  __export(navigator_exports, {
    getStatus: () => getStatus4,
    patch: () => patch4,
    unpatch: () => unpatch4
  });
  var originalDescriptors = {};
  var isPatched4 = false;
  var spoofedProps = [
    "userAgent",
    "platform",
    "product",
    "productSub",
    "vendor",
    "vendorSub",
    "hardwareConcurrency",
    "language",
    "languages",
    "deviceMemory"
  ];
  function getPersonaNavigator(persona) {
    if (persona && persona.navigator) return persona.navigator;
    if (window.__OBSCURA_PERSONA__ && window.__OBSCURA_PERSONA__.navigator)
      return window.__OBSCURA_PERSONA__.navigator;
    return {};
  }
  function patch4(personaSubtree) {
    if (isPatched4) return;
    const navPersona = getPersonaNavigator(personaSubtree);
    const nav = window.navigator;
    spoofedProps.forEach((prop) => {
      if (navPersona[prop] !== void 0) {
        try {
          if (!originalDescriptors[prop]) {
            const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, prop) || Object.getOwnPropertyDescriptor(nav, prop);
            if (desc) originalDescriptors[prop] = desc;
          }
          Object.defineProperty(nav, prop, {
            get() {
              return navPersona[prop];
            },
            configurable: true,
            enumerable: false
          });
        } catch (e) {
        }
      }
    });
    if (navPersona.languages) {
      try {
        Object.defineProperty(nav, "languages", {
          get() {
            return navPersona.languages;
          },
          configurable: true,
          enumerable: false
        });
      } catch (e) {
      }
    }
    isPatched4 = true;
  }
  function unpatch4() {
    if (!isPatched4) return;
    const nav = window.navigator;
    Object.entries(originalDescriptors).forEach(([prop, desc]) => {
      try {
        Object.defineProperty(nav, prop, desc);
      } catch (e) {
      }
    });
    originalDescriptors = {};
    isPatched4 = false;
  }
  function getStatus4() {
    return {
      isPatched: isPatched4,
      spoofedProps: Object.keys(originalDescriptors)
    };
  }

  // spoofing/plugins.js
  var plugins_exports = {};
  __export(plugins_exports, {
    getStatus: () => getStatus5,
    patch: () => patch5,
    unpatch: () => unpatch5
  });
  var originalPlugins = null;
  var originalMimeTypes = null;
  var isPatched5 = false;
  function getPersonaPlugins(persona) {
    if (persona && persona.plugins) return persona.plugins;
    if (window.__OBSCURA_PERSONA__ && window.__OBSCURA_PERSONA__.plugins)
      return window.__OBSCURA_PERSONA__.plugins;
    return [];
  }
  function getPersonaMimeTypes(persona) {
    if (persona && persona.mimeTypes) return persona.mimeTypes;
    if (window.__OBSCURA_PERSONA__ && window.__OBSCURA_PERSONA__.mimeTypes)
      return window.__OBSCURA_PERSONA__.mimeTypes;
    return [];
  }
  function createFakePluginArray(plugins) {
    function FakePlugin(name, desc, filename) {
      this.name = name;
      this.description = desc;
      this.filename = filename;
    }
    function FakePluginArray(items) {
      items.forEach((p, i) => {
        this[i] = p;
      });
      this.length = items.length;
      this.item = function(i) {
        return this[i];
      };
      this.namedItem = function(name) {
        return items.find((p) => p.name === name) || null;
      };
    }
    FakePluginArray.prototype = Object.create(Array.prototype);
    return new FakePluginArray(plugins.map((p) => new FakePlugin(p.name, p.description, p.filename)));
  }
  function createFakeMimeTypeArray(mimeTypes) {
    function FakeMimeType(type, desc, suffixes, enabledPlugin) {
      this.type = type;
      this.description = desc;
      this.suffixes = suffixes || "";
      this.enabledPlugin = enabledPlugin || null;
    }
    function FakeMimeTypeArray(items) {
      items.forEach((m, i) => {
        this[i] = m;
      });
      this.length = items.length;
      this.item = function(i) {
        return this[i];
      };
      this.namedItem = function(type) {
        return items.find((m) => m.type === type) || null;
      };
    }
    FakeMimeTypeArray.prototype = Object.create(Array.prototype);
    return new FakeMimeTypeArray(mimeTypes.map((m) => new FakeMimeType(m.type, m.description, m.suffixes, m.enabledPlugin)));
  }
  function patch5(personaSubtree) {
    if (isPatched5) return;
    const plugins = getPersonaPlugins(personaSubtree);
    const mimeTypes = getPersonaMimeTypes(personaSubtree);
    try {
      originalPlugins = Object.getOwnPropertyDescriptor(Navigator.prototype, "plugins") || Object.getOwnPropertyDescriptor(window.navigator, "plugins");
      Object.defineProperty(window.navigator, "plugins", {
        get() {
          return createFakePluginArray(plugins);
        },
        configurable: true,
        enumerable: false
      });
    } catch (e) {
    }
    try {
      originalMimeTypes = Object.getOwnPropertyDescriptor(Navigator.prototype, "mimeTypes") || Object.getOwnPropertyDescriptor(window.navigator, "mimeTypes");
      Object.defineProperty(window.navigator, "mimeTypes", {
        get() {
          return createFakeMimeTypeArray(mimeTypes);
        },
        configurable: true,
        enumerable: false
      });
    } catch (e) {
    }
    isPatched5 = true;
  }
  function unpatch5() {
    if (!isPatched5) return;
    if (originalPlugins) {
      try {
        Object.defineProperty(window.navigator, "plugins", originalPlugins);
      } catch (e) {
      }
      originalPlugins = null;
    }
    if (originalMimeTypes) {
      try {
        Object.defineProperty(window.navigator, "mimeTypes", originalMimeTypes);
      } catch (e) {
      }
      originalMimeTypes = null;
    }
    isPatched5 = false;
  }
  function getStatus5() {
    return {
      isPatched: isPatched5,
      pluginsSpoofed: !!originalPlugins,
      mimeTypesSpoofed: !!originalMimeTypes
    };
  }

  // spoofing/index.js
  var modules = {
    canvas: canvas_exports,
    webgl: webgl_exports,
    fonts: fonts_exports,
    navigator: navigator_exports,
    plugins: plugins_exports
  };
  function registerModule(name, mod) {
    modules[name] = mod;
  }

  // core/injector.js
  function loadPersona() {
    return window.__OBSCURA_PERSONA__ || {};
  }
  function patchAll(options = {}) {
    const persona = loadPersona();
    Object.entries(modules).forEach(([name, mod]) => {
      if (typeof mod.patch === "function") {
        try {
          mod.patch(persona[name] || persona);
        } catch (e) {
          logIntegrationError(name, "patch", e);
        }
      }
    });
  }
  function unpatchAll(options = {}) {
    Object.entries(modules).forEach(([name, mod]) => {
      if (typeof mod.unpatch === "function") {
        try {
          mod.unpatch();
        } catch (e) {
          logIntegrationError(name, "unpatch", e);
        }
      }
    });
  }
  function getStatusAll() {
    const status = {};
    Object.entries(modules).forEach(([name, mod]) => {
      if (typeof mod.getStatus === "function") {
        try {
          status[name] = mod.getStatus();
        } catch (e) {
          status[name] = { error: e.message };
          logIntegrationError(name, "getStatus", e);
        }
      }
    });
    return status;
  }
  function logIntegrationError(module, fn, error) {
    if (DEBUG_MODE) {
      console.error(`[Obscura][Injector] Error in ${module}.${fn}:`, error);
    }
  }
  window.obscura = {
    patch: patchAll,
    unpatch: unpatchAll,
    getStatus: getStatusAll,
    registerModule
  };
  if (AUTO_PATCH) {
    patchAll();
  }
})();
