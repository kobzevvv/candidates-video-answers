# Migration Guide: Google Cloud Functions to Cloudflare Workers

## 📋 Table of Contents
1. [Executive Summary](#executive-summary)
2. [Current Architecture Analysis](#current-architecture-analysis)
3. [Cloudflare Workers Overview](#cloudflare-workers-overview)
4. [Migration Challenges & Solutions](#migration-challenges--solutions)
5. [Step-by-Step Setup Guide](#step-by-step-setup-guide)
6. [Credential Management](#credential-management)
7. [Cost Analysis](#cost-analysis)
8. [Performance Comparison](#performance-comparison)
9. [Risk Assessment](#risk-assessment)

## Executive Summary

### Why Migrate?
- **Current Issue**: Google Cloud Function timeouts (60s) when calling GitHub Models API
- **Root Cause**: Likely cold starts + network latency from GCP to GitHub
- **Solution**: Cloudflare Workers with near-zero cold starts and global edge network

### Key Benefits
✅ **Near-instant cold starts** (< 5ms vs GCP's 1-5s)
✅ **Global edge network** (runs closer to users AND GitHub API)
✅ **Lower latency** (edge locations worldwide)
✅ **Better free tier** (100k requests/day vs GCP's limited free tier)
✅ **Simpler deployment** (no complex GCP setup)

### Key Challenges
❌ **No Node.js modules** (must rewrite using Web APIs)
❌ **CPU time limits** (10-50ms per request)
❌ **Different debugging** (no traditional logs)
❌ **Learning curve** (different paradigm)

## Current Architecture Analysis

### What We Have (Google Cloud Functions)
```javascript
// Current dependencies
- @google-cloud/functions-framework
- @azure-rest/ai-inference
- @azure/core-auth

// Current flow
1. HTTP request → Cloud Function
2. Parse request body
3. Initialize Azure AI client
4. Call GitHub Models API
5. Return evaluation
```

### Pain Points
1. **Cold Starts**: Even with min_instances=1, still seeing timeouts
2. **Network Latency**: GCP → GitHub Models API
3. **Complex Setup**: GCP authentication, deployment, monitoring
4. **Cost**: Keeping instances warm is expensive

## Cloudflare Workers Overview

### Architecture Differences

| Feature | Google Cloud Functions | Cloudflare Workers |
|---------|----------------------|-------------------|
| Runtime | Node.js | V8 Isolates |
| Cold Start | 1-5 seconds | < 5ms |
| CPU Time | 540s max | 10-50ms |
| Memory | 1GB | 128MB |
| Network | Regional | Global Edge |
| Pricing | Per compute time | Per request |
| Dependencies | NPM packages | Web APIs only |

### How Workers Solve Our Problem
1. **No Cold Starts**: V8 isolates are always warm
2. **Edge Network**: Runs physically closer to GitHub API
3. **Faster Network**: Cloudflare's backbone vs public internet
4. **Request Coalescing**: Can cache API responses at edge

## Migration Challenges & Solutions

### Challenge 1: No Node.js Dependencies
**Problem**: Can't use `@azure-rest/ai-inference`
**Solution**: Use native fetch API

```javascript
// Before (Node.js)
const ModelClient = require('@azure-rest/ai-inference').default;
const client = ModelClient(endpoint, new AzureKeyCredential(token));
const response = await client.path('/chat/completions').post({...});

// After (Workers)
const response = await fetch('https://models.github.ai/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({...})
});
```

### Challenge 2: CPU Time Limits
**Problem**: 10ms limit on free tier (50ms paid)
**Solution**: 
- API calls don't count toward CPU time
- Our processing is minimal (just forwarding)
- Should easily fit within limits

### Challenge 3: Environment Variables
**Problem**: Different env var handling
**Solution**: Use wrangler secrets

```bash
# GCP
gcloud functions deploy --set-env-vars KEY=value

# Cloudflare
wrangler secret put GITHUB_TOKEN
```

### Challenge 4: Logging & Debugging
**Problem**: No console.log to cloud logs
**Solution**: 
- Use `wrangler tail` for real-time logs
- Implement custom logging to external service
- Use Cloudflare Analytics

### Challenge 5: Request/Response Size
**Problem**: Workers have size limits
**Solution**: Our payloads are small (< 1MB), well within limits

## Step-by-Step Setup Guide

### Prerequisites
1. Cloudflare account (free)
2. Node.js installed locally
3. Git repository access

### Step 1: Install Wrangler CLI
```bash
npm install -g wrangler
```

### Step 2: Authenticate with Cloudflare
```bash
wrangler login
# This opens browser for authentication
```

### Step 3: Create Worker Project
```bash
mkdir cloudflare-workers
cd cloudflare-workers
mkdir evaluate-candidate
cd evaluate-candidate
```

### Step 4: Create Worker Code
Create `index.js`:
```javascript
export default {
  async fetch(request, env, ctx) {
    // Enable CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (new URL(request.url).pathname === '/health') {
      return Response.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        hasToken: !!env.GITHUB_TOKEN
      }, { headers: corsHeaders });
    }

    try {
      // Parse request
      const data = await request.json();
      const { candidate_id, interview_id, question, answer, gpt_model = 'openai/gpt-4o-mini' } = data;

      // Validate
      if (!candidate_id || !interview_id || !question || !answer) {
        return Response.json({
          error: 'Missing required parameters'
        }, { status: 400, headers: corsHeaders });
      }

      // Call GitHub Models API
      const apiResponse = await fetch('https://models.github.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: gpt_model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert interviewer evaluating candidate responses. Return only valid JSON.'
            },
            {
              role: 'user',
              content: `[Evaluation prompt here...]`
            }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
      });

      if (!apiResponse.ok) {
        throw new Error(`API error: ${apiResponse.status}`);
      }

      const result = await apiResponse.json();
      const evaluation = JSON.parse(result.choices[0].message.content);

      return Response.json({
        candidate_id,
        interview_id,
        timestamp: new Date().toISOString(),
        evaluation,
        model_used: gpt_model,
        prompt_version: '1.0'
      }, { headers: corsHeaders });

    } catch (error) {
      return Response.json({
        error: 'Internal server error',
        message: error.message
      }, { status: 500, headers: corsHeaders });
    }
  }
};
```

### Step 5: Create Configuration
Create `wrangler.toml`:
```toml
name = "evaluate-candidate"
main = "index.js"
compatibility_date = "2024-01-01"

[env.production]
name = "evaluate-candidate-prod"

[[env.production.routes]]
pattern = "evaluate-api.yourdomain.com/*"
zone_name = "yourdomain.com"

# Or use workers.dev subdomain
# [[env.production.routes]]
# pattern = "evaluate-candidate.yoursubdomain.workers.dev/*"
```

### Step 6: Set Secrets
```bash
# Set GitHub token
wrangler secret put GITHUB_TOKEN
# Paste your GitHub token when prompted
```

### Step 7: Deploy
```bash
# Development
wrangler dev

# Production
wrangler deploy --env production
```

### Step 8: Update Your Application
```javascript
// In your evaluation scripts
const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || process.env.CLOUD_FUNCTION_URL;
```

## Credential Management

### Required Credentials

#### 1. Cloudflare API Token
**Where to get**: https://dash.cloudflare.com/profile/api-tokens
**Permissions needed**: 
- Account: Cloudflare Workers Scripts:Edit
- Zone: Zone:Read (if using custom domain)

**Where to store**:
- GitHub Secrets: `CLOUDFLARE_API_TOKEN`
- Local: `~/.wrangler/config/default.toml` (auto-created by wrangler login)

#### 2. GitHub Token (for Models API)
**Where to get**: https://github.com/settings/tokens
**Permissions needed**: `read:project`

**Where to store**:
- Cloudflare: `wrangler secret put GITHUB_TOKEN`
- Never commit to code!

#### 3. Custom Domain (Optional)
**Where to get**: Your domain registrar
**Setup**: 
1. Add domain to Cloudflare
2. Update DNS settings
3. Configure in wrangler.toml

### Environment Variable Mapping

| Variable | Google Cloud Function | Cloudflare Workers | Where to Set |
|----------|---------------------|-------------------|--------------|
| GITHUB_TOKEN | Process env | Worker env | wrangler secret |
| CLOUD_FUNCTION_URL | GitHub Secret | - | Remove |
| CLOUDFLARE_WORKER_URL | - | GitHub Secret | Add new |

## Cost Analysis

### Google Cloud Functions (Current)
- **Compute**: $0.40 per million GB-seconds
- **Requests**: $0.40 per million
- **Min instances**: ~$5-10/month to keep warm
- **Estimated**: $10-20/month for low traffic

### Cloudflare Workers (Proposed)
- **Free tier**: 100,000 requests/day
- **Paid**: $5/month for 10M requests
- **No charge** for keeping warm
- **Estimated**: $0-5/month

**Savings**: 50-100% reduction in costs

## Performance Comparison

### Expected Improvements

| Metric | GCP (Current) | CF Workers (Expected) | Improvement |
|--------|--------------|---------------------|-------------|
| Cold Start | 1-5s | <5ms | 1000x |
| P50 Latency | 45s | 2-5s | 9x |
| P99 Latency | 60s+ | 10s | 6x |
| Timeout Rate | High | Low | - |
| Global Performance | Regional | Excellent | - |

### Why Such Big Improvements?
1. **No Container Spin-up**: V8 isolates vs Docker
2. **Edge Network**: 300+ locations vs single region
3. **Network Path**: CF backbone vs public internet
4. **No Framework Overhead**: Pure JS vs Node.js layers

## Risk Assessment

### Low Risk ✅
1. **Functionality**: Same API interface
2. **Reliability**: Cloudflare's 99.99% uptime
3. **Rollback**: Can switch back via URL change

### Medium Risk ⚠️
1. **Learning Curve**: New platform and tools
2. **Debugging**: Different from traditional Node.js
3. **Feature Parity**: Some Node.js features unavailable

### Mitigation Strategies
1. **Gradual Migration**: Run both in parallel
2. **A/B Testing**: Route % of traffic to Workers
3. **Monitoring**: Set up proper alerting
4. **Documentation**: Document all differences

## Migration Timeline

### Phase 1: Proof of Concept (1-2 days)
- [ ] Set up Cloudflare account
- [ ] Create minimal Worker
- [ ] Test with one evaluation
- [ ] Compare performance

### Phase 2: Full Implementation (2-3 days)
- [ ] Port all functionality
- [ ] Add error handling
- [ ] Implement logging
- [ ] Set up monitoring

### Phase 3: Testing (2-3 days)
- [ ] Load testing
- [ ] Error scenario testing
- [ ] Performance benchmarking
- [ ] A/B testing setup

### Phase 4: Migration (1 day)
- [ ] Update GitHub Secrets
- [ ] Deploy to production
- [ ] Monitor closely
- [ ] Keep GCP as fallback

## Conclusion

Migrating to Cloudflare Workers should solve the timeout issues by:
1. Eliminating cold starts
2. Reducing network latency
3. Improving global performance
4. Reducing costs

The main challenge is rewriting without Node.js dependencies, but our use case (API proxy with light processing) is perfect for Workers.

**Recommendation**: Proceed with Phase 1 proof of concept to validate performance improvements before full migration.