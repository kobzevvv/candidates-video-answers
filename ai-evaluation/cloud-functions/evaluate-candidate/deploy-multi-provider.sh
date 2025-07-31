#!/bin/bash

# Deploy multi-provider version of the Cloud Function

echo "🚀 Deploying multi-provider evaluate-candidate Cloud Function..."

# Check if required environment variables are set
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ GITHUB_TOKEN environment variable is required"
    exit 1
fi

# Check for OpenAI API key (try both OPENAI_API_KEY_V2 and OPENAI_API_KEY)
if [ -z "$OPENAI_API_KEY" ] && [ -z "$OPENAI_API_KEY_V2" ]; then
    echo "⚠️  Warning: Neither OPENAI_API_KEY nor OPENAI_API_KEY_V2 is set. OpenAI provider will not work."
    read -p "Continue without OpenAI support? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Use V2 key if available, otherwise fall back to original
OPENAI_KEY="${OPENAI_API_KEY_V2:-$OPENAI_API_KEY}"

# Backup current index.js
if [ -f "index.js" ]; then
    echo "📦 Backing up current index.js to index.js.backup"
    cp index.js index.js.backup
fi

# Copy multi-provider version
echo "📝 Copying multi-provider version..."
cp index-multi-provider.js index.js

# Deploy the function
echo "☁️  Deploying to Google Cloud Functions..."
gcloud functions deploy evaluate-candidate \
    --gen2 \
    --runtime nodejs20 \
    --trigger-http \
    --allow-unauthenticated \
    --region us-central1 \
    --timeout 120s \
    --memory 512MB \
    --set-env-vars "GITHUB_TOKEN=$GITHUB_TOKEN,OPENAI_API_KEY=$OPENAI_KEY" \
    --entry-point evaluateCandidate

# Check deployment status
if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "📋 Function Details:"
    echo "   Name: evaluate-candidate"
    echo "   Region: us-central1"
    echo "   Providers: GitHub Models + OpenAI"
    echo ""
    echo "🔗 Function URL:"
    gcloud functions describe evaluate-candidate --gen2 --region us-central1 --format="value(serviceConfig.uri)"
else
    echo "❌ Deployment failed!"
    # Restore backup if deployment failed
    if [ -f "index.js.backup" ]; then
        echo "↩️  Restoring original index.js from backup"
        mv index.js.backup index.js
    fi
    exit 1
fi

echo ""
echo "🎉 Multi-provider support is now active!"
echo ""
echo "📖 Usage:"
echo "   - Auto mode: Will detect based on model name"
echo "   - GitHub Models: Use models like 'google/gemini-1.5-flash'"
echo "   - OpenAI: Use models like 'gpt-4o' or 'gpt-4o-mini'"
echo "   - Force provider: Add 'api_provider' parameter ('github' or 'openai')"