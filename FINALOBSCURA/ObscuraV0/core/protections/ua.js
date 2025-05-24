// User-Agent spoofing protection module
export async function applyUserAgent(context, persona, options = {}) {
  if (options.uaSpoof && persona.user_agent) {
    await context.setExtraHTTPHeaders({ 'User-Agent': persona.user_agent });
  }
}
