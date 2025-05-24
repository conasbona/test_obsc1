/**
 * LLM Action Planner Stub
 *
 * Exports getNextAction(context, siteWhitelist)
 * For now, throws NotImplemented error. Replace with real LLM logic in later steps.
 */

import fetch from 'node-fetch';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o';
const MAX_RETRIES = 2;
const BACKOFFS = [1000, 2000]; // ms
const BANNED_KEYWORDS = [
  'login', 'signin', 'signup', 'register', 'cart', 'checkout', 'pay', 'purchase',
  'form', 'input', 'email', 'password', 'address', 'order', 'billing', 'credit', 'card', 'subscribe'
];
const ALLOWED_ACTIONS = [
  {
    type: 'visit',
    params: ['url']
  },
  {
    type: 'scroll',
    params: ['direction', 'amount']
  },
  {
    type: 'click',
    params: ['selector']
  },
  {
    type: 'dwell',
    params: ['duration']
  },
  {
    type: 'search',
    params: ['query']
  },
  {
    type: 'type',
    params: ['selector', 'text']
  },
  {
    type: 'follow_link',
    params: ['selector', 'url']
  }
];

function buildPrompt(context) {
  const persona_json = JSON.stringify(context.persona, null, 2);
  const action_history_json = JSON.stringify((context.history || []).slice(-5).reverse(), null, 2);
  const current_url = context.currentUrl || '';
  const allowed_actions_json = JSON.stringify(ALLOWED_ACTIONS, null, 2);

  // --- DOM Context Section ---
  let domContext = context.domContext || {};
  // Filter and cap links/searchInputs
  let links = Array.isArray(domContext.links) ? domContext.links.filter(l => l && l.text && l.url).slice(0, 15) : [];
  let seenLinkTexts = new Set();
  links = links.filter(l => {
    if (seenLinkTexts.has(l.text)) return false;
    seenLinkTexts.add(l.text);
    return true;
  });
  let searchInputs = Array.isArray(domContext.searchInputs) ? domContext.searchInputs.filter(i => i && i.selector).slice(0, 15) : [];
  let domContextClean = {
    title: domContext.title || '',
    snippet: domContext.snippet ? String(domContext.snippet).slice(0, 700) : '',
    links,
    searchInputs
  };
  const dom_json = JSON.stringify(domContextClean, null, 2);

  // --- Telemetry ---
  if (typeof console !== 'undefined') {
    console.log(`[LLMPlanner] DOM telemetry: links=${links.length}, searchInputs=${searchInputs.length}, snippetLen=${domContextClean.snippet.length}, titleLen=${domContextClean.title.length}`);
  }

  return `Persona:\n${persona_json}\n\nSession action history (most recent first):\n${action_history_json}\n\nCurrent page:\n${current_url}\n\nCurrent page DOM context:\n${dom_json}\n\nAllowed actions:\n${allowed_actions_json}\n\nInstructions:\n1. If the current page is blank or about:blank, the first action MUST be a \"visit\" to a seed site.\n2. Otherwise, choose a realistic next action for the persona on the current page.\n3. You must select your next action using only the links and search inputs in this DOM context. Do not invent selectors or URLs.\n4. Actions must only use the allowed action types. Do NOT suggest logins, purchases, or form fills.\n5. The action must be appropriate for the persona and plausible for a human.\n6. Return only the action as a single-line JSON object, matching this schema:\n   {\"type\": \"ACTION_TYPE\", \"params\": {...}}\n   Example:\n   {\"type\": \"scroll\", \"params\": {\"direction\": \"down\", \"amount\": 400}}\n\nDO NOT return any explanation or text outside of the JSON object.`;
}

function isBanned(str) {
  if (!str) return false;
  return BANNED_KEYWORDS.some(keyword => str.toLowerCase().includes(keyword));
}

let domContextRejects = 0;

