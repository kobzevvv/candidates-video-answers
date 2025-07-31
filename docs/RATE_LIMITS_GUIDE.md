# GitHub Models API Rate Limits Guide

## Overview

When using GitHub Models API for AI evaluations, you may encounter rate limits. This guide helps you understand and manage these limits effectively.

## Checking Current Rate Limits

### Using the Check Script

```bash
# Set your GitHub token
export GITHUB_TOKEN=your_github_token

# Run the rate limit checker
node scripts/check-github-models-limits.js
```

This will show:
- Current API rate limits
- How many requests you've used
- When limits reset
- Available models

### Understanding the Output

```
📊 GitHub API Rate Limits:
========================

🔵 Core API:
   Limit: 5000 requests/hour
   Used: 1234 requests
   Remaining: 3766 requests
   Resets at: 2025-07-31 10:00:00

📈 Usage: 24.7% of hourly limit
```

## Common Rate Limit Errors

### Error Messages

1. **HTTP 429 - Too Many Requests**
   ```
   Error: Request failed with status code 429
   ```

2. **Rate Limit Headers**
   ```
   x-ratelimit-limit: 5000
   x-ratelimit-remaining: 0
   x-ratelimit-reset: 1627742400
   ```

## Best Practices

### 1. Adjust Request Delays

The evaluation script uses `RATE_LIMIT_DELAY` to space out requests:

```bash
# Default: 3 seconds between requests
export RATE_LIMIT_DELAY=3000

# For heavy usage: 5-10 seconds
export RATE_LIMIT_DELAY=5000

# For rate limit issues: 15-30 seconds
export RATE_LIMIT_DELAY=15000
```

### 2. Use Different Models

Different models may have different rate limits:

- `google/gemini-1.5-flash` - Good for high-volume evaluations
- `gpt-4o-mini` - Lower cost, may have different limits
- `claude-3-5-sonnet-latest` - Premium model, may have stricter limits

### 3. Monitor Usage

The enhanced evaluation script now shows:
- Requests per minute
- Total requests made
- Rate limit errors encountered
- Automatic delay adjustments

### 4. Batch Processing

For large batches:
1. Check rate limits before starting
2. Use longer delays (10-30 seconds)
3. Consider splitting across multiple hours
4. Use GitHub Actions scheduling

## GitHub Actions Integration

The workflow includes rate limit monitoring:

```yaml
- name: Check GitHub API Rate Limits
  run: node scripts/check-github-models-limits.js

- name: Run AI Evaluation
  env:
    RATE_LIMIT_DELAY: 5000  # 5 seconds between requests
```

## Troubleshooting

### If You Hit Rate Limits

1. **Wait for Reset**
   - Check when limits reset using the script
   - Usually resets every hour

2. **Increase Delays**
   ```bash
   export RATE_LIMIT_DELAY=30000  # 30 seconds
   ```

3. **Use Exponential Backoff**
   - The script automatically increases delays after rate limit errors

4. **Switch Models**
   - Try a different model that may have separate limits

### Emergency Recovery

If evaluation fails due to rate limits:

1. The script saves progress in `evaluation-results/`
2. Wait for rate limit reset
3. Re-run with the same interview ID
4. The script will clear and re-process all answers

## Environment Variables

```bash
# Required
export DATABASE_URL=your_neon_database_url
export CLOUD_FUNCTION_URL=your_cloud_function_url
export GITHUB_TOKEN=your_github_token

# Optional
export RATE_LIMIT_DELAY=5000           # Delay between requests (ms)
export CHECK_RATE_LIMITS=true          # Check limits before starting
```

## Monitoring in Production

For production use:
1. Set up alerts for 429 errors
2. Monitor the Cloud Function logs
3. Track rate limit usage over time
4. Consider implementing request queuing

## Additional Resources

- [GitHub Models API Documentation](https://docs.github.com/en/rest/models)
- [Rate Limiting Best Practices](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting)
- Cloud Function logs: `gcloud functions logs read evaluate-candidate --limit 50`