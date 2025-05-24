// PersonaManager: Handles persona pool, selection, and release.
// This is a minimal stub to allow Orchestrator development. Extend as needed.

export class PersonaManager {
  constructor(personas) {
    this.personas = personas || [];
    this.used = new Set();
  }

  acquirePersona(personaId) {
    // If personaId specified, return that persona if available
    if (personaId) {
      const found = this.personas.find(p => p.persona_id === personaId);
      if (found && !this.used.has(found.persona_id)) {
        this.used.add(found.persona_id);
        return found;
      }
      return null;
    }
    // Otherwise, return first unused persona
    const persona = this.personas.find(p => !this.used.has(p.persona_id));
    if (persona) {
      this.used.add(persona.persona_id);
      return persona;
    }
    return null; // All in use
  }

  releasePersona(personaId) {
    this.used.delete(personaId);
  }

  getAvailablePersonas() {
    return this.personas.filter(p => !this.used.has(p.persona_id));
  }
}
