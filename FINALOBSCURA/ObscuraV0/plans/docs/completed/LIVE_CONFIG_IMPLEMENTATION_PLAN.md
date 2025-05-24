# Implementation Plan: Live Reload Backend for Dynamic Config Updates (with Testing)

## Objective
Enable the backend to automatically detect and apply changes to `config.json` (especially `protectionToggles`) in real time, without requiring a restart. Integrate testing at each step to ensure reliability and correctness.

---

## Steps

### 1. **Design Live Config Loader Module**
- Create a module (e.g., `core/liveConfig.js`) to:
  - Load `config.json` into memory.
  - Watch for file changes using `fs.watch` or polling.
  - Reload and parse the config on change, with error handling.
  - Provide a `getConfig()` function to access the latest config.
- **Testing:**
  - Write a test script to verify that the loader correctly loads config and updates in memory when the file changes.
  - Simulate file changes and assert that `getConfig()` returns updated values.

### 2. **Integrate Live Loader Into Backend**
- Refactor backend services (e.g., persistent bots, servers) to:
  - Import and use the live config loader.
  - Always call `getConfig()` before applying protections or reading settings.
  - Avoid caching config at startup; rely on the live loader.
- **Testing:**
  - Create integration tests or scripts that simulate backend tasks.
  - Change the config during execution and assert that new tasks/sessions use updated settings.

### 3. **Debounce and Error Handling**
- Implement debouncing to prevent rapid reloads on multiple file events.
- Add try/catch for JSON parse errors and log issues without crashing the service.
- **Testing:**
  - Simulate rapid file changes and malformed JSON.
  - Assert that the loader debounces reloads and handles errors gracefully.

### 4. **Testing (End-to-End)**
- Manually change `config.json` while the backend is running.
- Confirm that changes are reflected in new sessions/tasks without restarting.
- Add automated tests if desired (e.g., mock file changes, assert config reloads).

### 5. **Advanced (Optional)**
- Expose events or callbacks for config change notifications.
- Integrate with Electron IPC for two-way communication (GUI ↔ backend).
- Support for multiple config files or dynamic schema.
- **Testing:**
  - Add tests for event/callback behavior and IPC communication.

---

## Example File Structure
```
ObscuraV0/
  core/
    liveConfig.js
  scripts/
    live_backend.js
  config/
    config.json
  gui/
    ...
```

---

## Example Usage
- Backend calls `const { getConfig } = require('../core/liveConfig');`
- Before each new session/task, call `getConfig()` to get the latest toggles.
- No restart needed—changes in the GUI or editor are picked up instantly.
- **Testing:**
  - Use test scripts to simulate config changes and verify live reload behavior.

---

## Benefits
- Real-time, dynamic control of protections.
- Improved UX for admins and operators.
- Enables rapid testing, research, and adaptive behaviors.
- **Testing at every step ensures reliability and confidence in live reload functionality.**

---

## Next Steps
1. Implement `core/liveConfig.js` with integrated tests.
2. Refactor backend to use it.
3. Test live reload and iterate as needed.
