import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import personaProxyLoader from '../persona/persona_proxy_loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SessionManager {
  constructor() {
    this.sessions = [];
    this.activeLLMSessions = 0; // Track concurrent LLM sessions
    this.MAX_LLM_SESSIONS = parseInt(process.env.MAX_LLM_SESSIONS, 10) || 1;
  }

  /**
   * Start a single session with explicit persona, proxy, env, and options (for orchestrator)
   * @param {Object} opts
   *   - persona: persona object
   *   - proxy: proxy object
   *   - env: environment variables for child process
   *   - script: script path (default: ./scripts/puppet_runner.js)
   *   - args: additional args (optional)
   * @returns {Promise<Object>} sessionInfo
   */
  async startSession({ persona, proxy, env = {}, script = './scripts/puppet_runner.js', args = [] } = {}) {
    if (!persona) throw new Error('No persona specified');
    if (!proxy) throw new Error('No proxy specified');
    // Enforce LLM session quota if needed
    const plannerType = persona.planner || 'random';
    if (plannerType === 'llm') {
      if (this.activeLLMSessions >= this.MAX_LLM_SESSIONS) {
        throw new Error('LLM session quota exceeded');
      }
      this.activeLLMSessions++;
    }
    // Robust script path resolution: always resolve relative to project root
    // Assume project root is two directories up from this file (core/session/)
    const projectRoot = path.resolve(__dirname, '../../');
    const scriptPath = path.isAbsolute(script)
      ? script
      : path.resolve(projectRoot, script);
    // Compose env
    const childEnv = { ...process.env, ...env, PERSONA_ID: persona.persona_id, PROXY_ID: proxy.id, PLANNER_TYPE: plannerType };
    const sessionProcess = spawn('node', [scriptPath, ...args], {
      stdio: 'inherit',
      shell: false,
      env: childEnv
    });
    const sessionId = `${persona.persona_id}-${Date.now()}`;
    const sessionInfo = { id: sessionId, process: sessionProcess, personaId: persona.persona_id, proxyId: proxy.id, plannerType };
    this.sessions.push(sessionInfo);
    sessionProcess.on('exit', () => {
      if (plannerType === 'llm') {
        this.activeLLMSessions = Math.max(0, this.activeLLMSessions - 1);
      }
    });
    sessionProcess.on('error', (err) => {
      console.error(`[SessionManager] Error in session for persona ${persona.persona_id}:`, err);
    });
    return sessionInfo;
  }

  // Legacy batch launcher for compatibility
  startSessions({ count = 1, script = './scripts/mastertest_persona_loader.mjs', args = [] } = {}) {
    for (let i = 0; i < count; ++i) {
      const persona = personaProxyLoader.getAvailablePersona();
      const plannerType = persona.planner || 'random';

      // Enforce LLM session quota
      if (plannerType === 'llm') {
        if (this.activeLLMSessions >= this.MAX_LLM_SESSIONS) {
          console.error('[SessionManager] LLM session quota exceeded. Skipping LLM-driven session.');
          personaProxyLoader.releasePersona(persona.persona_id);
          continue;
        }
        this.activeLLMSessions++;
      }

      const scriptPath = path.isAbsolute(script)
  ? script
  : path.resolve(process.cwd(), script);
const sessionProcess = spawn('node', [scriptPath, ...args], {
        stdio: 'inherit',
        shell: false,
        env: { ...process.env, PERSONA_ID: persona.persona_id, PLANNER_TYPE: plannerType }
      });
      this.sessions.push({ process: sessionProcess, personaId: persona.persona_id, plannerType });
      sessionProcess.on('exit', () => {
        personaProxyLoader.releasePersona(persona.persona_id);
        if (plannerType === 'llm') {
          this.activeLLMSessions = Math.max(0, this.activeLLMSessions - 1);
        }
      });
      sessionProcess.on('error', (err) => {
        console.error(`[SessionManager] Error in session for persona ${persona.persona_id}:`, err);
        personaProxyLoader.releasePersona(persona.persona_id);
        if (plannerType === 'llm') {
          this.activeLLMSessions = Math.max(0, this.activeLLMSessions - 1);
        }
      });
    }
  }

  stopAllSessions() {
    for (const { process, personaId } of this.sessions) {
      if (!process.killed) process.kill();
      personaProxyLoader.releasePersona(personaId);
    }
    this.sessions = [];
  }

  getActiveSessions() {
    return this.sessions.filter(({ process }) => !process.killed);
  }
}

export { SessionManager };
