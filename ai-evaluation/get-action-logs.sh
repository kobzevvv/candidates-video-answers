#!/bin/bash

# Script to get GitHub Action logs and optionally post as comment

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}📋 Get GitHub Action Logs${NC}"
echo ""

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo "GitHub CLI (gh) is not installed."
    echo "Install with: brew install gh"
    exit 1
fi

# Function to get latest run
get_latest_run() {
    local workflow_name="$1"
    gh run list --workflow="$workflow_name" --limit 1 --json databaseId,status,conclusion,name --jq '.[0]'
}

# Function to get run logs
get_run_logs() {
    local run_id="$1"
    echo "📥 Downloading logs for run $run_id..."
    
    # Get logs and save to file
    gh run view "$run_id" --log > "run-${run_id}-logs.txt"
    
    # Extract evaluation summary from logs
    echo "" > "run-${run_id}-summary.md"
    echo "# 🤖 GitHub Action Run Summary" >> "run-${run_id}-summary.md"
    echo "" >> "run-${run_id}-summary.md"
    echo "**Run ID:** $run_id" >> "run-${run_id}-summary.md"
    echo "**Date:** $(date)" >> "run-${run_id}-summary.md"
    echo "" >> "run-${run_id}-summary.md"
    
    # Extract key information
    echo "## Evaluation Results" >> "run-${run_id}-summary.md"
    echo '```' >> "run-${run_id}-summary.md"
    grep -E "✅|⏭️|❌|📊|🏁|⏳|Evaluation Summary" "run-${run_id}-logs.txt" | tail -20 >> "run-${run_id}-summary.md"
    echo '```' >> "run-${run_id}-summary.md"
    
    # Extract errors if any
    if grep -q "Error" "run-${run_id}-logs.txt"; then
        echo "" >> "run-${run_id}-summary.md"
        echo "## Errors Found" >> "run-${run_id}-summary.md"
        echo '```' >> "run-${run_id}-summary.md"
        grep -A2 -B2 "Error" "run-${run_id}-logs.txt" | head -50 >> "run-${run_id}-summary.md"
        echo '```' >> "run-${run_id}-summary.md"
    fi
    
    echo -e "${GREEN}✅ Logs saved to: run-${run_id}-logs.txt${NC}"
    echo -e "${GREEN}✅ Summary saved to: run-${run_id}-summary.md${NC}"
}

# Main menu
echo "What would you like to do?"
echo "1) Get logs from latest 'Evaluate Candidates' run"
echo "2) Get logs from specific run ID"
echo "3) Get logs and post as issue comment"
echo -n "Enter choice [1-3]: "
read choice

case $choice in
    1)
        echo ""
        latest_run=$(get_latest_run "evaluate-candidates.yml")
        run_id=$(echo "$latest_run" | jq -r '.databaseId')
        status=$(echo "$latest_run" | jq -r '.status')
        conclusion=$(echo "$latest_run" | jq -r '.conclusion')
        
        echo "Latest run: #$run_id"
        echo "Status: $status"
        echo "Conclusion: $conclusion"
        echo ""
        
        get_run_logs "$run_id"
        ;;
        
    2)
        echo -n "Enter run ID: "
        read run_id
        get_run_logs "$run_id"
        ;;
        
    3)
        echo -n "Enter run ID (or press Enter for latest): "
        read run_id
        
        if [ -z "$run_id" ]; then
            latest_run=$(get_latest_run "evaluate-candidates.yml")
            run_id=$(echo "$latest_run" | jq -r '.databaseId')
        fi
        
        get_run_logs "$run_id"
        
        echo ""
        echo -n "Enter issue number to comment on: "
        read issue_number
        
        echo ""
        echo "Posting summary to issue #$issue_number..."
        
        gh issue comment "$issue_number" --body-file "run-${run_id}-summary.md"
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Comment posted successfully!${NC}"
            echo "View at: https://github.com/kobzevvv/candidates-video-answers/issues/$issue_number"
        else
            echo "❌ Failed to post comment"
        fi
        ;;
        
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "You can also:"
echo "• View logs online: gh run view"
echo "• Watch live logs: gh run watch"
echo "• List all runs: gh run list --workflow=evaluate-candidates.yml"