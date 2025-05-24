import { getSessionSeed, createPRNG, log, logError } from './utils.js';
import { MODULE_CONFIG } from '../config/config.js';

let isPatched = false;
let sessionSeed = null;
let prng = null;
let config = null;
let originals = {};

function getWebGLConfig(persona) {
  return (persona && persona.webgl) ? persona.webgl : MODULE_CONFIG.webgl;
}

function jitterNumber(val, prng, strength = 0.03) {
  // ±1.5% default
  const jitter = 1 + (prng() * strength - strength / 2);
  return Math.round(val * jitter);
}

function shuffleArray(arr, prng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function installDrawNoise(gl, prng) {
  if (gl.__obscuraWebGLNoiseState) return;
  const orig = {
    drawArrays: gl.drawArrays,
    drawElements: gl.drawElements,
    drawArraysInstanced: gl.drawArraysInstanced || gl.drawArraysInstancedANGLE,
    drawElementsInstanced: gl.drawElementsInstanced || gl.drawElementsInstancedANGLE
  };
  function isSignificant(count) { return count > 10; }

  // === Shader-based noise injection ===
  const vsrc = `attribute vec2 a_position; varying vec2 v_texCoord; void main() { v_texCoord = a_position * 0.5 + 0.5; gl_Position = vec4(a_position, 0.0, 1.0); }`;
  const fsrc = `precision mediump float; uniform float u_noiseAmount; uniform float u_seed; uniform vec2 u_noiseScale; varying vec2 v_texCoord; float rand(vec2 co) { return fract(sin(dot(co.xy, vec2(12.9898, 78.233)) * u_seed) * 43758.5453); } void main() { vec2 noiseCoord = floor(v_texCoord * u_noiseScale) / u_noiseScale; vec3 noiseColor = vec3(rand(noiseCoord + vec2(0.1, 0.0)), rand(noiseCoord + vec2(0.0, 0.1)), rand(noiseCoord + vec2(0.1, 0.1))) * u_noiseAmount; gl_FragColor = vec4(noiseColor - (u_noiseAmount * 0.5), 0.0); }`;
  function compileShader(gl, type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  }
  function createNoiseProgram(gl) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsrc);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsrc);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    return {
      program: prog,
      attrib: gl.getAttribLocation(prog, 'a_position'),
      uNoiseAmount: gl.getUniformLocation(prog, 'u_noiseAmount'),
      uSeed: gl.getUniformLocation(prog, 'u_seed'),
      uNoiseScale: gl.getUniformLocation(prog, 'u_noiseScale')
    };
  }
  const noiseProgram = createNoiseProgram(gl);
  function applyNoise() {
    if (!noiseProgram) return;
    gl.useProgram(noiseProgram.program);
    gl.uniform1f(noiseProgram.uNoiseAmount, 0.02);
    gl.uniform1f(noiseProgram.uSeed, prng() * 100);
    gl.uniform2f(noiseProgram.uNoiseScale, 64, 64);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(noiseProgram.attrib);
    gl.vertexAttribPointer(noiseProgram.attrib, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(noiseProgram.attrib);
    gl.deleteBuffer(buffer);
  }
  // === End shader-based noise ===

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


function installReadbackNoise(gl, prng) {
  if (gl.__obscuraReadbackPatched) return;
  const origReadPixels = gl.readPixels;
  gl.readPixels = function(x, y, width, height, format, type, pixels) {
    origReadPixels.call(this, x, y, width, height, format, type, pixels);
    if (!gl.__obscuraWebGLNoiseState && pixels && pixels.length) {
      for (let i = 0; i < pixels.length; i++) {
        pixels[i] = Math.max(0, Math.min(255, pixels[i] + Math.floor((prng() - 0.5) * 6)));
      }
    }
  };
  // Patch toDataURL and toBlob if canvas exists
  const canvas = gl.canvas;
  if (canvas) {
    const origToDataURL = canvas.toDataURL;
    canvas.toDataURL = function(...args) {
      if (gl.__obscuraWebGLNoiseState) return origToDataURL.apply(this, args);
      const temp = document.createElement('canvas');
      temp.width = this.width; temp.height = this.height;
      const ctx = temp.getContext('2d');
      ctx.drawImage(this, 0, 0);
      const imgData = ctx.getImageData(0, 0, temp.width, temp.height);
      for (let i = 0; i < imgData.data.length; i += 4) {
        imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + Math.floor((prng() - 0.5) * 6)));
        imgData.data[i+1] = Math.max(0, Math.min(255, imgData.data[i+1] + Math.floor((prng() - 0.5) * 6)));
        imgData.data[i+2] = Math.max(0, Math.min(255, imgData.data[i+2] + Math.floor((prng() - 0.5) * 6)));
      }
      ctx.putImageData(imgData, 0, 0);
      return origToDataURL.apply(temp, args);
    };
    if (canvas.toBlob) {
      const origToBlob = canvas.toBlob;
      canvas.toBlob = function(callback, ...args) {
        if (gl.__obscuraWebGLNoiseState) return origToBlob.apply(this, [callback, ...args]);
        const temp = document.createElement('canvas');
        temp.width = this.width; temp.height = this.height;
        const ctx = temp.getContext('2d');
        ctx.drawImage(this, 0, 0);
        const imgData = ctx.getImageData(0, 0, temp.width, temp.height);
        for (let i = 0; i < imgData.data.length; i += 4) {
          imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + Math.floor((prng() - 0.5) * 6)));
          imgData.data[i+1] = Math.max(0, Math.min(255, imgData.data[i+1] + Math.floor((prng() - 0.5) * 6)));
          imgData.data[i+2] = Math.max(0, Math.min(255, imgData.data[i+2] + Math.floor((prng() - 0.5) * 6)));
        }
        ctx.putImageData(imgData, 0, 0);
        origToBlob.call(temp, callback, ...args);
      };
    }
  }
  gl.__obscuraReadbackPatched = true;
}

