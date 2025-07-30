// GitHub Models API - Available Models Configuration
// Updated: 2025-07-30
// Source: GitHub Models API documentation
// NOTE: As of July 2025, GitHub Models API only supports OpenAI models

const GITHUB_MODELS = {
  // Currently Working Models (OpenAI only)
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    description: 'Fast and cost-effective',
    contextWindow: 128000,
    recommended: true,
    default: true,
    working: true
  },
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    description: 'Most capable for complex tasks',
    contextWindow: 128000,
    recommended: true,
    working: true
  },
  'openai/gpt-4o-mini': {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini (with prefix)',
    provider: 'OpenAI',
    description: 'Same as gpt-4o-mini',
    contextWindow: 128000,
    recommended: false,
    working: true
  },
  'openai/gpt-4o': {
    id: 'openai/gpt-4o',
    name: 'GPT-4o (with prefix)',
    provider: 'OpenAI',
    description: 'Same as gpt-4o',
    contextWindow: 128000,
    recommended: false,
    working: true
  },

  // Future Models (Not yet available on GitHub Models API)
  'google/gemini-1.5-flash': {
    id: 'google/gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'Google',
    description: 'Fast and efficient (coming soon)',
    contextWindow: 1000000,
    recommended: false,
    working: false
  },
  'google/gemini-1.5-pro': {
    id: 'google/gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'Google',
    description: 'Advanced model (coming soon)',
    contextWindow: 1000000,
    recommended: false,
    working: false
  },
  'claude-3-5-sonnet-latest': {
    id: 'claude-3-5-sonnet-latest',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    description: 'Excellent for analysis (coming soon)',
    contextWindow: 200000,
    recommended: false,
    working: false
  },
  'meta-llama/llama-3.1-70b-instruct': {
    id: 'meta-llama/llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B',
    provider: 'Meta',
    description: 'Open-source model (coming soon)',
    contextWindow: 128000,
    recommended: false,
    working: false
  },
  'mistral/mistral-large-2407': {
    id: 'mistral/mistral-large-2407',
    name: 'Mistral Large',
    provider: 'Mistral AI',
    description: 'European model (coming soon)',
    contextWindow: 128000,
    recommended: false,
    working: false
  },
  'cohere/command-r-plus': {
    id: 'cohere/command-r-plus',
    name: 'Command R+',
    provider: 'Cohere',
    description: 'Advanced RAG (coming soon)',
    contextWindow: 128000,
    recommended: false,
    working: false
  }
};

// Get list of model IDs
const MODEL_IDS = Object.keys(GITHUB_MODELS);

// Get recommended models only
const RECOMMENDED_MODELS = MODEL_IDS.filter(id => GITHUB_MODELS[id].recommended);

// Get working models only
const WORKING_MODELS = MODEL_IDS.filter(id => GITHUB_MODELS[id].working);

// Get default model
const DEFAULT_MODEL = MODEL_IDS.find(id => GITHUB_MODELS[id].default) || 'gpt-4o-mini';

// Helper function to validate model
function isValidModel(modelId) {
  return MODEL_IDS.includes(modelId);
}

// Helper function to get model info
function getModelInfo(modelId) {
  return GITHUB_MODELS[modelId] || null;
}

// Export for use in other modules
module.exports = {
  GITHUB_MODELS,
  MODEL_IDS,
  RECOMMENDED_MODELS,
  WORKING_MODELS,
  DEFAULT_MODEL,
  isValidModel,
  getModelInfo
};