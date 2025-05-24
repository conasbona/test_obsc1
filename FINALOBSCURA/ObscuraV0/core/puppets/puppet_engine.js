// core/puppets/puppet_engine.js
// Advanced puppets engine: navigation depth, planner selection, LLM integration
import { getNextAction as getRandomAction } from './actions/action_planner.js';
import { executeAction } from './actions/action_executor.js';

/**
 * Main puppets engine loop
 * @param {import('playwright').Page} page
 * @param {object} options
 * @param {object} options.persona
 * @param {Array<string>} options.siteWhitelist
 * @param {number} [options.actionsPerPage=4]
 * @param {object} [options.logger]
 * @param {object} [options.actionContext]
 * @param {string} [options.plannerType='random']
 * @param {number} [options.maxNavDepth=4]
 */
/**
 * Main puppets engine loop (infinite/external control mode supported)
 * @param {import('playwright').Page} page
 * @param {object} options
 * @param {object} options.persona
 * @param {Array<string>} options.siteWhitelist
 * @param {number} [options.actionsPerPage=Infinity] - Number of actions to run (Infinity = run forever)
 * @param {object} [options.logger]
 * @param {object} [options.actionContext]
 * @param {string} [options.plannerType='random']
 * @param {number} [options.maxNavDepth=4]
 * @param {function} [options.shouldContinue] - Optional callback, returns true to keep running (default: always true)
 * @param {number} [options.maxConsecutiveActionFailures=5] - Safety: stop after this many consecutive action failures
 * @param {number} [options.maxConsecutiveProxyFailures=5] - Safety: stop after this many consecutive proxy failures
 * @param {number} [options.maxTotalActions=100000] - Safety: hard cap on total actions (Infinity = no cap)
 */
export async function puppetEngine(page, {
  persona = {},
  siteWhitelist = [],
  actionsPerPage = Infinity,
  logger = null,
  actionContext = null,
  plannerType = 'random',
  maxNavDepth = 4,
  shouldContinue = () => true,
  maxConsecutiveActionFailures = 5,
  maxConsecutiveProxyFailures = 5,
  maxTotalActions = 100000
} = {}) {
  let context = actionContext || { history: [], persona, currentUrl: 'about:blank' };
  let navDepth = 1;
  let getLLMAction = null;
  let consecutiveProxyFailures = 0;
  let consecutiveActionFailures = 0;
  let totalActions = 0;

  // Dynamically import LLM planner if needed
  if (plannerType === 'llm') {
    try {
      const llmPlanner = await import('./actions/llm_action_planner.js');
      getLLMAction = llmPlanner.getNextAction;
      if (logger) logger.log({ type: 'planner_info', info: 'Loaded LLM planner' });
    } catch (e) {
      if (logger) logger.log({ type: 'planner_error', error: 'Failed to load LLM planner', details: e.message });
      getLLMAction = null;
    }
  }

  let running = true;
  while (running && shouldContinue() && totalActions < actionsPerPage && totalActions < maxTotalActions) {
    let action;
    let usedPlanner = plannerType;
    try {
      // Navigation depth check
      if (navDepth >= maxNavDepth) {
        let newSeed;
        do {
          newSeed = siteWhitelist[Math.floor(Math.random() * siteWhitelist.length)];
        } while (newSeed === context.currentUrl && siteWhitelist.length > 1);
        action = { type: 'visit', params: { url: newSeed } };
        usedPlanner = 'depth_reset';
        navDepth = 1;
        if (logger) logger.log({ type: 'nav_depth_reset', url: newSeed });
      } else {
        if (plannerType === 'llm' && getLLMAction) {
          try {
            action = await getLLMAction(context, siteWhitelist, logger);
            usedPlanner = 'llm';
          } catch (e) {
            if (logger) logger.log({ type: 'planner_fallback', reason: 'LLM planner failed', details: e.message });
            action = getRandomAction(context, siteWhitelist);
            usedPlanner = 'random';
          }
        } else {
          action = getRandomAction(context, siteWhitelist);
          usedPlanner = 'random';
        }
      }
    } catch (e) {
      if (logger) logger.log({ type: 'planner_error', error: e.message });
      action = { type: 'dwell', params: { duration: 1000 } };
      usedPlanner = 'random';
    }
    if (logger) logger.log({ type: 'action_selected', action, plannerType: usedPlanner });
    try {
      await executeAction(action, page, logger);
      context.history.push(action);
      if (logger) logger.log({ type: 'action', action, plannerType: usedPlanner });
      // After navigation, extract DOM context for LLM
      if (['visit', 'follow_link'].includes(action.type)) {
        navDepth++;
        try {
          const { extractDOMContext } = await import('./actions/extract_dom_context.js');
          context.domContext = await extractDOMContext(page);
          if (logger) logger.log({ type: 'dom_context', domContext: context.domContext });
        } catch (extractErr) {
          if (logger) logger.log({ type: 'dom_context_error', error: extractErr.message });
        }
      }
    } catch (e) {
      if (logger) logger.log({ type: 'action_error', error: e.message, action });
      // Could add failure handling here if needed
    }
    // Optional: brief delay between actions for realism
    await new Promise(res => setTimeout(res, 500));
  }
}
