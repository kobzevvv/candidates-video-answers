#!/bin/bash

# You need to provide the Cloud Function URL as an argument
if [ -z "$1" ]; then
    echo "Usage: ./test-cloud-function-now.sh <CLOUD_FUNCTION_URL>"
    exit 1
fi

CLOUD_FUNCTION_URL="$1"

echo "🔍 Testing Cloud Function: $CLOUD_FUNCTION_URL"
echo ""

# Test health endpoint
echo "1️⃣ Testing /health endpoint..."
curl -s "${CLOUD_FUNCTION_URL}/health" | jq '.' || echo "Failed to parse JSON"

echo ""
echo "2️⃣ Testing with google/gemini-1.5-flash model..."
curl -X POST "${CLOUD_FUNCTION_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "candidate_id": "test-candidate",
    "interview_id": "test-interview", 
    "question": "Tell me about yourself",
    "answer": "I am a software engineer with 5 years of experience",
    "gpt_model": "google/gemini-1.5-flash"
  }' \
  -s | jq '.' || echo "Failed"

echo ""
echo "3️⃣ Testing with microsoft/phi-3.5 model..."
curl -X POST "${CLOUD_FUNCTION_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "candidate_id": "test-candidate",
    "interview_id": "test-interview",
    "question": "Tell me about yourself", 
    "answer": "I am a software engineer with 5 years of experience",
    "gpt_model": "microsoft/phi-3.5"
  }' \
  -s | jq '.' || echo "Failed"