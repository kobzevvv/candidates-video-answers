# Candidate Evaluation Cloud Function

This Google Cloud Function evaluates candidate interview answers using GitHub Models (defaults to openai/gpt-4o-mini).

## Usage

### URL Parameters
- `candidate_id` (required): ID of the candidate
- `interview_id` (required): ID of the interview
- `question` (required): The interview question
- `answer` (required): The candidate's answer
- `gpt_model` (optional): GitHub Models model to use (defaults to 'openai/gpt-4o-mini')

### Example Request
```bash
curl "https://your-region-your-project.cloudfunctions.net/evaluate-candidate?candidate_id=123&interview_id=456&question=Tell%20me%20about%20yourself&answer=I%20am%20a%20software%20engineer...&gpt_model=openai/gpt-4o"
```

### Response Format
```json
{
  "candidate_id": "123",
  "interview_id": "456", 
  "timestamp": "2024-01-01T00:00:00.000Z",
  "evaluation": {
    "addressing": 8,
    "be_specific": 7,
    "openness": 9,
    "short_summary": "Well-structured answer with concrete examples"
  },
  "model_used": "openai/gpt-4o",
  "prompt_version": "1.0"
}
```

## Deployment

1. Set your GitHub Personal Access Token:
```bash
export GITHUB_TOKEN="your-github-pat-here"
```

2. Deploy to Google Cloud Functions:
```bash
npm run deploy
```

## Environment Variables
- `GITHUB_TOKEN`: Your GitHub Personal Access Token with 'repo' scope (required)