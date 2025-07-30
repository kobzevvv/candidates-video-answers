#!/bin/bash

# Test the Cloud Function with a valid model
echo "Testing Cloud Function with valid model: google/gemini-1.5-flash"
echo "=========================================="

# Get the Cloud Function URL from environment
source .env
echo "Cloud Function URL: $CLOUD_FUNCTION_URL"

# Test with a simple evaluation request
curl -X POST "$CLOUD_FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "candidate_id": "test123",
    "interview_id": "interview123",
    "question": "Tell me about yourself",
    "answer": "I am a software engineer with 5 years of experience in web development.",
    "gpt_model": "google/gemini-1.5-flash"
  }' | jq .

echo -e "\n\nNow testing with the originally requested model (should fail):"
echo "=============================================================="

curl -X POST "$CLOUD_FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "candidate_id": "test123",
    "interview_id": "interview123", 
    "question": "Tell me about yourself",
    "answer": "I am a software engineer with 5 years of experience in web development.",
    "gpt_model": "microsoft/phi-3.5"
  }' | jq .