const functions = require('@google-cloud/functions-framework');
const ModelClient = require('@azure-rest/ai-inference').default;
const { isUnexpected } = require('@azure-rest/ai-inference');
const { AzureKeyCredential } = require('@azure/core-auth');

// Initialize GitHub Models client
const token = process.env.GITHUB_TOKEN;
const endpoint = 'https://models.github.ai/inference';
const client = ModelClient(
  endpoint,
  new AzureKeyCredential(token)
);

// Load the evaluation prompt
const EVALUATION_PROMPT = `
Review candidate answer for the question in terms of these criteria:

1. **Addressing the Question** - How well the answer addresses the question and is relevant to it
2. **Specificity vs Generic Response** - Is it "blah-blah-blah: it's good to do good things" or opposite: specific, precise, insightful examples, professional vocabulary when words used in right context  
3. **Communication Approach** - Positiveness, open-mindedness, healthy self-challenging, understanding that world is complex and any "100% sure" could lead to missing signals

Scoring Scale: 1 — really bad, 10 — perfect

Return your evaluation in JSON format:
{
  "addressing": [score 1-10],
  "be_specific": [score 1-10], 
  "openness": [score 1-10],
  "short_summary": "[Brief summary of the candidate's answer quality and approach]"
}
`;

functions.http('evaluateCandidate', async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    // Extract parameters from URL
    const candidateId = req.query.candidate_id || req.body?.candidate_id;
    const interviewId = req.query.interview_id || req.body?.interview_id;
    const question = req.query.question || req.body?.question;
    const answer = req.query.answer || req.body?.answer;
    const gptModel = req.query.gpt_model || req.body?.gpt_model || 'openai/gpt-4o-mini';

    // Validate required parameters
    if (!candidateId || !interviewId) {
      return res.status(400).json({
        error: 'Missing required parameters: candidate_id and interview_id are required'
      });
    }

    if (!question || !answer) {
      return res.status(400).json({
        error: 'Missing required parameters: question and answer are required'
      });
    }

    // Prepare the evaluation request
    const evaluationRequest = `
${EVALUATION_PROMPT}

**Question:** ${question}

**Candidate Answer:** ${answer}

Please evaluate this answer according to the criteria above.
`;

    // Call GitHub Models API
    const response = await client.path('/chat/completions').post({
      body: {
        model: gptModel,
        messages: [
          {
            role: 'system',
            content: 'You are an expert interviewer evaluating candidate responses. Return only valid JSON.'
          },
          {
            role: 'user',
            content: evaluationRequest
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }
    });

    if (isUnexpected(response)) {
      throw response.body.error;
    }

    const evaluationResult = JSON.parse(response.body.choices[0].message.content);

    // Add metadata to the response
    const finalResponse = {
      candidate_id: candidateId,
      interview_id: interviewId,
      timestamp: new Date().toISOString(),
      evaluation: evaluationResult,
      model_used: gptModel,
      prompt_version: '1.0'
    };

    res.json(finalResponse);

  } catch (error) {
    console.error('Error evaluating candidate:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});