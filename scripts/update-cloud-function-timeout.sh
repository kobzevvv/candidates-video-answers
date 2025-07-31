#!/bin/bash

echo "🔧 Updating Cloud Function timeout to 120 seconds..."

# Update the Cloud Function timeout
gcloud functions deploy evaluate-candidate \
  --timeout=120s \
  --region=us-central1 \
  --no-allow-unauthenticated

echo "✅ Cloud Function timeout updated to 120 seconds"
echo ""
echo "📝 Current configuration:"
gcloud functions describe evaluate-candidate --format="table(name,timeout,availableMemoryMb,maxInstances)"