let originalFontsCheck = null;
let originalFontsValues = null;
let originalMeasureText = null;
let isPatched = false;
let activeFonts = [];

function getPersonaFonts() {
  // Defensive: fallback to empty array if persona/fonts missing
  return (window.__OBSCURA_PERSONA__ && Array.isArray(window.__OBSCURA_PERSONA__.fonts))
    ? window.__OBSCURA_PERSONA__.fonts
    : [];
}

export function patch(personaFonts) {
  if (isPatched) return;
  activeFonts = Array.isArray(personaFonts) ? personaFonts : getPersonaFonts();
  // Patch document.fonts.check
  if (document.fonts && typeof document.fonts.check === 'function') {
    originalFontsCheck = document.fonts.check;
    document.fonts.check = function(fontString, text) {
      // Parse font family from fontString
      let familyMatch = /(?:font-family:|\s)([\'\"\w\s\-,]+)/i.exec(fontString);
      let family = familyMatch ? familyMatch[1].replace(/[\'\"]/g, '').trim() : fontString;
      // Check against persona fonts
      return activeFonts.some(f => family.includes(f));
    };
  }
  // Patch document.fonts.values
  if (document.fonts && typeof document.fonts.values === 'function') {
    originalFontsValues = document.fonts.values;
    document.fonts.values = function* () {
      // Yield FontFace objects for persona fonts only
      for (const font of activeFonts) {
        yield { family: font };
      }
    };
  }
  // Optionally patch measureText for stealth (basic spoof)
  if (window.CanvasRenderingContext2D && typeof CanvasRenderingContext2D.prototype.measureText === 'function') {
    originalMeasureText = CanvasRenderingContext2D.prototype.measureText;
    CanvasRenderingContext2D.prototype.measureText = function(text) {
      const metrics = originalMeasureText.call(this, text);
      // Optionally randomize width for non-persona fonts
      if (this.font) {
        let familyMatch = /(?:font-family:|\s)([\'\"\w\s\-,]+)/i.exec(this.font);
        let family = familyMatch ? familyMatch[1].replace(/[\'\"]/g, '').trim() : this.font;
        if (!activeFonts.some(f => family.includes(f))) {
          metrics.width = metrics.width * (0.95 + Math.random() * 0.1); // Slight randomization
        }
      }
      return metrics;
    };
  }
  isPatched = true;
}

export function unpatch() {
  if (!isPatched) return;
  // Restore document.fonts.check
  if (document.fonts && originalFontsCheck) {
    document.fonts.check = originalFontsCheck;
    originalFontsCheck = null;
  }
  // Restore document.fonts.values
  if (document.fonts && originalFontsValues) {
    document.fonts.values = originalFontsValues;
    originalFontsValues = null;
  }
  // Restore measureText
  if (window.CanvasRenderingContext2D && originalMeasureText) {
    CanvasRenderingContext2D.prototype.measureText = originalMeasureText;
    originalMeasureText = null;
  }
  isPatched = false;
  activeFonts = [];
}

export function getStatus() {
  return {
    isPatched,
    activeFonts: [...activeFonts]
  };
}
