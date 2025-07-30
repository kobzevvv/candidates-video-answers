# GitHub Models API - Current Status

**Last Updated:** July 30, 2025

## Important Notice

As of July 2025, **GitHub Models API currently only supports OpenAI models**. Other providers' models listed in the GitHub Actions UI are planned for future support but will return errors if used now.

## Currently Working Models ✅

Only these models work with the Cloud Function:

1. **gpt-4o-mini** (Recommended - Default)
   - Fast and cost-effective
   - Best for most evaluation tasks
   ```bash
   node scripts/transcript-sync/evaluate-by-interview.js <interview_id> gpt-4o-mini
   ```

2. **gpt-4o**
   - Most capable for complex tasks
   - Higher cost but better quality
   ```bash
   node scripts/transcript-sync/evaluate-by-interview.js <interview_id> gpt-4o
   ```

3. **openai/gpt-4o-mini** (Same as gpt-4o-mini)
4. **openai/gpt-4o** (Same as gpt-4o)

## Models Coming Soon ⏳

These models are listed in the UI but **DO NOT WORK YET**:

- ❌ `google/gemini-1.5-flash` - Returns "Unknown model" error
- ❌ `google/gemini-1.5-pro` - Returns "Unknown model" error
- ❌ `claude-3-5-sonnet-latest` - Returns "Unknown model" error
- ❌ `meta-llama/llama-3.1-*` models - Returns "Unknown model" error
- ❌ `mistral/*` models - Returns "Unknown model" error
- ❌ `cohere/*` models - Returns "Unknown model" error

## How to Fix Evaluation Errors

If you're getting 500 errors with non-OpenAI models:

1. Use the default model (no model parameter needed):
   ```bash
   node scripts/transcript-sync/evaluate-by-interview.js 688740768fb4bc64261d5b01
   ```

2. Or explicitly use a working model:
   ```bash
   node scripts/transcript-sync/evaluate-by-interview.js 688740768fb4bc64261d5b01 gpt-4o-mini
   ```

## Test Model Compatibility

To test which models work with your setup:
```bash
node scripts/test-github-models-api.js
```

## Why This Limitation?

GitHub Models API is currently in beta and gradually adding support for more model providers. The API infrastructure exists for these models, but the actual model endpoints are not yet available.

## Monitoring Updates

Check the GitHub Models documentation periodically for updates on newly supported models:
- https://docs.github.com/en/github-models
- https://github.blog/changelog/

## Troubleshooting

### Error: "Unknown model: google/gemini-1.5-flash"
**Solution:** Use `gpt-4o-mini` or `gpt-4o` instead.

### Error: Request failed with status code 500
**Likely Cause:** Using a non-OpenAI model.
**Solution:** Switch to `gpt-4o-mini` or `gpt-4o`.

### How to verify available models:
```bash
# Run our test script
node scripts/test-github-models-api.js

# Or check Cloud Function health
curl https://evaluate-candidate-grz2olvbca-uc.a.run.app/health
```