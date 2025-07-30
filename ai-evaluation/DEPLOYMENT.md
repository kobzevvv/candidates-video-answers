# AI Evaluation System Deployment Guide

## 🚀 Quick Deployment

### 1. Deploy Google Cloud Function

```bash
cd ai-evaluation/cloud-functions/evaluate-candidate
./deploy.sh
```

The script will:
- ✅ Check if gcloud CLI is installed
- ✅ Authenticate you with Google Cloud
- ✅ Ask for your OpenAI API key
- ✅ Deploy the function
- ✅ Give you the function URL

### 2. Set GitHub Secrets

After deployment, add these secrets to your GitHub repository:

1. Go to: https://github.com/kobzevvv/candidates-video-answers/settings/secrets/actions
2. Add the following secrets:

| Secret Name | Value |
|------------|-------|
| `CLOUD_FUNCTION_URL` | The URL from deployment (e.g., `https://us-central1-project.cloudfunctions.net/evaluate-candidate`) |
| `DATABASE_URL` | Your Neon database connection string |
| `OPENAI_API_KEY` | Your OpenAI API key (sk-...) |

### 3. Trigger GitHub Action

#### Option A: Via GitHub UI
1. Go to: https://github.com/kobzevvv/candidates-video-answers/actions
2. Click on "Evaluate Candidates" workflow
3. Click "Run workflow" button
4. Fill in the form:
   - **Position ID**: `68850ec771ef8a1f5dae8c24` (or any position)
   - **Interview ID**: Leave empty (or specific interview)
   - **GPT Model**: Select from dropdown
   - **Skip evaluated**: Check/uncheck as needed
5. Click "Run workflow"

#### Option B: Via GitHub CLI
```bash
# Install GitHub CLI if needed
brew install gh

# Authenticate
gh auth login

# Run workflow for a position
gh workflow run evaluate-candidates.yml \
  -f position_id=68850ec771ef8a1f5dae8c24 \
  -f gpt_model=gpt-3.5-turbo \
  -f skip_evaluated=false

# Run workflow for specific interview
gh workflow run evaluate-candidates.yml \
  -f interview_id=688734e38fb4bc64261bffe0 \
  -f gpt_model=gpt-3.5-turbo
```

## 🧪 Testing the Cloud Function

After deployment, test your function:

```bash
# Test with curl
curl 'YOUR_FUNCTION_URL?candidate_id=test&interview_id=test&question=What%20is%20your%20experience&answer=I%20have%205%20years%20experience&gpt_model=gpt-3.5-turbo'

# Expected response:
{
  "candidate_id": "test",
  "interview_id": "test",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "evaluation": {
    "addressing": 8,
    "be_specific": 6,
    "openness": 7,
    "short_summary": "Direct answer with specific experience timeframe"
  },
  "model_used": "gpt-3.5-turbo",
  "prompt_version": "1.0"
}
```

## 🔍 Troubleshooting

### Cloud Function Issues
- **503 Error**: Function not deployed - run `./deploy.sh`
- **401 Error**: OpenAI API key issue - redeploy with correct key
- **Timeout**: Increase timeout in deploy script

### GitHub Action Issues
- **"No files found"**: Cloud Function is failing - check logs
- **Database errors**: Check DATABASE_URL format
- **All evaluations fail**: Cloud Function URL is wrong

## 📊 Monitoring

View function logs:
```bash
gcloud functions logs read evaluate-candidate --limit 50
```

View GitHub Action logs:
1. Go to Actions tab
2. Click on the workflow run
3. Click on "evaluate" job
4. Expand "Run candidate evaluation" step