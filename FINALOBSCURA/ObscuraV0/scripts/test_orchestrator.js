import { Orchestrator } from '../core/session/orchestrator.js';
import fs from 'fs/promises';

async function main() {
  // Load config and persona pool for comprehensive test selection
  const config = JSON.parse(await fs.readFile('../config/config.json', 'utf-8'));
  const personaPool = JSON.parse(await fs.readFile('../config/persona_proxy_pool.json', 'utf-8'));
  // Prefer LLM persona if available, else random, else first
  let persona = null;
  const llmPersonas = personaPool.filter(p => p.planner === 'llm');
  const randomPersonas = personaPool.filter(p => p.planner === 'random');
  if (llmPersonas.length > 0) {
    persona = llmPersonas[Math.floor(Math.random() * llmPersonas.length)];
    console.log(`[test_orchestrator] Randomly selected LLM persona: ${persona.persona_id}`);
  } else if (randomPersonas.length > 0) {
    persona = randomPersonas[Math.floor(Math.random() * randomPersonas.length)];
    console.log(`[test_orchestrator] Randomly selected random persona: ${persona.persona_id}`);
  } else {
    persona = personaPool[0];
    console.log(`[test_orchestrator] Fallback to first persona: ${persona.persona_id}`);
  }

  // Enable all protections
  const protections = {
    canvas: true,
    webgl: true,
    navigatorPlugins: true,
    userAgent: true,
    proxy: true,
    puppets: true,
    headless: false
  };

  const orchestrator = new Orchestrator(config);

  // Start a session with all protections enabled
  const session = await orchestrator.startSession({
    personaId: persona.persona_id,
    protections,
    // Optionally specify script or args
    // script: '../scripts/puppet_runner.js',
    // args: []
  });

  console.log('[test_orchestrator] Session started:', session.id);

  // Let session run for 30 seconds
  await new Promise(res => setTimeout(res, 30000));

  // Fetch and print logs
  const logs = orchestrator.getSessionLogs(session.id);
  console.log(`[test_orchestrator] Logs for session ${session.id}:`);
  for (const log of logs) {
    console.log(`[${new Date(log.timestamp).toISOString()}] [${log.type}] ${log.message.trim()}`);
  }

  // Stop the session
  await orchestrator.stopSession(session.id);
  await orchestrator.shutdown();
  console.log('[test_orchestrator] Session stopped and orchestrator shutdown.');
}

main().catch(e => {
  console.error('[test_orchestrator] Error:', e);
  process.exit(1);
});
