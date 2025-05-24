# ObscuraV0 Modularization, Refactor, and Testing Plan (Revised)

**Purpose:**
- All core business logic (protections, puppets, session/proxy/persona management, etc.) must be modularized into `core/` modules.
- Scripts in `scripts/` are *only* for testing, demos, and orchestration—they must not contain business logic or direct process/file management.
- The GUI (and any future integrations) will consume `core/` modules directly, not scripts.
- This ensures easy extensibility, maintainability, and a clean separation of concerns.

Each section below includes:
- **Refactor/Modularization Tasks**
- **Testing Tasks**
- **Best Practices/Notes**

---

## Table of Contents
1. [scripts/](#scripts)
2. [core/session/](#coresession)
3. [core/actions/](#coreactions)
4. [core/protections/](#coreprotections)
5. [core/proxy/](#coreproxy)
6. [core/persona/](#corepersona)
7. [core/logging.js](#coreloggingjs)
8. [spoofing/](#spoofing)
9. [config/](#config)
10. [tests/](#tests)

---

## scripts/
**Files:** mastertest.mjs, mastertest_persona_loader.mjs, puppet_runner.js, run_sessions.js, run-mitmproxy-playwright.js, testrefactor.mjs, test_orchestrator.js

### Refactor/Modularization Tasks
- Extract all duplicated browser/process/persona/proxy launch logic into `core/session/session_utils.js` and `core/proxy/process_manager.js`.
- **Remove all hardcoded proxy logic/values from scripts.**
- **Load proxy configuration from centralized config files (e.g., `config/proxy.js`, `config/constants.js`) and environment variables for sensitive data.**
- Refactor scripts to become thin wrappers that orchestrate via utility modules.
- Remove direct file system or process management from scripts—delegate to core modules.

### Testing Tasks
- Add integration tests for each script's main workflow (mocking external processes).
- Use test runners (e.g., Jest/Mocha) to validate script entry points and error paths.

### Best Practices/Notes
- Scripts should only coordinate, not contain business logic.

---

## core/session/
**Files:** session_manager.js, orchestrator.js, persona_manager.js, session_utils.js (to be created)

### Refactor/Modularization Tasks
- Move all persona/proxy assignment logic to manager classes.
- Move session launch/cleanup logic into `session_utils.js`.
- Ensure all process management is delegated to `core/proxy/process_manager.js`.
- Add/expand JSDoc for all classes and methods.

### Testing Tasks
- Unit tests for persona/proxy assignment and session lifecycle.
- Mock process spawning and verify cleanup.

### Best Practices/Notes
- Avoid direct file system/process calls in orchestrator/session_manager; delegate to utils.

---

## core/actions/
**Files:** action_executor.js, action_planner.js, action_types.js, click.js, dwell.js, mouse.js, scroll.js, extract_dom_context.js

### Refactor/Modularization Tasks
- Ensure each action is a pure function, stateless where possible.
- Move validation logic to a single validator module.
- Add/expand JSDoc for all actions.

### Testing Tasks
- Unit tests for each action (mock Playwright Page).
- Add tests for action validation (valid/invalid actions).

### Best Practices/Notes
- Actions should be easily testable and independent.

---

## core/protections/
**Files:** index.js, ua.js, fonts.js, plugins.js, canvas.js, webgl.js, navigator.js

### Refactor/Modularization Tasks
- Ensure all protection modules are imported and applied via `index.js`.
- Remove any duplicated logic between spoofing/ and core/protections/.
- Standardize interface for all protection modules (e.g., `applyX`, `unpatch`, `getStatus`).

### Testing Tasks
- Unit tests for each protection module (mock browser context/page).
- Integration tests applying multiple protections at once.

### Best Practices/Notes
- Protection modules should not have side effects at import.

---

## core/proxy/
**Files:** proxy_manager.js, proxy_session.js, process_manager.js (to be created), proxy_config.js (to be created)

### Refactor/Modularization Tasks
- Move all process spawn/kill logic (Flask, mitmdump) into `process_manager.js`.
- Standardize proxy assignment and release in `proxy_manager.js`.
- **Create `proxy_config.js` to load proxy configuration from config files and environment variables.**
- **Refactor all proxy-related modules to use `proxy_config.js` for configuration and credentials.**

### Testing Tasks
- Unit tests for proxy assignment and release.
- Mock process management and test lifecycle.
- **Unit tests for proxy config loader, including missing/invalid env vars.**

### Best Practices/Notes
- **Never hardcode proxy credentials or sensitive info; always use environment variables and config imports.**
- Document required env vars and config fields in README or `.env.example`.

---

## core/persona/
**Files:** persona_proxy_loader.js, personas/

### Refactor/Modularization Tasks
- Centralize persona loading/assignment logic.
- Ensure all persona data is loaded asynchronously.
- Add/expand JSDoc for all methods.

### Testing Tasks
- Unit tests for persona selection, pool exhaustion, and release.
- Tests for persona data integrity.

### Best Practices/Notes
- Avoid synchronous file I/O in production code.

---

## core/logging.js

### Refactor/Modularization Tasks
- Standardize logging interface and log format.
- Add error severity levels.
- Ensure logs are flushed on process exit.

### Testing Tasks
- Unit tests for logger methods.
- Integration tests to verify logs are written and flushed.

### Best Practices/Notes
- Logging should not throw errors; fail gracefully.

---

## spoofing/
**Files:** canvas.js, webgl.js, fonts.js, plugins.js, navigator.js, utils.js, index.js

### Refactor/Modularization Tasks
- Ensure all modules are stateless and export a clear interface (`patch`, `unpatch`, `getStatus`).
- Move any duplicated logic (e.g., entropy, PRNG) to `utils.js`.
- Add/expand JSDoc for all spoofing modules.

### Testing Tasks
- Unit tests for each spoofing module (mock browser APIs where needed).
- Test error handling and fallback logic.

### Best Practices/Notes
- Spoofing modules should never throw uncaught exceptions.

---

## config/
**Files:** config.js, config.json, persona_proxy_pool.json, site_whitelist.json, ua_state.json, user_agents.json

### Refactor/Modularization Tasks
- Move all magic numbers, timeouts, proxy hosts/ports, and similar values to config files.
- **Ensure all sensitive values (credentials, API keys) are loaded from environment variables.**
- Document all config fields and required environment variables in a README section or `.env.example`.
- Validate config at startup.

### Testing Tasks
- Unit tests for config loading and validation.
- Tests for missing/invalid config fields.

### Best Practices/Notes
- Sensitive info should be loaded via environment variables, not committed.

---

## tests/
**Files:** test_extract_dom.js, test_openai.js, test_puppet_domlog.js, (add more as needed)

### Refactor/Modularization Tasks
- Expand tests to cover all core modules and spoofing modules.
- Add integration tests for full session runs (mock external services).
- Organize tests by module.

### Testing Tasks
- Achieve >80% code coverage.
- Add CI integration for automatic test runs.

### Best Practices/Notes
- Use mocks/stubs for external dependencies (Playwright, subprocesses).
- Write regression tests for any bugs found during refactor.

---

## General Guidelines
- **Test as you go:** Every refactor/modularization step must be accompanied by new or updated tests.
- **Use TDD where feasible:** Write failing tests before refactoring, then refactor to pass.
- **Document all changes:** Update this plan as tasks are completed.
- **Review frequently:** Code reviews after each major refactor.

---

*Last updated: 2025-05-23*
