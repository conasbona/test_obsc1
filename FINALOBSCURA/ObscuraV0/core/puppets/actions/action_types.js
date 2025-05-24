/**
 * @typedef {Object} Action
 * @property {'visit'|'scroll'|'click'|'dwell'|'search'|'type'|'follow_link'} type
 * @property {Object} params
 * @property {string} [params.url] - For 'visit' and 'follow_link' actions
 * @property {string} [params.selector] - For 'click', 'type', and 'follow_link' actions
 * @property {number} [params.amount] - For 'scroll' actions
 * @property {string} [params.direction] - For 'scroll' actions
 * @property {number} [params.duration] - For 'dwell' actions (ms)
 * @property {string} [params.query] - For 'search' actions
 * @property {string} [params.text] - For 'type' actions
 */

/**
 * @typedef {Object} ActionContext
 * @property {string} currentUrl
 * @property {Object} persona
 * @property {Array<Action>} history
 * @property {Object} [page] - Playwright page instance (optional)
 */

// Export for use in planner and executor
module.exports = {
  ACTION_TYPES: [
    'visit',
    'scroll',
    'click',
    'dwell',
    'search',
    'type',
    'follow_link'
  ]
};
