// GitHub Models API - Available Models Configuration
// Updated: 2025-07-30
// Source: GitHub Models API documentation

const GITHUB_MODELS = {
  // OpenAI Models
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    description: 'Most capable GPT-4 model for complex tasks',
    contextWindow: 128000,
    recommended: true
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    description: 'Smaller, faster, and cheaper GPT-4 variant',
    contextWindow: 128000,
    recommended: true
  },

  // Google Models
  'google/gemini-1.5-pro': {
    id: 'google/gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'Google',
    description: 'Advanced model with large context window',
    contextWindow: 1000000,
    recommended: true
  },
  'google/gemini-1.5-flash': {
    id: 'google/gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'Google',
    description: 'Fast and efficient for most tasks',
    contextWindow: 1000000,
    recommended: true,
    default: true
  },

  // Anthropic Models
  'claude-3-5-sonnet-latest': {
    id: 'claude-3-5-sonnet-latest',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    description: 'Latest Claude model, excellent for analysis',
    contextWindow: 200000,
    recommended: true
  },
  'claude-3-haiku': {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'Anthropic',
    description: 'Fast and cost-effective Claude model',
    contextWindow: 200000,
    recommended: false
  },

  // Meta Models
  'meta-llama/llama-3.1-405b-instruct': {
    id: 'meta-llama/llama-3.1-405b-instruct',
    name: 'Llama 3.1 405B',
    provider: 'Meta',
    description: 'Largest open-source model',
    contextWindow: 128000,
    recommended: true
  },
  'meta-llama/llama-3.1-70b-instruct': {
    id: 'meta-llama/llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B',
    provider: 'Meta',
    description: 'Powerful open-source model',
    contextWindow: 128000,
    recommended: true
  },
  'meta-llama/llama-3.1-8b-instruct': {
    id: 'meta-llama/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B',
    provider: 'Meta',
    description: 'Lightweight open-source model',
    contextWindow: 128000,
    recommended: false
  },

  // Mistral Models
  'mistral/mistral-large-2407': {
    id: 'mistral/mistral-large-2407',
    name: 'Mistral Large',
    provider: 'Mistral AI',
    description: 'Flagship Mistral model',
    contextWindow: 128000,
    recommended: true
  },
  'mistral/mistral-small-2409': {
    id: 'mistral/mistral-small-2409',
    name: 'Mistral Small',
    provider: 'Mistral AI',
    description: 'Efficient Mistral model',
    contextWindow: 128000,
    recommended: false
  },

  // Cohere Models
  'cohere/command-r-plus': {
    id: 'cohere/command-r-plus',
    name: 'Command R+',
    provider: 'Cohere',
    description: 'Advanced RAG and tool use',
    contextWindow: 128000,
    recommended: true
  },
  'cohere/command-r': {
    id: 'cohere/command-r',
    name: 'Command R',
    provider: 'Cohere',
    description: 'Efficient for RAG and tool use',
    contextWindow: 128000,
    recommended: false
  }
};

// Get list of model IDs
const MODEL_IDS = Object.keys(GITHUB_MODELS);

// Get recommended models only
const RECOMMENDED_MODELS = MODEL_IDS.filter(id => GITHUB_MODELS[id].recommended);

// Get default model
const DEFAULT_MODEL = MODEL_IDS.find(id => GITHUB_MODELS[id].default) || 'google/gemini-1.5-flash';

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
  DEFAULT_MODEL,
  isValidModel,
  getModelInfo
};