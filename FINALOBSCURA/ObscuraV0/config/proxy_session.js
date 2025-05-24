// config/proxy_session.js
// Proxy session helpers for ObscuraV0
// Region is always 'us' per user request

export function getRandomRegion() {
  return 'us';
}

export function getUniqueSessionId() {
  // Example: timestamp + random 4 digits
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}
