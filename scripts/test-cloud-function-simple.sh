#!/bin/bash

echo "🧪 Simple Cloud Function Test"
echo ""

if [ -z "$1" ]; then
    echo "Usage: ./test-cloud-function-simple.sh <CLOUD_FUNCTION_URL>"
    echo "Example: ./test-cloud-function-simple.sh https://us-central1-project.cloudfunctions.net/evaluate-candidate"
    exit 1
fi

CLOUD_FUNCTION_URL="$1"

echo "🔗 Testing: $CLOUD_FUNCTION_URL"
echo ""

# Test health endpoint
echo "📋 Testing /health endpoint..."
curl -s "${CLOUD_FUNCTION_URL}/health" | jq . || echo "Failed to get health status"

echo ""
echo "🧪 Testing evaluation endpoint..."

# Test with sample data
curl -X POST "${CLOUD_FUNCTION_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "candidate_id": "test-candidate",
    "interview_id": "test-interview",
    "question": "What is your experience with databases?",
    "answer": "I have 5 years experience with SQL and NoSQL databases",
    "gpt_model": "google/gemini-1.5-flash"
  }' \
  -s | jq . || echo "Failed to evaluate"