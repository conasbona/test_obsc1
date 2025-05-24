/**
 * Logging utility for behavioral noise puppets.
 * Writes structured JSON logs to /logs/noise_session_<timestamp>.json
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, 'logs');

export class SessionLogger {
  /**
   * @param {string} sessionId
   */
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.logPath = path.join(LOG_DIR, `noise_session_${sessionId}.json`);
    this.events = [];
  }

  /**
   * Log an event
   * @param {Object} event
   */
  log(event) {
    this.events.push({ ...event, timestamp: new Date().toISOString() });
  }

  /**
   * Write all logs to file
   */
  async flush() {
    await fs.writeFile(this.logPath, JSON.stringify(this.events, null, 2), 'utf-8');
  }
}
