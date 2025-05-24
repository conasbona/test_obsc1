# Puppets Engine: Lifetime, Control, and Safety Features

## Overview
The puppets engine in ObscuraV0 is designed for persistent, realistic browsing simulation. It can run for the entire lifetime of an Obscura instance (e.g., as long as the browser/process is alive) and supports external control for future GUI or IPC integration. Safety features are built-in to prevent runaway behavior.

---

## Infinite/Externally-Controlled Lifetime
- **Default Behavior:**
  - The engine runs indefinitely (`actionsPerPage = Infinity`), simulating browsing as long as the Obscura instance is active.
- **External Control:**
  - Pass a `shouldContinue` callback to the engine. This function is checked before every action; return `false` to stop puppets (e.g., set by GUI or IPC message).
- **Example:**
  ```js
  let running = true;
  // GUI/IPC can set running = false to stop puppets
  await runPuppets(page, {
    actionsPerPage: Infinity,
    shouldContinue: () => running
  });
  ```

---

## Safety Features
- **maxConsecutiveActionFailures** (default: 5):
  - Puppets will stop if this many actions fail in a row (prevents endless error loops).
- **maxConsecutiveProxyFailures** (default: 5):
  - Puppets will stop if this many proxy-related failures occur consecutively.
- **maxTotalActions** (default: 100,000):
  - Hard cap on total actions, as a failsafe (set to `Infinity` to disable).
- **maxNavDepth** (default: 4):
  - After this many navigation hops, the puppet will reset to a seed site, preventing endless deep navigation.

---

## Options Reference
| Option                        | Type     | Default    | Description                                              |
|-------------------------------|----------|------------|----------------------------------------------------------|
| actionsPerPage                | Number   | Infinity   | Number of actions to run (Infinity = run forever)        |
| shouldContinue                | Function | always true| Callback, return false to stop puppets                   |
| maxConsecutiveActionFailures  | Number   | 5          | Stop after this many consecutive action failures         |
| maxConsecutiveProxyFailures   | Number   | 5          | Stop after this many consecutive proxy failures          |
| maxTotalActions               | Number   | 100000     | Hard cap on total actions                                |
| maxNavDepth                   | Number   | 4          | Navigation depth before reset to seed site               |
| plannerType                   | String   | 'random'   | Which planner to use ('random', 'llm', etc.)             |
| logger                        | Object   | null       | Optional logger for session/activity                     |
| actionContext                 | Object   | null       | Optional initial context/history                         |

---

## For Future GUI/IPC Integration
- The GUI can toggle puppets on/off by setting a shared flag or sending IPC messages.
- The puppets engine will check `shouldContinue()` before each action, stopping gracefully when instructed.
- This makes the system robust for both CLI and GUI/daemon use.

---

## Example Usage
```js
// Persistent puppets, externally controlled:
let running = true;
// GUI/IPC sets running = false to stop
await runPuppets(page, {
  actionsPerPage: Infinity,
  shouldContinue: () => running,
  maxConsecutiveActionFailures: 5,
  maxConsecutiveProxyFailures: 5,
  maxTotalActions: 100000,
  maxNavDepth: 4,
  plannerType: 'llm',
  logger,
  actionContext: context
});
```

---

For more details, see `core/puppets/puppet_engine.js` and the implementation plan.
