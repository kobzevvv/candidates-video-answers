#!/bin/bash

# Google Cloud Function deployment script for evaluate-candidate

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying Candidate Evaluation Cloud Function${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Error: gcloud CLI is not installed${NC}"
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo -e "${YELLOW}⚠️  You need to authenticate with Google Cloud${NC}"
    echo "Running: gcloud auth login"
    gcloud auth login
fi

# Get current project
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ No Google Cloud project is set${NC}"
    echo "Please run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo -e "${GREEN}📋 Current project: ${PROJECT_ID}${NC}"

# Check for GitHub token
if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  GITHUB_TOKEN environment variable is not set${NC}"
    echo -n "Please enter your GitHub Personal Access Token: "
    read -s GITHUB_TOKEN
    echo ""
fi

# Validate GitHub token exists
if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}❌ GitHub token is required${NC}"
    echo "Create a PAT with 'repo' scope at: https://github.com/settings/tokens"
    exit 1
fi

# Region selection
echo ""
echo "Select region for deployment:"
echo "1) us-central1 (Iowa)"
echo "2) us-east1 (South Carolina)"
echo "3) europe-west1 (Belgium)"
echo "4) asia-northeast1 (Tokyo)"
echo -n "Enter choice [1-4] (default: 1): "
read choice

case $choice in
    2) REGION="us-east1";;
    3) REGION="europe-west1";;
    4) REGION="asia-northeast1";;
    *) REGION="us-central1";;
esac

echo -e "${GREEN}📍 Deploying to region: ${REGION}${NC}"

# Deploy the function
echo ""
echo -e "${GREEN}🔄 Deploying Cloud Function...${NC}"

gcloud functions deploy evaluate-candidate \
    --runtime nodejs20 \
    --trigger-http \
    --allow-unauthenticated \
    --entry-point evaluateCandidate \
    --region ${REGION} \
    --timeout 540s \
    --memory 512MB \
    --min-instances 1 \
    --max-instances 15 \
    --set-env-vars GITHUB_TOKEN="${GITHUB_TOKEN}" \
    --project ${PROJECT_ID}

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    
    # Get the function URL
    FUNCTION_URL=$(gcloud functions describe evaluate-candidate --region ${REGION} --format 'value(httpsTrigger.url)')
    
    echo ""
    echo -e "${GREEN}🔗 Cloud Function URL:${NC}"
    echo -e "${YELLOW}${FUNCTION_URL}${NC}"
    echo ""
    echo -e "${GREEN}📝 Add this to your GitHub Secrets as CLOUD_FUNCTION_URL:${NC}"
    echo "1. Go to: https://github.com/kobzevvv/candidates-video-answers/settings/secrets/actions"
    echo "2. Click 'New repository secret'"
    echo "3. Name: CLOUD_FUNCTION_URL"
    echo "4. Value: ${FUNCTION_URL}"
    echo ""
    echo -e "${GREEN}🧪 Test the function:${NC}"
    echo "curl '${FUNCTION_URL}?candidate_id=test&interview_id=test&question=Test&answer=Test&gpt_model=openai/gpt-4o-mini'"
else
    echo ""
    echo -e "${RED}❌ Deployment failed${NC}"
    echo "Please check the error messages above"
    exit 1
fi