function validateAction(action, domContext, logger) {
  if (!action || typeof action !== 'object') return false;
  const { type, params } = action;
  if (!type || typeof type !== 'string' || !params || typeof params !== 'object') return false;
  if (!ALLOWED_ACTIONS.some(a => a.type === type)) return false;

  // Validate params by action type
  switch (type) {
    case 'visit':
      if (typeof params.url !== 'string') return false;
      if (isBanned(params.url)) return false;
      break;
    case 'scroll':
      if (!['down', 'up'].includes(params.direction)) return false;
      if (typeof params.amount !== 'number' || params.amount < 100 || params.amount > 1500) return false;
      break;
    case 'click': {
      if (typeof params.selector !== 'string') return false;
      if (isBanned(params.selector)) return false;
      // Must match one of the selectors in domContext.searchInputs or domContext.links
      const searchInputs = Array.isArray(domContext?.searchInputs) ? domContext.searchInputs : [];
      const links = Array.isArray(domContext?.links) ? domContext.links : [];
      const validSelectors = new Set([
        ...searchInputs.map(i => i.selector),
        ...links.map(l => l.selector).filter(Boolean)
      ]);
      if (!validSelectors.has(params.selector)) {
        domContextRejects++;
        if (logger && typeof logger.log === 'function') {
          logger.log({ type: 'dom_context_reject', action, reason: 'selector not in DOM context', domContextRejects });
        }
        return false;
      }
      break;
    }
    case 'type': {
      if (typeof params.selector !== 'string' || !params.selector.trim()) return false;
      if (typeof params.text !== 'string' || !params.text.trim()) return false;
      if (isBanned(params.text)) return false;
      // Must match one of the selectors in domContext.searchInputs
      const searchInputs = Array.isArray(domContext?.searchInputs) ? domContext.searchInputs : [];
      const validSelectors = new Set(searchInputs.map(i => i.selector));
      if (!validSelectors.has(params.selector)) {
        domContextRejects++;
        if (logger && typeof logger.log === 'function') {
          logger.log({ type: 'dom_context_reject', action, reason: 'type selector not in DOM context', domContextRejects });
        }
        return false;
      }
      break;
    }
    case 'search': {
      if (typeof params.query !== 'string' || !params.query.trim()) return false;
      if (isBanned(params.query)) return false;
      // Must have at least one search input in DOM context
      const searchInputs = Array.isArray(domContext?.searchInputs) ? domContext.searchInputs : [];
      if (searchInputs.length === 0) {
        domContextRejects++;
        if (logger && typeof logger.log === 'function') {
          logger.log({ type: 'dom_context_reject', action, reason: 'no search inputs in DOM context', domContextRejects });
        }
        return false;
      }
      break;
    }
    case 'follow_link': {
      if (typeof params.selector !== 'string' || !params.selector.trim()) return false;
      if (typeof params.url !== 'string') return false;
      if (isBanned(params.url)) return false;
      // Must match a link in domContext.links
      const links = Array.isArray(domContext?.links) ? domContext.links : [];
      const validLinks = new Set(links.map(l => l.url));
      if (!validLinks.has(params.url)) {
        domContextRejects++;
        if (logger && typeof logger.log === 'function') {
          logger.log({ type: 'dom_context_reject', action, reason: 'follow_link url not in DOM context', domContextRejects });
        }
        return false;
      }
      break;
    }
    case 'dwell':
      if (typeof params.duration !== 'number' || params.duration < 500 || params.duration > 5000) return false;
      break;
    default:
      return false;
  }
  return true;
}

function logLLMEvent({ logger, type, prompt, response, error, fallback }) {
  if (logger && typeof logger.log === 'function') {
    logger.log({
      type,
      planner: 'llm',
      prompt,
      response,
      error: error ? (error.message || error) : undefined,
      fallback
    });
  } else {
    // eslint-disable-next-line no-console
    console.error('[LLMPlanner]', { type, prompt, response, error, fallback });
  }
}

// Returns the next action for the puppet, enforcing only banned keyword checks.
export async function getNextAction(context, siteWhitelist, logger) {
  console.log("LLM planner getNextAction CALLED");
  // Load OpenAI API key from environment variable
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[LLMPlanner] OPENAI_API_KEY not set in environment. LLM planner will not function.');
    logLLMEvent({ logger, type: 'llm_error', error: 'OPENAI_API_KEY missing', prompt: null, response: null, fallback: true });
    throw new Error('OPENAI_API_KEY missing');
  }

  const prompt = buildPrompt(context, siteWhitelist);
  console.log('[LLM] Prompt:', prompt);
  console.log('[LLM] context.currentUrl:', context.currentUrl);
  let lastError = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: 'You are an expert at simulating realistic, safe web browsing behavior.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 256
        }),
        timeout: 15000
      });
      const data = await res.json();
      const llmText = data.choices?.[0]?.message?.content?.trim();
      let actionObj = null;
      try {
        // Extract first valid JSON object from response
        const match = llmText && llmText.match(/\{[\s\S]*\}/);
        if (match) {
          actionObj = JSON.parse(match[0]);
        }
      } catch (parseErr) {
        lastError = parseErr;
        logLLMEvent({ logger, type: 'llm_invalid_json', prompt, response: llmText, error: parseErr, fallback: false });
      }
      if (validateAction(actionObj, siteWhitelist)) {
        logLLMEvent({ logger, type: 'llm_action', prompt, response: llmText });
        return actionObj;
      } else {
        lastError = new Error('Invalid or unsafe action from LLM');
        logLLMEvent({ logger, type: 'llm_invalid_action', prompt, response: llmText, error: lastError, fallback: false });
      }
    } catch (err) {
      lastError = err;
      logLLMEvent({ logger, type: 'llm_api_error', prompt, response: null, error: err, fallback: false });
    }
    // Exponential backoff before retry
    if (attempt < MAX_RETRIES) {
      await new Promise(res => setTimeout(res, BACKOFFS[attempt]));
    }
  }
  // Fallback after retries exhausted
  logLLMEvent({ logger, type: 'llm_fallback', prompt, response: null, error: lastError, fallback: true });
  throw new Error('LLM planner failed or returned invalid/unsafe action after retries');
}
