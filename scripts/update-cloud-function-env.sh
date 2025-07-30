#!/bin/bash

# Script to update Cloud Function environment variables

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Cloud Function Environment Variable Updater${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Error: gcloud CLI is not installed${NC}"
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
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
if [ -z "$GITHUB_TOKEN" ] && [ -z "$PAT_GIT_HUB" ]; then
    echo -e "${YELLOW}⚠️  No GitHub token found in environment${NC}"
    echo -n "Please enter your GitHub Personal Access Token: "
    read -s GITHUB_TOKEN
    echo ""
else
    GITHUB_TOKEN="${GITHUB_TOKEN:-$PAT_GIT_HUB}"
    echo -e "${GREEN}✅ GitHub token found in environment${NC}"
fi

# Validate GitHub token exists
if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}❌ GitHub token is required${NC}"
    exit 1
fi

# Get function region
echo ""
echo "Which region is your Cloud Function deployed in?"
echo "1) us-central1 (Iowa)"
echo "2) us-east1 (South Carolina)"
echo "3) europe-west1 (Belgium)"
echo "4) asia-northeast1 (Tokyo)"
echo -n "Enter choice [1-4]: "
read choice

case $choice in
    2) REGION="us-east1";;
    3) REGION="europe-west1";;
    4) REGION="asia-northeast1";;
    *) REGION="us-central1";;
esac

echo -e "${GREEN}📍 Using region: ${REGION}${NC}"

# Update the function
echo ""
echo -e "${GREEN}🔄 Updating Cloud Function environment variables...${NC}"

gcloud functions deploy evaluate-candidate \
    --update-env-vars GITHUB_TOKEN="${GITHUB_TOKEN}" \
    --region ${REGION} \
    --project ${PROJECT_ID}

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Cloud Function updated successfully!${NC}"
    
    # Get the function URL
    FUNCTION_URL=$(gcloud functions describe evaluate-candidate --region ${REGION} --format 'value(httpsTrigger.url)')
    
    echo ""
    echo -e "${GREEN}🧪 Testing the updated function...${NC}"
    
    # Test the health endpoint
    HEALTH_RESPONSE=$(curl -s "${FUNCTION_URL}/health")
    echo "Health check response: $HEALTH_RESPONSE"
    
    if echo "$HEALTH_RESPONSE" | grep -q '"hasToken":true'; then
        echo -e "${GREEN}✅ GITHUB_TOKEN is now properly configured!${NC}"
    else
        echo -e "${YELLOW}⚠️  Warning: Health check didn't confirm token presence${NC}"
    fi
else
    echo ""
    echo -e "${RED}❌ Update failed${NC}"
    echo "Please check the error messages above"
    exit 1
fi