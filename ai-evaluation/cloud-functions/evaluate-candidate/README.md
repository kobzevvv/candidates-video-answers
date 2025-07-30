# Candidate Evaluation Cloud Function

This Google Cloud Function evaluates candidate interview answers using configurable OpenAI GPT models (defaults to GPT-3.5-turbo).

## Usage

### URL Parameters
- `candidate_id` (required): ID of the candidate
- `interview_id` (required): ID of the interview
- `question` (required): The interview question
- `answer` (required): The candidate's answer
- `gpt_model` (optional): GPT model to use (defaults to 'gpt-3.5-turbo')

### Example Request
```bash
curl "https://your-region-your-project.cloudfunctions.net/evaluate-candidate?candidate_id=123&interview_id=456&question=Tell%20me%20about%20yourself&answer=I%20am%20a%20software%20engineer...&gpt_model=gpt-4"
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
  "model_used": "gpt-4",
  "prompt_version": "1.0"
}
```

## Deployment

1. Set your OpenAI API key:
```bash
export OPENAI_API_KEY="your-api-key-here"
```

2. Deploy to Google Cloud Functions:
```bash
npm run deploy
```

## Environment Variables
- `OPENAI_API_KEY`: Your OpenAI API key (required)