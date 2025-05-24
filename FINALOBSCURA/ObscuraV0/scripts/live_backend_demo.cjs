// scripts/live_backend_demo.cjs
// Demo: Persistent backend using live config loader
const { getConfig } = require('../core/liveConfig.cjs');

function handleNewSession(sessionNum) {
  const config = getConfig();
  console.log(`[Session ${sessionNum}] Protections:`, config.protectionToggles);
  // Simulate session logic here (e.g., apply protections, run automation, etc.)
}

let sessionNum = 1;
console.log('Live backend demo started. Edit config.json or use the GUI to change protections.');

setInterval(() => {
  handleNewSession(sessionNum++);
}, 7000); // Every 7 seconds

// Optionally, stop after some sessions for demo purposes
setTimeout(() => {
  console.log('Demo complete. Exiting.');
  process.exit(0);
}, 35000); // Run for 35 seconds (5 sessions)
