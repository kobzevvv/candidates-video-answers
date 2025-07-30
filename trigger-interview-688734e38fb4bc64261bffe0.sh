#!/bin/bash

echo "🚀 Triggering evaluation for interview: 688734e38fb4bc64261bffe0"

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI not installed"
    echo ""
    echo "Please manually trigger at:"
    echo "https://github.com/kobzevvv/candidates-video-answers/actions/workflows/evaluate-candidates.yml"
    echo ""
    echo "Interview ID: 688734e38fb4bc64261bffe0"
    exit 1
fi

# Trigger the workflow
gh workflow run evaluate-candidates.yml \
    -f interview_id=688734e38fb4bc64261bffe0 \
    -f gpt_model=gpt-3.5-turbo

if [ $? -eq 0 ]; then
    echo "✅ Workflow triggered successfully!"
    echo ""
    echo "View progress at:"
    echo "https://github.com/kobzevvv/candidates-video-answers/actions"
    echo ""
    echo "Or watch logs with: gh run watch"
else
    echo "❌ Failed to trigger"
fi