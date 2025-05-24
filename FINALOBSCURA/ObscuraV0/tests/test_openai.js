import { validateAction } from '../core/puppets/actions/llm_action_planner.js';
import fetch from '../config/node-fetch.js';

const apiKey = "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";

fetch('https://api.openai.com/v1/models', {
  headers: { 'Authorization': `Bearer ${apiKey}` }
})
  .then(res => res.json())
  .then(console.log)
  .catch(console.error);