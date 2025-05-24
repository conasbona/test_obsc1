# Orchestrator Module Implementation Plan

## 1. Goals
- Provide a single, reusable JS/Node module to manage sessions, personas, proxies, puppets, and protections.
- Expose a clean API for your Electron GUI to start, stop, monitor, and configure sessions.
- Centralize all orchestration, logging, and error handling.
- Make it easy to extend with new features (e.g., new protections, metrics, or session types).

---

## 2. High-Level Architecture
```
/core/session/orchestrator.js    <-- Main orchestrator class
/core/session/session_manager.js <-- Session lifecycle logic
/core/session/persona_manager.js <-- Persona pool/selection logic
/core/protection/                <-- Anti-fingerprinting modules
/core/proxy/                     <-- Proxy management
/core/ua/                        <-- UA spoofing/mitmproxy integration
/scripts/puppet_runner.js        <-- (Child process, not GUI-facing)
```

---

## 3. Orchestrator API Design

### Class: Orchestrator
- `constructor(config)`
- `startSession(options): Promise<SessionInfo>`
- `stopSession(sessionId): Promise`
- `getActiveSessions(): SessionInfo[]`
- `getSessionLogs(sessionId): LogEntry[]`
- `on(event, callback)` (for GUI to subscribe to events: sessionStarted, sessionEnded, error, etc.)
- `shutdown(): Promise`

### Types
- `SessionInfo`: `{ id, personaId, proxy, status, startedAt, ... }`
- `LogEntry`: `{ timestamp, sessionId, level, message, ... }`

---

## 4. Implementation Steps

### A. Define the Orchestrator Class
- Accept config (personas, proxies, protections, etc.) in constructor.
- Hold references to all active sessions (and their child processes).
- Provide methods for session lifecycle management.
- Emit events (using Node's `EventEmitter` or similar) for GUI integration.

### B. Session Management
- Use a `SessionManager` class to launch, monitor, and terminate sessions.
- Each session launches a `puppet_runner.js` child process with the right persona/proxy/env.
- Track session state, errors, and logs.

### C. Persona & Proxy Management
- Use a `PersonaManager` to handle persona pool, selection, and release.
- Use a `ProxyManager` for proxy assignment/rotation.

### D. UA Spoofing & Protections
- Integrate with your UA spoofing and protection modules.
- Provide hooks to enable/disable protections per session.

### E. Logging & Metrics
- Collect logs from all sessions (via IPC, file, or stdout parsing).
- Provide APIs for the GUI to fetch logs and metrics.

### F. Electron Integration
- Expose orchestrator as a Node module.
- In your Electron main process, instantiate the orchestrator and interact with it via IPC or direct method calls.
- In your Electron renderer (GUI), send commands to main process to control sessions, display logs, etc.

---

## 5. Example Orchestrator Skeleton
```js
// core/session/orchestrator.js
import { EventEmitter } from 'events';
import { SessionManager } from './session_manager.js';
import { PersonaManager } from './persona_manager.js';
import { ProxyManager } from '../proxy/proxy_manager.js';

export class Orchestrator extends EventEmitter {
  constructor(config) {
    super();
    this.sessionManager = new SessionManager(config);
    this.personaManager = new PersonaManager(config.personas);
    this.proxyManager = new ProxyManager(config.proxies);
    // ...init other modules
  }

  async startSession(options) {
    // Select persona/proxy, launch puppet, apply protections
    // Emit events as needed
  }

  async stopSession(sessionId) {
    // Stop the session, clean up
  }

  getActiveSessions() {
    // Return array of session info
  }

  getSessionLogs(sessionId) {
    // Return logs for a session
  }

  shutdown() {
    // Gracefully stop all sessions
  }
}
```

---

## 6. Electron Integration Example

**In Electron main process:**
```js
// main.js
import { Orchestrator } from './core/session/orchestrator.js';

const orchestrator = new Orchestrator(appConfig);

// Expose orchestrator methods to renderer via Electron IPC
ipcMain.handle('start-session', (event, options) => orchestrator.startSession(options));
ipcMain.handle('stop-session', (event, sessionId) => orchestrator.stopSession(sessionId));
ipcMain.handle('get-sessions', () => orchestrator.getActiveSessions());
ipcMain.handle('get-logs', (event, sessionId) => orchestrator.getSessionLogs(sessionId));

// Listen for orchestrator events and forward to renderer
orchestrator.on('sessionStarted', info => mainWindow.webContents.send('session-started', info));
orchestrator.on('sessionEnded', info => mainWindow.webContents.send('session-ended', info));
orchestrator.on('error', err => mainWindow.webContents.send('orchestrator-error', err));
```

**In Electron renderer (GUI):**
```js
// renderer.js
// Use Electron's ipcRenderer to control orchestrator and update GUI
ipcRenderer.invoke('start-session', options);
ipcRenderer.on('session-started', (event, info) => { /* update GUI */ });
```

---

## 7. Milestones & Next Steps

1. Design orchestrator API and event model
2. Refactor session, persona, proxy, and protection logic into modules
3. Implement orchestrator class and wire up session management
4. Add logging, error handling, and event emission
5. Integrate orchestrator with Electron main process
6. Build GUI controls for session management and monitoring
7. Test with real personas, proxies, and protections

---

## 8. Optional Enhancements
- Add web dashboard (Express + React) for remote control/monitoring.
- Add metrics export (Prometheus, etc.).
- Add persistent storage for session logs/results.
- Support for distributed orchestration (multiple machines).

---

# GUI Protection Toggles (Requirements)

The GUI should allow the user to toggle the following protections and features per session:

- **Canvas/WebGL spoofing**: On/Off
- **navigator.plugins spoofing**: On/Off
- **User-Agent spoofing**: On/Off
- **Proxy/location spoofing**: On/Off
- **Puppets (behavioral noise bots)**: On/Off
- **Headless mode**: On/Off

These toggles should be passed as options to the orchestrator's `startSession()` method, and the orchestrator should enable/disable the respective modules or features accordingly.

---

## Example: startSession Options
```js
{
  personaId: 'persona_001',
  proxy: { ... },
  protections: {
    canvas: true,
    webgl: true,
    navigatorPlugins: false,
    userAgent: true,
    proxy: true,
    puppets: true,
    headless: false
  }
}
```

---

**Reference this file when designing your orchestrator and GUI.**
