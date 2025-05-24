# Next Steps for Dynamic GUI-Driven Protection Toggling (Obscura)

This document outlines the actionable steps required to enable dynamic, GUI-driven toggling of anti-fingerprinting and spoofing protections in Obscura, with a focus on Electron integration and no-restart application of changes.

---

## 1. Refactor Config Loading for Dynamic Reload
- **Replace static imports** of config (e.g., `import { MODULE_CONFIG } from ...`) with a function that **reads the config file from disk** (`config.json`) at runtime.
- Update all main flows (e.g., `mastertest_combined.mjs`) to call this loader before applying protections.
- Example loader:
  ```js
  import fs from 'fs/promises';
  async function loadConfig() {
    const raw = await fs.readFile('config/config.json', 'utf-8');
    return JSON.parse(raw);
  }
  ```
- **Testing:**
  - Create a test script to load and print config.
  - After integration, modify `config.json` and verify your app respects changes without restart.
  - (Optional) Add a unit test for the loader function.

## 2. Unify All Toggles in One Config Object
- Consolidate all protection toggles (canvas, webgl, fonts, navigator, plugins, proxy, UA, puppets, etc.) under a single object in `config.json`, e.g. `protectionToggles`.
- Update codebase to reference `config.protectionToggles` for all toggling logic.
- Remove any redundant or legacy toggle locations.
- **Testing:**
  - Write/modify a test script to verify that all toggles exist in the unified config object.
  - Change a toggle and confirm it is respected by the protection logic.
  - (Optional) Add a schema validation/unit test for the unified config object.
## 3. Implement Electron IPC for GUI Interaction
- In Electron main process, expose IPC endpoints:
  - `get-protection-config`: Return current toggles to GUI.
  - `set-protection-config`: Accept new toggles from GUI, update config, and re-apply protections.
  - `reload-protections`: Reload config from disk and re-apply protections.
- Example (main process):
  ```js
  ipcMain.handle('get-protection-config', ...);
  ipcMain.handle('set-protection-config', ...);
  ipcMain.handle('reload-protections', ...);
  ```
- In renderer process (GUI), use these endpoints to display toggles and trigger changes.
- **Testing:**
  - Write a test Electron renderer script to request, update, and reload the config via IPC.
  - Confirm that toggling protections via the GUI updates the config and immediately applies changes.
  - (Optional) Add integration tests for IPC endpoints.
## 4. Enable Dynamic (No-Restart) Protection Application
- Ensure `applyProtections` can be called at any time to re-apply protections using the latest toggles.
- If protections are tied to browser/page/session creation, consider supporting hot-reloading or re-injection for long-lived sessions.
- Add user-friendly error handling/logging for failed protection applications.

## 5. (Optional) Add API/IPC for Other Dynamic Settings
- If you want to allow dynamic changes to persona, proxy, or other settings, expose additional IPC endpoints and update flows accordingly.

---

## Checklist
- [ ] Config loader implemented and used everywhere protections are applied
- [ ] All toggles unified under one config object in `config.json`
- [ ] Electron IPC endpoints for config get/set/reload
- [ ] Protections can be re-applied dynamically at runtime
- [ ] GUI can read/write toggles and trigger reloads
- [ ] User-friendly error handling/logging in place

---

**Next: Prioritize refactoring config usage and implementing IPC endpoints. Once complete, update your GUI to use these for real-time toggling!**
