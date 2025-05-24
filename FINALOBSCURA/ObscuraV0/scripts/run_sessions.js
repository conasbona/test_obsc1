import { SessionManager } from '../core/session/session_manager.js';
const sessionManager = new SessionManager();
import personaProxyLoader from '../core/persona/persona_proxy_loader.js';

// Prefer an LLM persona if available, otherwise fall back to random
let persona = null;
try {
  const pool = personaProxyLoader.pool;
  // Log all personas and their planner types
  console.log('[run_sessions] Persona pool planner types:', pool.map(p => `${p.persona_id}:${p.planner}`));

  // Prefer a random LLM persona if available, otherwise fallback to a random 'random' persona
  const llmPersonas = pool.filter(p => p.planner === 'llm');
  const randomPersonas = pool.filter(p => p.planner === 'random');
  if (llmPersonas.length > 0) {
    persona = llmPersonas[Math.floor(Math.random() * llmPersonas.length)];
    console.log(`[run_sessions] Randomly selected LLM persona: ${persona.persona_id}`);
  } else if (randomPersonas.length > 0) {
    persona = randomPersonas[Math.floor(Math.random() * randomPersonas.length)];
    console.log('[run_sessions] No LLM persona found, randomly selected a random planner persona:', persona.persona_id);
  } else {
    persona = pool[0]; // Failsafe: just pick the first
    console.log('[run_sessions] No LLM or random personas found, using first available persona:', persona.persona_id);
  }
  if (persona) {
    console.log(`[run_sessions] Selected persona: ${persona.persona_id}, planner: ${persona.planner}`);
  }
} catch (e) {
  console.error('[run_sessions] Error selecting persona:', e);
}

if (persona) {
  // Start only one session, using the selected persona
  personaProxyLoader.inUse.add(persona.persona_id);
  sessionManager.startSessions({
    count: 1,
    script: './mastertest_persona_loader.mjs',
    args: [],
    env: {
      ...process.env,
      PUPPETS_ON: '1',
    },
    // The sessionManager will pick up the selected persona
  });
} else {
  console.error('[run_sessions] No available persona to launch.');
}
