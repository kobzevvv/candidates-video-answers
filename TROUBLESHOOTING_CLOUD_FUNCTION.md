# Cloud Function Troubleshooting Guide

## Issues Identified

### 1. Cloud Function 500 Internal Server Error
**Problem**: The Cloud Function is returning 500 errors because the `GITHUB_TOKEN` environment variable is not set.

**Root Cause**: The Cloud Function needs `GITHUB_TOKEN` to authenticate with GitHub Models API, but it's missing in the deployed function.

**Solution Options**:

#### Option A: Re-deploy via GitHub Actions
1. Ensure `PAT_GIT_HUB` secret is set in repository settings
2. Trigger the "Deploy AI Evaluation Function" workflow
3. The workflow will set the environment variable during deployment

#### Option B: Manual Update via Script
```bash
# Run the provided script
./scripts/update-cloud-function-env.sh

# Or manually with gcloud
gcloud functions deploy evaluate-candidate \
    --update-env-vars GITHUB_TOKEN="your-github-token" \
    --region us-central1
```

#### Option C: Update via Google Cloud Console
1. Go to Cloud Functions in Google Cloud Console
2. Click on `evaluate-candidate` function
3. Click "Edit"
4. Go to "Environment variables" section
5. Add `GITHUB_TOKEN` with your GitHub PAT value
6. Click "Deploy"

### 2. GitHub Actions Permission Error
**Problem**: The workflow cannot create commit statuses due to insufficient permissions.

**Solution**: Added proper permissions to the workflow:
```yaml
permissions:
  contents: read
  statuses: write
```

## Verification Steps

### Check Cloud Function Health
```bash
# Run the health check script
node scripts/check-cloud-function-health.js

# Or manually check
curl https://your-function-url/health
```

### Test Cloud Function
```bash
# Direct test
node scripts/transcript-sync/test-cloud-function-direct.js

# Full evaluation test
cd scripts/transcript-sync
node evaluate-by-interview.js "688734e38fb4bc64261bffe0" "google/gemini-1.5-flash"
```

## Prevention

1. **Environment Variables**: Always verify environment variables are properly set after deployment
2. **Health Checks**: Use the `/health` endpoint to verify function configuration
3. **Permissions**: Ensure GitHub Actions workflows have appropriate permissions defined
4. **Monitoring**: Set up alerts for Cloud Function errors in Google Cloud Console

## Required Secrets

Make sure these secrets are set in your GitHub repository:
- `PAT_GIT_HUB`: GitHub Personal Access Token with `repo` scope
- `CLOUD_FUNCTION_URL`: The deployed Cloud Function URL
- `DATABASE_URL`: Connection string for the database