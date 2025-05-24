# Modularization & Middleware Implementation Plan

This document outlines the plan to modularize and future-proof the automation/protection logic in the Obscura project. By following this plan, the orchestrator will no longer depend on a single runner script, and all protections (UA, fonts, plugins, etc.) will be reusable, maintainable, and centrally managed.

---

## 1. Directory Structure Scaffold

```
core/
  protections/           # All browser/automation protections
    ua.js                # User-Agent spoofing logic
    fonts.js             # Font injection logic
    navigator.js         # Navigator spoofing logic
    plugins.js           # Plugins spoofing logic
    canvas.js            # Canvas anti-fingerprinting logic
    webgl.js             # WebGL anti-fingerprinting logic
    index.js             # Middleware aggregator (applies all protections)
    ua_proxy.js          # mitmproxy/REST UA spoofing logic
  proxy/
    proxy_manager.js     # Proxy selection, credentials, rotation
    mitmproxy_manager.js # mitmproxy process & REST API management
  persona/
    persona_loader.js    # Persona loading utilities
    persona_injector.js  # Persona injection (navigator, plugins, etc.)
  puppets/
    puppets.js           # Behavioral noise (scroll, click, dwell, etc.)
```

---

## 2. Roles & Responsibilities

| Module/Dir       | Responsibility                                    |
|------------------|---------------------------------------------------|
| protections/     | All browser fingerprinting/anti-bot protections   |
| proxy/           | Proxy and mitmproxy management                    |
| persona/         | Persona data loading and injection                |
| puppets/         | Human-like behavioral noise actions               |
| protections/index.js | Aggregates all protections as middleware      |

---

## 3. Middleware Aggregator (`core/protections/index.js`)
- Exports a function (e.g., `applyProtections(context, page, persona, options)`) that applies all requested protections to a Playwright context/page.
- Calls each protection module as needed, based on the `options` object.

---

## 4. Orchestrator & Runner Script Responsibilities

- **Orchestrator:**
  - Manages sessions, personas, proxies, and configuration.
  - Passes a `protections` config object (e.g., `{ uaSpoof: true, fontsSpoof: true, ... }`) to the runner script.
  - Does NOT directly call the protections middleware.

- **Runner Script (e.g., `puppet_runner.js`, `mastertest.mjs`):**
  - Receives config from orchestrator (via env or args).
  - Calls `applyProtections` from the middleware aggregator.
  - Optionally calls persona injection and puppets modules.

---

## 5. Implementation Steps

1. **Scaffold Directories & Files:**
    - Create all directories and empty modules as above.

2. **Move/Refactor Existing Logic:**
    - Move JS injection logic from runner scripts into individual modules in `core/protections/`.
    - Move mitmproxy/REST UA logic into `core/protections/ua_proxy.js` and `core/proxy/mitmproxy_manager.js`.
    - Move persona injection logic into `core/persona/persona_injector.js`.
    - Move behavioral noise logic into `core/puppets/puppets.js`.

3. **Implement Middleware Aggregator:**
    - In `core/protections/index.js`, implement `applyProtections(context, page, persona, options)` to call all relevant modules.

4. **Update Runner Scripts:**
    - Refactor scripts like `mastertest.mjs` and `puppet_runner.js` to use the middleware and modules instead of hardcoded logic.
    - Remove direct JS injection from scripts; replace with calls to middleware.

5. **Update Orchestrator:**
    - Ensure orchestrator passes a `protections` config object to each session.
    - Orchestrator remains agnostic to protection implementation details.

---

## 6. Example Usage in a Runner Script

```js
import { applyProtections } from '../core/protections/index.js';
import { setMitmproxyUA } from '../core/protections/ua_proxy.js';
import { injectPersona } from '../core/persona/persona_injector.js';
import { runPuppets } from '../core/puppets/puppets.js';

// ...setup browser, context, page, persona, etc.

await applyProtections(context, page, persona, protectionsConfig);
await injectPersona(page, persona);
await setMitmproxyUA(persona.user_agent);
await runPuppets(page, persona, puppetOptions);
```

---

## 7. Benefits
- **Reusability:** All protections and logic are available to any runner, orchestrator, or test.
- **Maintainability:** Update a protection in one place, all scripts benefit.
- **Extensibility:** Easily add new protections, proxy types, or puppet behaviors.
- **Orchestrator-Agnostic:** The orchestrator just passes configuration, not script paths.

---

## 8. Next Steps
- Scaffold the directories and modules.
- Refactor one runner script to use the new middleware.
- Gradually migrate all scripts to the new structure.
