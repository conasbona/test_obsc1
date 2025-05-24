// process_manager.js
// Centralized process management for Flask, mitmdump, and other subprocesses
// Extracted from scripts for modularization, reuse, and testability

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Start a Flask REST API server as a subprocess.
 * @param {string} scriptPath - Path to the Flask server script
 * @returns {ChildProcess}
 */
export function startFlaskServer(scriptPath) {
  return spawn('python', [scriptPath], { stdio: 'inherit', shell: false });
}

/**
 * Start mitmdump as a subprocess with the given arguments.
 * @param {object} opts - { port, upstream, upstreamAuth, addonPath }
 * @returns {ChildProcess}
 */
export function startMitmdump({ port, upstream, upstreamAuth, addonPath }) {
  const args = [
    '-p', port,
    '--mode', `upstream:${upstream}`,
    '--upstream-auth', upstreamAuth,
    '-s', addonPath
  ];
  return spawn('mitmdump', args, { stdio: 'inherit', shell: false });
}

/**
 * Helper to kill a subprocess safely
 * @param {ChildProcess} proc
 */
export function killProcess(proc) {
  if (proc && !proc.killed) {
    proc.kill();
  }
}

// Add more utilities as needed for managing subprocess lifecycles, health checks, etc.
