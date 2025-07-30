# 📋 How to Get GitHub Action Logs & Post Comments

## Method 1: GitHub UI (Easiest)

### Get Logs from Actions Tab
1. Go to: https://github.com/kobzevvv/candidates-video-answers/actions
2. Click on your workflow run
3. Click "evaluate" job
4. Expand "Run candidate evaluation" step
5. Use the "..." menu → "View raw logs" to download

### Post Summary as Comment
1. Copy the evaluation summary from logs
2. Go to any issue/PR
3. Paste the summary in a comment

## Method 2: GitHub CLI (Recommended)

### Install GitHub CLI
```bash
brew install gh
gh auth login
```

### Get Latest Run Logs
```bash
# View latest run
gh run list --workflow=evaluate-candidates.yml --limit=1

# Get run ID (first column from above)
gh run view RUN_ID

# Download logs
gh run view RUN_ID --log > evaluation-logs.txt

# Extract summary
grep -E "✅|⏭️|❌|📊|🏁|⏳|Evaluation Summary" evaluation-logs.txt
```

### Post as Issue Comment
```bash
# Create summary file
echo "# 🤖 Evaluation Results" > summary.md
echo "" >> summary.md
echo "## Summary" >> summary.md
echo '```' >> summary.md
grep -E "✅|⏭️|❌|📊|🏁|⏳" evaluation-logs.txt | tail -10 >> summary.md
echo '```' >> summary.md

# Post to issue
gh issue comment ISSUE_NUMBER --body-file summary.md
```

## Method 3: Use Our Scripts

### Interactive Script
```bash
cd ai-evaluation
./get-action-logs.sh
```
Choose option 3 to get logs and post as comment.

### API Script (with GitHub Token)
```bash
# Set your GitHub token
export GITHUB_TOKEN="your-token-here"

# Get latest run summary
node get-logs-api.js

# Get and comment on issue
node get-logs-api.js --comment ISSUE_NUMBER
```

## Method 4: New Workflow with Auto-Comment

I've created `evaluate-candidates-with-comment.yml` that:
- Runs evaluation
- Automatically posts results as comment
- Creates job summary

To use:
1. Go to Actions → "Evaluate Candidates (with Comment)"
2. Fill in "Issue/PR number to comment results"
3. Run workflow

## Example Comment Format

```markdown
# 🤖 AI Evaluation Results

**Date:** Thu Jan 30 2025
**GPT Model:** gpt-3.5-turbo
**Interview ID:** 688734e38fb4bc64261bffe0

## Summary Statistics
✅ Processed: 4
⏭️ Skipped: 0
❌ Errors: 0
📊 Total answers: 4
🏁 Evaluated answers: 4
⏳ Pending answers: 0
```

## Quick Commands Reference

```bash
# Watch live logs
gh run watch

# List recent runs
gh run list --workflow=evaluate-candidates.yml

# Get specific run
gh run view RUN_ID

# Download artifacts
gh run download RUN_ID

# Cancel running workflow
gh run cancel RUN_ID
```