// core/puppets/index.js
// Modular puppets runner for behavioral noise
import { getNextAction } from './actions/action_planner.js';
import { executeAction } from './actions/action_executor.js';

/**
 * Runs a series of behavioral actions (puppets) on a Playwright page using advanced engine.
 * @param {import('playwright').Page} page - Playwright page instance
 * @param {object} options
 * @param {object} options.persona - Persona object
 * @param {Array<string>} options.siteWhitelist - Allowed URLs for navigation
 * @param {number} [options.actionsPerPage=4] - Number of actions per page
 * @param {object} [options.logger] - Optional logger
 * @param {object} [options.actionContext] - Optional initial context/history
 * @param {string} [options.plannerType='random'] - Planner type: 'random' or 'llm'
 * @param {number} [options.maxNavDepth=4] - Maximum navigation depth before reset
 */
import { puppetEngine } from './puppet_engine.js';

export async function runPuppets(page, options = {}) {
  return puppetEngine(page, options);
}
