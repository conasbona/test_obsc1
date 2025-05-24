import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const POOL_PATH = path.resolve(__dirname, '../../config/persona_proxy_pool.json');

class PersonaProxyLoader {
  constructor() {
    this.pool = JSON.parse(fs.readFileSync(POOL_PATH, 'utf-8'));
    this.inUse = new Set();
  }

  getAvailablePersona() {
    for (const persona of this.pool) {
      if (!this.inUse.has(persona.persona_id)) {
        this.inUse.add(persona.persona_id);
        return persona;
      }
    }
    throw new Error('No available personas in the pool!');
  }

  releasePersona(personaId) {
    this.inUse.delete(personaId);
  }
}

export default new PersonaProxyLoader();
