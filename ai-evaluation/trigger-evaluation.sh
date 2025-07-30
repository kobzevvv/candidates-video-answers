#!/bin/bash

# Script to trigger the GitHub Action for candidate evaluation

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 Trigger Candidate Evaluation GitHub Action${NC}"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "GitHub CLI (gh) is not installed."
    echo "Install it with: brew install gh"
    echo "Or visit: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "You need to authenticate with GitHub"
    gh auth login
fi

echo "What would you like to evaluate?"
echo "1) All candidates for a position"
echo "2) Specific interview"
echo -n "Enter choice [1-2]: "
read choice

case $choice in
    1)
        echo -n "Enter Position ID: "
        read POSITION_ID
        
        echo ""
        echo "Select GPT Model:"
        echo "1) gpt-3.5-turbo (faster, cheaper)"
        echo "2) gpt-4 (better quality)"
        echo "3) gpt-4-turbo (best quality)"
        echo -n "Enter choice [1-3] (default: 1): "
        read model_choice
        
        case $model_choice in
            2) GPT_MODEL="gpt-4";;
            3) GPT_MODEL="gpt-4-turbo";;
            *) GPT_MODEL="gpt-3.5-turbo";;
        esac
        
        echo ""
        echo -n "Skip already evaluated answers? (y/N): "
        read skip_choice
        
        if [[ $skip_choice =~ ^[Yy]$ ]]; then
            SKIP_EVALUATED="true"
        else
            SKIP_EVALUATED="false"
        fi
        
        echo ""
        echo -e "${GREEN}Triggering evaluation for position ${POSITION_ID}${NC}"
        echo "GPT Model: ${GPT_MODEL}"
        echo "Skip evaluated: ${SKIP_EVALUATED}"
        echo ""
        
        gh workflow run evaluate-candidates.yml \
            -f position_id="${POSITION_ID}" \
            -f gpt_model="${GPT_MODEL}" \
            -f skip_evaluated="${SKIP_EVALUATED}"
        ;;
        
    2)
        echo -n "Enter Interview ID: "
        read INTERVIEW_ID
        
        echo ""
        echo "Select GPT Model:"
        echo "1) gpt-3.5-turbo (faster, cheaper)"
        echo "2) gpt-4 (better quality)"
        echo "3) gpt-4-turbo (best quality)"
        echo -n "Enter choice [1-3] (default: 1): "
        read model_choice
        
        case $model_choice in
            2) GPT_MODEL="gpt-4";;
            3) GPT_MODEL="gpt-4-turbo";;
            *) GPT_MODEL="gpt-3.5-turbo";;
        esac
        
        echo ""
        echo -e "${GREEN}Triggering evaluation for interview ${INTERVIEW_ID}${NC}"
        echo "GPT Model: ${GPT_MODEL}"
        echo ""
        
        gh workflow run evaluate-candidates.yml \
            -f interview_id="${INTERVIEW_ID}" \
            -f gpt_model="${GPT_MODEL}"
        ;;
        
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Workflow triggered successfully!${NC}"
    echo ""
    echo "View the run at:"
    echo -e "${YELLOW}https://github.com/kobzevvv/candidates-video-answers/actions${NC}"
    echo ""
    echo "Or watch the logs with:"
    echo "gh run watch"
else
    echo ""
    echo "❌ Failed to trigger workflow"
fi