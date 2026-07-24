const { handleFetchRequest } = require('../server/apiFetch');

function applyWorkerEnv(env) {
  if (!env) return;
  if (env.OPENAI_API_KEY != null) process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;
  if (env.OPENAI_MODEL != null) process.env.OPENAI_MODEL = env.OPENAI_MODEL;
  if (env.OPENAI_BASE_URL != null) process.env.OPENAI_BASE_URL = env.OPENAI_BASE_URL;
}

export default {
  async fetch(request, env) {
    applyWorkerEnv(env);
    const apiRes = await handleFetchRequest(request);
    if (apiRes) return apiRes;
    return env.ASSETS.fetch(request);
  },
};
