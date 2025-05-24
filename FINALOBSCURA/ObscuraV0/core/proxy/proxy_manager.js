// ProxyManager: Handles proxy pool, assignment, and rotation.
// This is a minimal stub for orchestrator development. Extend as needed.

export class ProxyManager {
  constructor(proxies) {
    this.proxies = proxies || [];
    this.used = new Set();
  }

  acquireProxy(proxyId) {
    if (proxyId) {
      const found = this.proxies.find(p => p.id === proxyId);
      if (found && !this.used.has(found.id)) {
        this.used.add(found.id);
        return found;
      }
      return null;
    }
    // Otherwise, return first unused proxy
    const proxy = this.proxies.find(p => !this.used.has(p.id));
    if (proxy) {
      this.used.add(proxy.id);
      return proxy;
    }
    return null; // All in use
  }

  releaseProxy(proxyId) {
    this.used.delete(proxyId);
  }

  getAvailableProxies() {
    return this.proxies.filter(p => !this.used.has(p.id));
  }
}
