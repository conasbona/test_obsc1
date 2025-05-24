# Puppets Module Implementation Plan

## Objective
Modularize the behavioral puppets (human-like noise generation) logic for easy integration into both the main Playwright test script and standalone runners. The new module will live in `core/puppets/` and expose a simple API for running puppets on any Playwright page.

---

## 1. Background
- **Current state:**
  - Behavioral actions (scroll, click, dwell, etc.) are implemented in `core/actions/`.
  - `scripts/puppet_runner.js` orchestrates a behavioral session, but is a standalone script and not modular.
  - There is no reusable puppets module for calling from other scripts.
- **Goal:**
  - Create a `core/puppets/index.js` module that exports a `runPuppets(page, options)` function.
  - Refactor `puppet_runner.js` to use this module.
  - Integrate puppets into `mastertest_combined.mjs` for behavioral noise in all test runs.

---

## 2. Implementation Steps

### Step 1: Scaffold the Puppets Module
- Create `core/puppets/index.js`.
- Export a function `runPuppets(page, options)`.
- Import and use `getNextAction` from `core/actions/action_planner.js` and `executeAction` from `core/actions/action_executor.js`.

### Step 2: Implement the Core Loop
- In `runPuppets`, accept options such as:
  - `persona` (object)
  - `siteWhitelist` (array of URLs)
  - `actionsPerPage` (number of actions per page, default 4)
  - `logger` (optional)
  - Any other relevant parameters (dwell times, randomness, etc.)
- For each action:
  - Use `getNextAction(context, siteWhitelist)` to generate the next action.
  - Use `executeAction(action, page, logger)` to perform the action.
  - Maintain a context/history for smarter action planning.

### Step 3: Refactor puppet_runner.js
- Replace direct action logic with calls to `runPuppets` from the new module.
- Keep CLI handling and logging in the runner script.
- Ensure all configuration and persona loading is preserved.

### Step 4: Integrate with mastertest_combined.mjs
- Import `runPuppets` in the main test script.
- After protections and navigation, call `await runPuppets(page, { ... })` if puppets are enabled.
- Pass in the correct persona, whitelist, and options.
- Use the `PUPPETS_ON` environment variable to toggle puppets.

### Step 5: Testing & Validation
- Test the module via both the runner and main script.
- Ensure behavioral noise is generated as expected (mouse, scroll, click, dwell, etc.).
- Validate modularity and reusability.

---

## 3. Example API Usage
```js
import { runPuppets } from '../core/puppets/index.js';
...
if (process.env.PUPPETS_ON !== '0') {
  await runPuppets(page, {
    persona,
    siteWhitelist,
    actionsPerPage: 5,
    logger
  });
}
```

---

## 4. GUI Toggling Support (Electron-Ready)

### Background
To enable toggling puppets (behavioral noise) on/off from a future GUI, the most robust approach—especially with Electron—is to use Node.js IPC (Inter-Process Communication).

### Implementation Outline
- When the Electron GUI is built, the renderer process (your GUI) will communicate with the main process (Node.js) using Electron's IPC API.
- The GUI will send a message (e.g., `toggle-puppets`, `{ enabled: true }`) to the main process.
- The main process will store this state (e.g., `puppetsOn = true/false`), and check it before running puppets in Playwright sessions:
  ```js
  if (puppetsOn) {
    await runPuppets(page, options);
  }
  ```
- This allows real-time, robust toggling of puppets from the GUI, without relying on config files or environment variables.
- This pattern can also be extended to control protections and other automation features from the GUI.

### Example (for future reference):
**In Electron main process:**
```js
let puppetsOn = false;
ipcMain.on('toggle-puppets', (event, { enabled }) => {
  puppetsOn = enabled;
});
// ...
if (puppetsOn) {
  await runPuppets(page, options);
}
```
**In Electron renderer (GUI):**
```js
ipcRenderer.send('toggle-puppets', { enabled: true });
```

---

## 5. Future Extensions
- Add support for more complex planners (LLM, stateful, etc.).
- Allow dynamic action configuration per test/persona.
- Expose more granular control over action types and frequency.
- Add metrics/logging for puppet activity.

---

## 6. Deliverables
- `core/puppets/index.js` with `runPuppets` function
- Refactored `puppet_runner.js` using the new module
- Updated `mastertest_combined.mjs` with puppets integration
- This implementation plan (`PUPPETS_MODULE_IMPLEMENTATION_PLAN.md`)
