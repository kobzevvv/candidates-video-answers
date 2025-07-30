# GitHub Models API - Available Models

This document lists all available models on GitHub Models API that can be used with our AI evaluation system.

## Quick Start

The evaluation script uses `google/gemini-1.5-flash` by default. To use a different model:

```bash
node scripts/transcript-sync/evaluate-by-interview.js <interview_id> <model_id>
```

## Available Models

### ⭐ Recommended Models (Best Performance & Reliability)

1. **Google Gemini 1.5 Flash** (DEFAULT)
   - ID: `google/gemini-1.5-flash`
   - Context: 1M tokens
   - Best for: Fast, efficient evaluations
   ```bash
   node evaluate-by-interview.js 688740768fb4bc64261d5b01 google/gemini-1.5-flash
   ```

2. **GPT-4o**
   - ID: `gpt-4o`
   - Context: 128K tokens
   - Best for: Complex reasoning tasks
   ```bash
   node evaluate-by-interview.js 688740768fb4bc64261d5b01 gpt-4o
   ```

3. **Claude 3.5 Sonnet**
   - ID: `claude-3-5-sonnet-latest`
   - Context: 200K tokens
   - Best for: Detailed analysis
   ```bash
   node evaluate-by-interview.js 688740768fb4bc64261d5b01 claude-3-5-sonnet-latest
   ```

4. **Llama 3.1 70B**
   - ID: `meta-llama/llama-3.1-70b-instruct`
   - Context: 128K tokens
   - Best for: Open-source preference
   ```bash
   node evaluate-by-interview.js 688740768fb4bc64261d5b01 meta-llama/llama-3.1-70b-instruct
   ```

5. **Mistral Large**
   - ID: `mistral/mistral-large-2407`
   - Context: 128K tokens
   - Best for: European data compliance
   ```bash
   node evaluate-by-interview.js 688740768fb4bc64261d5b01 mistral/mistral-large-2407
   ```

### Additional Models

| Model ID | Provider | Description | Context Window |
|----------|----------|-------------|----------------|
| `gpt-4o-mini` | OpenAI | Smaller, faster GPT-4 variant | 128K |
| `google/gemini-1.5-pro` | Google | Advanced model with large context | 1M |
| `claude-3-haiku` | Anthropic | Fast and cost-effective | 200K |
| `meta-llama/llama-3.1-405b-instruct` | Meta | Largest open-source model | 128K |
| `meta-llama/llama-3.1-8b-instruct` | Meta | Lightweight model | 128K |
| `mistral/mistral-small-2409` | Mistral AI | Efficient model | 128K |
| `cohere/command-r-plus` | Cohere | Advanced RAG capabilities | 128K |
| `cohere/command-r` | Cohere | Efficient for RAG | 128K |

## Testing Models

To test all recommended models:
```bash
node scripts/test-all-models.js
```

To list all available models:
```bash
node scripts/list-models.js
```

## Common Issues

### Model Not Found Error
If you see an error like "Unknown model: microsoft/phi-3.5", it means the model is not available on GitHub Models API. Use one of the models listed above instead.

### Rate Limits
Some models have rate limits. The script automatically handles rate limiting with exponential backoff.

## Model Selection Guide

- **For speed**: Use `google/gemini-1.5-flash` (default)
- **For accuracy**: Use `gpt-4o` or `claude-3-5-sonnet-latest`
- **For large contexts**: Use `google/gemini-1.5-pro` (1M tokens)
- **For open-source**: Use `meta-llama/llama-3.1-70b-instruct`
- **For cost efficiency**: Use `gpt-4o-mini` or `claude-3-haiku`

## Configuration

The model configuration is stored in:
```
ai-evaluation/config/github-models.js
```

This file contains all model definitions, metadata, and helper functions for model validation.