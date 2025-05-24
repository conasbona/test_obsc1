/**
 * Action Planner: Generates the next action for a puppet session.
 * For now, uses random logic; later, can be swapped for LLM/AI planner.
 *
 * @param {ActionContext} context
 * @param {Array<string>} siteWhitelist - List of allowed URLs
 * @returns {Action}
 */
function getNextAction(context, siteWhitelist) {
  // If no history, start with a visit
  if (!context.history || context.history.length === 0) {
    const url = siteWhitelist[Math.floor(Math.random() * siteWhitelist.length)];
    return { type: 'visit', params: { url } };
  }

  // Randomly select an action type
  const actionTypes = ['scroll', 'click', 'dwell'];
  const type = actionTypes[Math.floor(Math.random() * actionTypes.length)];

  if (type === 'scroll') {
    return {
      type: 'scroll',
      params: {
        direction: Math.random() > 0.5 ? 'down' : 'up',
        amount: Math.floor(Math.random() * 800) + 200
      }
    };
  } else if (type === 'click') {
    // For now, click a random selector (placeholder)
    return {
      type: 'click',
      params: {
        selector: 'body' // TODO: Replace with smarter element selection
      }
    };
  } else if (type === 'dwell') {
    return {
      type: 'dwell',
      params: {
        duration: Math.floor(Math.random() * 1000) + 500
      }
    };
  }

  // Fallback
  return { type: 'dwell', params: { duration: 1000 } };
}

export { getNextAction };
