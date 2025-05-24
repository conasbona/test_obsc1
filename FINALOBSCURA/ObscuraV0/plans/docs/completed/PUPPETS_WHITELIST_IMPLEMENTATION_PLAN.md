# Implementation Plan: Ensure Puppets ALWAYS Use the Whitelist File

This document describes the steps required to guarantee that puppet browser instances in `mastertest_combined.mjs` always and exclusively use the sites listed in `config/site_whitelist.json`.

---

## 1. Load the Whitelist File

At the top of `mastertest_combined.mjs`, load the whitelist from `config/site_whitelist.json`:
```js
const puppetsWhitelist = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../config/site_whitelist.json'), 'utf-8'));
```

## 2. Set Puppets’ Site List

In the puppets options, set `siteWhitelist` to `puppetsWhitelist`:
```js
let puppetsOptions = {
  persona,
  siteWhitelist: puppetsWhitelist,
  actionsPerPage: Infinity,
  logger: console,
  // ...other options
};
```

## 3. Use Only the Whitelist for Puppets

In `runPuppetsOnWhitelistedSites`, iterate over `puppetsOptions.siteWhitelist` (which is now the whitelist from the file), **NOT** over `TESTS` or any other array.

## 4. Keep TESTS for Main/Protected Instance

The `TESTS` array (fingerprinting sites) should only be used by the main test runner (the “protected” instance).

## 5. Add Comments and Logging

Add a comment above the whitelist loading code:
```js
// Always load puppet browsing sites from config/site_whitelist.json to avoid interfering with user experience.
```
Add a log to confirm at runtime:
```js
console.log('[Obscura] Puppets will browse only these sites:', puppetsWhitelist);
```

## 6. Remove Any Legacy/Mixed Logic

Ensure there are no places where the puppets’ site list could fall back to `TESTS` or any other hardcoded list.

## 7. (Optional) Add a Test/Assertion

Optionally, add a runtime assertion to guarantee the puppets’ site list matches the whitelist:
```js
if (!Array.isArray(puppetsOptions.siteWhitelist) || puppetsOptions.siteWhitelist.length === 0) {
  throw new Error('Puppets site whitelist is empty or not loaded!');
}
```

---

## Summary Table

| Component                | Sites Visited                                 |
|--------------------------|-----------------------------------------------|
| Main Test Runner         | TESTS (fingerprinting test sites)             |
| Puppets                  | config/site_whitelist.json (always, only)     |

---

**Result:**
- The puppets will ALWAYS and EXCLUSIVELY visit the sites in your whitelist file, never the fingerprinting or protected test sites.
