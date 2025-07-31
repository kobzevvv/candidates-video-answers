const functions = require('@google-cloud/functions-framework');
const ModelClient = require('@azure-rest/ai-inference').default;
const { isUnexpected } = require('@azure-rest/ai-inference');
const { AzureKeyCredential } = require('@azure/core-auth');
const axios = require('axios');

// Initialize API clients
const githubToken = process.env.GITHUB_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;
const githubEndpoint = 'https://models.github.ai/inference';

// Check tokens
if (!githubToken && !openaiApiKey) {
  console.error('Neither GITHUB_TOKEN nor OPENAI_API_KEY environment variables are set');
}

// GitHub Models client
const githubClient = githubToken ? ModelClient(
  githubEndpoint,
  new AzureKeyCredential(githubToken)
) : null;

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

// Helper function to call OpenAI API directly
async function callOpenAIAPI(gptModel, evaluationRequest) {
  const openAIModel = gptModel.startsWith('openai/') ? gptModel.replace('openai/', '') : gptModel;
  
  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: openAIModel,
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
  }, {
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });

  return {
    body: {
      choices: [{
        message: {
          content: response.data.choices[0].message.content
        }
      }]
    }
  };
}

// Helper function to determine which API to use
function getAPIProvider(gptModel) {
  // If model starts with 'openai/' or user specified OpenAI models directly
  if (gptModel.startsWith('openai/') || 
      ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini'].includes(gptModel)) {
    return 'openai';
  }
  // Default to GitHub Models for everything else
  return 'github';
}

functions.http('evaluateCandidate', async (req, res) => {
  const requestStartTime = Date.now();
  console.log(`[${new Date().toISOString()}] Request received - Method: ${req.method}`);
  
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Health check endpoint
  if (req.path === '/health' || req.url === '/health') {
    return res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      hasGitHubToken: !!githubToken,
      hasOpenAIKey: !!openaiApiKey,
      uptime: process.uptime()
    });
  }

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    // Extract parameters
    const candidateId = req.query.candidate_id || req.body?.candidate_id;
    const interviewId = req.query.interview_id || req.body?.interview_id;
    const question = req.query.question || req.body?.question;
    const answer = req.query.answer || req.body?.answer;
    const gptModel = req.query.gpt_model || req.body?.gpt_model || 'google/gemini-1.5-flash';
    const apiProvider = req.query.api_provider || req.body?.api_provider || getAPIProvider(gptModel);
    
    console.log(`[${new Date().toISOString()}] Request params - Model: ${gptModel}, Provider: ${apiProvider}, Candidate: ${candidateId}, Interview: ${interviewId}`);

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

    // Check if appropriate credentials are available
    if (apiProvider === 'openai' && !openaiApiKey) {
      return res.status(500).json({
        error: 'Service configuration error',
        message: 'OPENAI_API_KEY is not configured for OpenAI provider.'
      });
    }

    if (apiProvider === 'github' && !githubClient) {
      return res.status(500).json({
        error: 'Service configuration error',
        message: 'GITHUB_TOKEN is not configured for GitHub Models provider.'
      });
    }

    // Prepare the evaluation request
    const evaluationRequest = `
${EVALUATION_PROMPT}

**Question:** ${question}

**Candidate Answer:** ${answer}

Please evaluate this answer according to the criteria above.
`;

    // Call appropriate API based on provider
    console.log(`[${new Date().toISOString()}] Calling ${apiProvider} API with model: ${gptModel}`);
    console.log(`[${new Date().toISOString()}] Question length: ${question.length}, Answer length: ${answer.length}`);
    
    const apiStartTime = Date.now();
    let response;
    
    if (apiProvider === 'openai') {
      response = await callOpenAIAPI(gptModel, evaluationRequest);
    } else {
      // GitHub Models API
      response = await githubClient.path('/chat/completions').post({
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
        },
        requestOptions: {
          timeout: 30000
        }
      });

      if (isUnexpected(response)) {
        console.error(`[${new Date().toISOString()}] API returned unexpected response:`, response.body);
        throw response.body.error;
      }
    }

    const apiDuration = Date.now() - apiStartTime;
    console.log(`[${new Date().toISOString()}] API response received in ${apiDuration}ms`);

    const evaluationResult = JSON.parse(response.body.choices[0].message.content);

    // Add metadata to the response
    const finalResponse = {
      candidate_id: candidateId,
      interview_id: interviewId,
      timestamp: new Date().toISOString(),
      evaluation: evaluationResult,
      model_used: gptModel,
      api_provider: apiProvider,
      prompt_version: '1.0'
    };

    const totalDuration = Date.now() - requestStartTime;
    console.log(`[${new Date().toISOString()}] Request completed successfully in ${totalDuration}ms`);
    
    res.json(finalResponse);

  } catch (error) {
    const totalDuration = Date.now() - requestStartTime;
    console.error(`[${new Date().toISOString()}] Error after ${totalDuration}ms:`, error);
    
    // Enhanced error handling for different providers
    let errorMessage = error.message;
    let errorDetails = {};
    
    if (error.response) {
      // Axios error (OpenAI)
      errorDetails = {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      };
      
      if (error.response.status === 429) {
        errorMessage = 'Rate limit exceeded';
        if (error.response.headers) {
          errorDetails.rateLimitHeaders = {
            limit: error.response.headers['x-ratelimit-limit'],
            remaining: error.response.headers['x-ratelimit-remaining'],
            reset: error.response.headers['x-ratelimit-reset']
          };
        }
      }
    }
    
    console.error(`[${new Date().toISOString()}] Error details:`, errorDetails);
    
    res.status(error.response?.status || 500).json({
      error: 'Internal server error',
      message: errorMessage,
      details: errorDetails,
      duration: totalDuration
    });
  }
});