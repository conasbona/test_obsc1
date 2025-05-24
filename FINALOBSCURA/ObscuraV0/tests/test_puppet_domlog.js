// test_puppet_domlog.js
// Launches the puppet in LLM mode and prints DOM context logs for each navigation/action
import fs from 'fs';
import path from 'path';
import { spawn } from '../core/child_process.js';
import { SessionLogger } from '../core/logging.js';

// Dynamically select the first persona with planner: 'llm'
const personas = JSON.parse(fs.readFileSync(path.join(process.cwd(), '../config/persona_proxy_pool.json'), 'utf-8'));
const personaIndex = personas.findIndex(p => (p.planner || '').toLowerCase() === 'llm');
if (personaIndex === -1) {
  console.error('No persona with planner: "llm" found in persona_proxy_pool.json!');
  process.exit(1);
}
const PLANNER_TYPE = 'llm';
const HEADLESS = 'false'; // Set to 'false' if you want to see the browser

console.log(`Starting puppet runner in LLM mode with DOM context logging using personaIndex=${personaIndex} (${personas[personaIndex].persona_id})...`);

const child = spawn('node', [
  'puppet_runner.js',
  personaIndex.toString()
], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PLANNER_TYPE,
    HEADLESS
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

child.stdout.on('data', (data) => {
  const str = data.toString();
  // Print only DOM context logs and action logs
  if (str.includes('[LLMPlanner] DOM telemetry') || str.includes('[puppet_runner] Extracted DOM context') || str.includes('About to execute action:')) {
    process.stdout.write(str);
  }
});

child.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

child.on('close', (code) => {
  console.log(`\nPuppet runner exited with code ${code}`);
});
