// utils/proxy_session.js
// Utility for generating Oxylabs proxy credentials for session/persona isolation.
// Compatible with both Playwright and mitmproxy integration.

const regions = ["US"];
const baseUsername = "customer-USERNAME"; // TODO: Replace with your real Oxylabs username

/**
 * Selects a random region from the supported list.
 * @returns {string} Region code (e.g., 'US')
 */
function getRandomRegion() {
    return regions[Math.floor(Math.random() * regions.length)];
}

/**
 * Generates a unique session ID (UUID v4).
 * Uses crypto.randomUUID if available, otherwise falls back to a simple polyfill.
 * @returns {string} UUID v4 string
 */
function getUniqueSessionId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    } else {
        // Fallback for older Node.js (not cryptographically strong)
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

/**
 * Builds the Oxylabs proxy username string.
 * @param {string} region - Region code (e.g., 'US')
 * @param {string} sessionId - Unique session ID (UUID)
 * @returns {string} Proxy username for sticky session and region targeting
 */
function buildOxylabsProxyUsername(region, sessionId) {
    return `${baseUsername}-cc-${region}-session-${sessionId}`;
}

export default {
    regions,
    getRandomRegion,
    getUniqueSessionId,
    buildOxylabsProxyUsername
};