function patchAllActiveWebGL(prng) {
  const canvases = Array.from(document.getElementsByTagName('canvas'));
  for (const canvas of canvases) {
    let ctx = null;
    try { ctx = canvas.getContext('webgl') || canvas.getContext('webgl2'); } catch (e) {}
    if (ctx) {
      installDrawNoise(ctx, prng);
      installReadbackNoise(ctx, prng);
    }
  }
}

function patchWebGLContexts(prng) {
  const protoGL = window.WebGLRenderingContext && window.WebGLRenderingContext.prototype;
  if (!protoGL) return;
  if (!originals.getParameter) {
    originals.getParameter = protoGL.getParameter;
    protoGL.getParameter = function(pname) {
      let value = originals.getParameter.call(this, pname);
      if (typeof value === 'number') {
        value = jitterNumber(value, prng, 0.03);
      }
      return value;
    };
  }
  if (!originals.getSupportedExtensions) {
    originals.getSupportedExtensions = protoGL.getSupportedExtensions;
    protoGL.getSupportedExtensions = function() {
      let exts = originals.getSupportedExtensions.call(this) || [];
      if (Array.isArray(exts)) {
        exts = shuffleArray(exts, prng);
      }
      return exts;
    };
  }
  if (!originals.getContext) {
    originals.getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, attrs) {
      const ctx = originals.getContext.call(this, type, attrs);
      if (type === 'webgl' || type === 'webgl2') {
        installDrawNoise(ctx, prng);
        installReadbackNoise(ctx, prng);
      }
      return ctx;
    };
  }
}

export function patch(persona = {}) {
  if (isPatched) return;
  try {
    config = getWebGLConfig(persona);
    sessionSeed = (persona && persona.webgl && persona.webgl.seed) || getSessionSeed();
    prng = createPRNG(sessionSeed);
    patchWebGLContexts(prng);
    patchAllActiveWebGL(prng);
    isPatched = true;
    log('webgl', 'WebGL APIs patched');
  } catch (e) {
    logError('webgl', e, 'Failed to patch WebGL APIs');
    isPatched = false;
  }
}

export function unpatch() {
  if (!isPatched) return;
  try {
    const protoGL = window.WebGLRenderingContext && window.WebGLRenderingContext.prototype;
    if (protoGL && originals.getParameter) protoGL.getParameter = originals.getParameter;
    if (protoGL && originals.getSupportedExtensions) protoGL.getSupportedExtensions = originals.getSupportedExtensions;
    if (originals.getContext) HTMLCanvasElement.prototype.getContext = originals.getContext;
    isPatched = false;
    log('webgl', 'WebGL APIs restored');
  } catch (e) {
    logError('webgl', e, 'Failed to unpatch WebGL APIs');
  }
}

export function getStatus() {
  return {
    isPatched,
    sessionSeed,
    config
  };
}
