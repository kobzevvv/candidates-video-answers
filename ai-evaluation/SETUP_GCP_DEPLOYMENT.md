# Setting Up Automatic Google Cloud Function Deployment

This guide helps you set up automatic deployment of the evaluation Cloud Function whenever you push to the main branch.

## 🔧 Required GitHub Secrets

You need to add these secrets to your repository:

### 1. `GCP_PROJECT_ID`
Your Google Cloud Project ID.

**How to find it:**
```bash
gcloud config get-value project
```
Or visit: https://console.cloud.google.com/home/dashboard

### 2. `GCP_SA_KEY`
Service Account JSON key for authentication.

**How to create it:**

```bash
# 1. Create a service account
gcloud iam service-accounts create github-actions \
    --display-name="GitHub Actions Deploy"

# 2. Get the service account email
SA_EMAIL=$(gcloud iam service-accounts list \
    --filter="displayName:GitHub Actions Deploy" \
    --format='value(email)')

# 3. Grant necessary permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/cloudfunctions.developer"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/iam.serviceAccountUser"

# 4. Create and download the key
gcloud iam service-accounts keys create github-actions-key.json \
    --iam-account=${SA_EMAIL}

# 5. Copy the entire content of github-actions-key.json
cat github-actions-key.json
```

**Add to GitHub:**
1. Go to: https://github.com/kobzevvv/candidates-video-answers/settings/secrets/actions
2. Click "New repository secret"
3. Name: `GCP_SA_KEY`
4. Value: Paste the entire JSON content
5. Click "Add secret"

**Important:** Delete the local key file after adding to GitHub:
```bash
rm github-actions-key.json
```

### 3. `OPENAI_API_KEY`
Your OpenAI API key (already set if evaluations work).

## 📋 Quick Setup Script

Run this script to set up everything:

```bash
#!/bin/bash

# Set your project ID
PROJECT_ID="your-project-id-here"

# Create service account
gcloud iam service-accounts create github-actions \
    --display-name="GitHub Actions Deploy" \
    --project=$PROJECT_ID

# Get service account email
SA_EMAIL=$(gcloud iam service-accounts list \
    --filter="displayName:GitHub Actions Deploy" \
    --format='value(email)' \
    --project=$PROJECT_ID)

echo "Service Account: $SA_EMAIL"

# Grant permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/cloudfunctions.developer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/iam.serviceAccountUser"

# Create key
gcloud iam service-accounts keys create github-actions-key.json \
    --iam-account=${SA_EMAIL} \
    --project=$PROJECT_ID

echo ""
echo "✅ Service account created!"
echo ""
echo "📋 Next steps:"
echo "1. Copy the content of github-actions-key.json"
echo "2. Add it as GCP_SA_KEY secret in GitHub"
echo "3. Add GCP_PROJECT_ID=$PROJECT_ID as another secret"
echo "4. Delete the local key file: rm github-actions-key.json"
```

## 🚀 How It Works

1. **Automatic Deployment**: Every push to `main` that changes Cloud Function code triggers deployment
2. **Manual Deployment**: You can also manually trigger deployment from Actions tab
3. **Region Selection**: Manual triggers allow choosing deployment region
4. **Function URL**: The workflow outputs the function URL after deployment

## 🔍 Monitoring Deployments

1. Go to: https://github.com/kobzevvv/candidates-video-answers/actions
2. Look for "Deploy Cloud Function" workflow runs
3. Click on a run to see deployment details
4. Check the summary for the function URL

## ⚠️ Important Notes

- The function is deployed with `--allow-unauthenticated` for easy access
- Make sure `OPENAI_API_KEY` is set in GitHub Secrets
- The function URL changes only if you change regions
- First deployment might take a few minutes

## 🧪 Testing After Deployment

The workflow automatically tests the function after deployment. You can also test manually:

```bash
# Get your function URL from the deployment summary
FUNCTION_URL="https://REGION-PROJECT.cloudfunctions.net/evaluate-candidate"

# Test the function
curl "${FUNCTION_URL}?candidate_id=test&interview_id=test&question=test&answer=test&gpt_model=gpt-3.5-turbo"
```