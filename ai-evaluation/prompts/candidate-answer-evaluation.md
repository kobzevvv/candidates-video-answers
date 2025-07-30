# Candidate Answer Evaluation Prompt

Review candidate answer for the question in terms of these criteria:

## Evaluation Criteria

1. **Addressing the Question** - How well the answer addresses the question and is relevant to it
2. **Specificity vs Generic Response** - Is it "blah-blah-blah: it's good to do good things" or opposite: specific, precise, insightful examples, professional vocabulary when words used in right context
3. **Communication Approach** - Positiveness, open-mindedness, healthy self-challenging, understanding that world is complex and any "100% sure" could lead to missing signals

## Scoring Scale
1 — really bad, 10 — perfect

## Response Format
Return your evaluation in JSON format with the following structure:

```json
{
  "addressing": [score 1-10],
  "be_specific": [score 1-10], 
  "openness": [score 1-10],
  "short_summary": "[Brief summary of the candidate's answer quality and approach]"
}
```

## Example Response
```json
{
  "addressing": 7,
  "be_specific": 6,
  "openness": 10,
  "short_summary": "Know nothing about crocodiles, but completely aware and don't show off like an expert"
}
```

## Model Configuration
- Model: GPT-3.5-turbo
- Format: JSON
- Temperature: 0.3 (for consistent evaluation)