# Cloudflare Workers Quick Start Guide

## 🚀 5-Minute Setup

### 1. Create Cloudflare Account
1. Go to https://cloudflare.com
2. Sign up (free)
3. Verify email

### 2. Get Your Credentials

#### Cloudflare API Token
1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use template: "Edit Cloudflare Workers"
4. Copy token to safe place

#### GitHub Token (Already Have)
- Use same token as Google Cloud Function
- Or create new: https://github.com/settings/tokens
- Needs: `read:project` scope

### 3. Quick Setup Commands
```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create project
mkdir cloudflare-evaluate && cd cloudflare-evaluate

# Create files (copy from migration guide)
touch index.js wrangler.toml

# Set GitHub Token
wrangler secret put GITHUB_TOKEN
# Paste token when prompted

# Test locally
wrangler dev

# Deploy to production
wrangler deploy
```

### 4. Update GitHub Secrets
Add to your repo secrets:
- `CLOUDFLARE_API_TOKEN`: Your API token from step 2
- `CLOUDFLARE_WORKER_URL`: The URL after deploy (e.g., https://evaluate-candidate.username.workers.dev)

### 5. Test It
```bash
curl -X POST https://your-worker.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "candidate_id": "test",
    "interview_id": "test",
    "question": "Test question?",
    "answer": "Test answer",
    "gpt_model": "openai/gpt-4o-mini"
  }'
```

## 🔑 Credential Checklist

| What | Where to Get | Where to Put | Notes |
|------|--------------|--------------|-------|
| Cloudflare Account | cloudflare.com | - | Free signup |
| CF API Token | dash.cloudflare.com/profile/api-tokens | GitHub Secrets: `CLOUDFLARE_API_TOKEN` | "Edit Workers" template |
| GitHub Token | github.com/settings/tokens | `wrangler secret put GITHUB_TOKEN` | read:project scope |
| Worker URL | After `wrangler deploy` | GitHub Secrets: `CLOUDFLARE_WORKER_URL` | Auto-generated |

## 🎯 Common Issues & Solutions

### "wrangler: command not found"
```bash
npm install -g wrangler
```

### "Authentication required"
```bash
wrangler login
```

### "Secret not found"
```bash
wrangler secret put GITHUB_TOKEN
```

### "Worker throws 500 error"
```bash
# Check logs
wrangler tail

# Common fix: Set GITHUB_TOKEN secret
```

## 📊 Performance Test
After deployment, run:
```bash
# From ai-evaluation directory
CLOUDFLARE_WORKER_URL=https://your-worker.workers.dev \
node test-cloud-function-performance.js
```

Compare with Google Cloud Function results!

## 🔄 Switching Between Services
In your `.env`:
```bash
# Use Cloudflare (faster)
EVALUATION_URL=https://your-worker.workers.dev

# Or use Google Cloud (fallback)
EVALUATION_URL=https://your-function.cloudfunctions.net/evaluate-candidate
```

Your code automatically uses whichever is set!