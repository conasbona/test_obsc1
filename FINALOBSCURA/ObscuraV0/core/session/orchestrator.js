import { EventEmitter } from 'events';
import { SessionManager } from './session_manager.js';
import { PersonaManager } from './persona_manager.js';
import { ProxyManager } from '../proxy/proxy_manager.js';
import fs from 'fs';
import path from 'path';

/**
 * Orchestrator: Central controller for managing sessions, personas, proxies, and protections.
 * Designed for integration with Electron GUI.
 */
export class Orchestrator extends EventEmitter {
  constructor(config) {
    super();
    // Auto-load personas and proxies from file if needed (sync for now; prefer async for production)
    let personas = config.personas;
    if (typeof personas === 'string') {
      try {
        const personaPath = path.isAbsolute(personas) ? personas : path.resolve(process.cwd(), personas);
        personas = JSON.parse(fs.readFileSync(personaPath, 'utf-8'));
      } catch (e) {
        throw new Error(`[Orchestrator] Failed to load personas from ${personas}: ${e.message}`);
      }
    }
    let proxies = config.proxies;
    if (typeof proxies === 'string') {
      try {
        const proxyPath = path.isAbsolute(proxies) ? proxies : path.resolve(process.cwd(), proxies);
        proxies = JSON.parse(fs.readFileSync(proxyPath, 'utf-8'));
      } catch (e) {
        throw new Error(`[Orchestrator] Failed to load proxies from ${proxies}: ${e.message}`);
      }
    }
    this.sessionManager = new SessionManager(config);
    this.personaManager = new PersonaManager(personas);
    this.proxyManager = new ProxyManager(proxies);
    // TODO: Initialize protection modules, UA spoofing, etc.
    this.activeSessions = new Map(); // sessionId -> session info
  }

  /**
   * Start a session with the given options (persona, proxy, protections, etc.)
   * @param {Object} options
   * @returns {Promise<SessionInfo>}
   */
  async startSession(options) {
    // 1. Select persona
    const persona = this.personaManager.acquirePersona(options.personaId);
    if (!persona) throw new Error('No available persona');
    // 2. Select proxy
    const proxy = this.proxyManager.acquireProxy(options.proxyId);
    if (!proxy) {
      this.personaManager.releasePersona(persona.persona_id);
      throw new Error('No available proxy');
    }
    // 3. Prepare protections/env
    const protections = options.protections || {};
    const env = {
      ...options.env,
      CANVAS_SPOOF: protections.canvas ? '1' : '0',
      WEBGL_SPOOF: protections.webgl ? '1' : '0',
      NAV_PLUGINS_SPOOF: protections.navigatorPlugins ? '1' : '0',
      UA_SPOOF: protections.userAgent ? '1' : '0',
      PROXY_SPOOF: protections.proxy ? '1' : '0',
      PUPPETS_ON: protections.puppets ? '1' : '0',
      HEADLESS: protections.headless === false ? 'false' : 'true',
    };
    // 4. Launch session
    try {
      const sessionInfo = await this.sessionManager.startSession({
        persona,
        proxy,
        env,
        script: options.script, // fallback default is handled in SessionManager
        args: options.args || []
      });
      this.activeSessions.set(sessionInfo.id, sessionInfo);

      // === In-memory logging for this session ===
      if (!this.sessionLogs) this.sessionLogs = new Map();
      this.sessionLogs.set(sessionInfo.id, []);
      const logHandler = (data) => {
        const logs = this.sessionLogs.get(sessionInfo.id);
        if (logs) logs.push({ timestamp: Date.now(), type: 'stdout', message: data.toString() });
      };
      const errHandler = (data) => {
        const logs = this.sessionLogs.get(sessionInfo.id);
        if (logs) logs.push({ timestamp: Date.now(), type: 'stderr', message: data.toString() });
      };
      if (sessionInfo.process.stdout) sessionInfo.process.stdout.on('data', logHandler);
      if (sessionInfo.process.stderr) sessionInfo.process.stderr.on('data', errHandler);
      // Listen for process exit to release persona/proxy and clean up logs
      sessionInfo.process.on('exit', () => {
        this.personaManager.releasePersona(persona.persona_id);
        this.proxyManager.releaseProxy(proxy.id);
        this.activeSessions.delete(sessionInfo.id);
        this.emit('sessionEnded', { sessionId: sessionInfo.id });
      });
      this.emit('sessionStarted', sessionInfo);
      return sessionInfo;
    } catch (err) {
      this.personaManager.releasePersona(persona.persona_id);
      this.proxyManager.releaseProxy(proxy.id);
      throw err;
    }
  }

  /**
   * Stop a running session by ID
   * @param {string} sessionId
   */
  async stopSession(sessionId) {
    await this.sessionManager.stopSession(sessionId);
    this.activeSessions.delete(sessionId);
    this.emit('sessionEnded', { sessionId });
  }

  /**
   * Get info for all active sessions
   */
  getActiveSessions() {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get logs for a session
   * @param {string} sessionId
   */
  getSessionLogs(sessionId) {
    if (!this.sessionLogs) return [];
    return this.sessionLogs.get(sessionId) || [];
  }

  /**
   * Gracefully shutdown all sessions
   */
  async shutdown() {
    for (const sessionId of this.activeSessions.keys()) {
      await this.stopSession(sessionId);
    }
    this.emit('shutdown');
  }
}
