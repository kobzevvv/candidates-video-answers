#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { InterviewDataModel, createTables } = require('../../ai-evaluation/data-model');

const CLOUD_FUNCTION_URL = process.env.CLOUD_FUNCTION_URL;
const RATE_LIMIT_DELAY = process.env.RATE_LIMIT_DELAY ? parseInt(process.env.RATE_LIMIT_DELAY) : 3000; // Default 3 seconds

const dataModel = new InterviewDataModel();

// Rate limit tracking
let totalRequests = 0;
let successfulRequests = 0;
let rateLimitErrors = 0;
let otherErrors = 0;
let requestTimes = [];

// Helper function to add delay between API calls
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to calculate requests per minute
function getRequestsPerMinute() {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  requestTimes = requestTimes.filter(time => time > oneMinuteAgo);
  return requestTimes.length;
}

async function evaluateAnswerWithRetry(candidateId, interviewId, question, answer, gptModel = 'google/gemini-1.5-flash', maxRetries = 3) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await evaluateAnswer(candidateId, interviewId, question, answer, gptModel);
      if (result) return result;
      
      // If we got null (evaluation failed), don't retry
      if (!lastError || !lastError.response || lastError.response.status !== 429) {
        return null;
      }
    } catch (error) {
      lastError = error;
    }
    
    // Check if it's a rate limit error
    if (lastError && lastError.response && lastError.response.status === 429) {
      if (attempt < maxRetries) {
        const backoffDelay = Math.min(30000, 5000 * Math.pow(2, attempt - 1)); // Exponential backoff: 5s, 10s, 20s
        console.log(`🔄 Rate limit hit. Retrying in ${backoffDelay}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await delay(backoffDelay);
      }
    } else {
      // For non-rate-limit errors, don't retry
      return null;
    }
  }
  
  console.error(`❌ Failed after ${maxRetries} attempts due to rate limits`);
  return null;
}

async function evaluateAnswer(candidateId, interviewId, question, answer, gptModel = 'google/gemini-1.5-flash') {
  try {
    totalRequests++;
    requestTimes.push(Date.now());
    const rpm = getRequestsPerMinute();
    console.log(`🌐 Calling Cloud Function: ${CLOUD_FUNCTION_URL}`);
    console.log(`📊 Rate limit status: ${rpm} requests/minute, Total: ${totalRequests}, Success: ${successfulRequests}, RateLimits: ${rateLimitErrors}`);
    const response = await axios.post(CLOUD_FUNCTION_URL, {
      candidate_id: candidateId,
      interview_id: interviewId,
      question: question,
      answer: answer,
      gpt_model: gptModel
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 240000 // 240 second timeout (4 minutes)
    });
    console.log(`✅ Cloud Function response received`);
    console.log(`📦 Response data:`, JSON.stringify(response.data, null, 2));
    successfulRequests++;
    return response.data;
  } catch (error) {
    console.error(`❌ Error evaluating answer for interview ${interviewId}:`);
    console.error(`   Error message: ${error.message}`);
    console.error(`   Error code: ${error.code}`);
    if (error.response) {
      console.error(`   HTTP Status: ${error.response.status}`);
      console.error(`   Response data:`, error.response.data);
      // Re-throw rate limit errors so retry logic can handle them
      if (error.response.status === 429) {
        rateLimitErrors++;
        console.error(`   ⚠️ RATE LIMIT HIT! Total rate limits: ${rateLimitErrors}`);
        
        // Extract rate limit headers if available
        const headers = error.response.headers;
        if (headers['x-ratelimit-limit']) {
          console.error(`   📊 Rate limit info:`);
          console.error(`      - Limit: ${headers['x-ratelimit-limit']}`);
          console.error(`      - Remaining: ${headers['x-ratelimit-remaining']}`);
          console.error(`      - Reset: ${new Date(parseInt(headers['x-ratelimit-reset']) * 1000).toISOString()}`);
        }
        throw error;
      }
      otherErrors++;
    }
    if (error.request) {
      console.error(`   Request failed - no response received`);
      console.error(`   Request config:`, {
        url: error.config?.url,
        method: error.config?.method,
        timeout: error.config?.timeout
      });
    }
    return null;
  }
}

async function saveEvaluationResult(result, outputDir) {
  const filename = `evaluation_${result.interview_id}_${Date.now()}.json`;
  const filepath = path.join(outputDir, filename);
  await fs.writeFile(filepath, JSON.stringify(result, null, 2));
  console.log(`✅ Saved evaluation result: ${filename}`);
}

async function main() {
  const [interviewId, gptModel = 'google/gemini-1.5-flash'] = process.argv.slice(2);
  
  if (!interviewId) {
    console.error('Usage: node evaluate-by-interview.js <interview_id> [gpt_model]');
    process.exit(1);
  }

  if (!CLOUD_FUNCTION_URL || !process.env.DATABASE_URL) {
    console.error('Missing required environment variables: CLOUD_FUNCTION_URL, DATABASE_URL');
    process.exit(1);
  }

  console.log(`🔗 Cloud Function URL: ${CLOUD_FUNCTION_URL}`);
  console.log(`🗄️ Database URL: ${process.env.DATABASE_URL ? '[SET]' : '[NOT SET]'}`);
  console.log(`🔑 OpenAI API Key: ${process.env.OPENAI_API_KEY ? '[SET]' : '[NOT SET]'}`);
  
  // Validate Cloud Function URL format
  if (!CLOUD_FUNCTION_URL.startsWith('http')) {
    console.error('❌ CLOUD_FUNCTION_URL must start with http:// or https://');
    process.exit(1);
  }

  const outputDir = './evaluation-results';
  await fs.mkdir(outputDir, { recursive: true });

  console.log(`🚀 Starting re-evaluation for interview: ${interviewId}`);
  console.log(`🤖 Using GPT model: ${gptModel}`);
  
  try {
    // Ensure tables exist
    await createTables();
    
    // Clear existing evaluations for this interview (always re-do for specific interviews)
    console.log('🔄 Clearing existing evaluations for re-processing...');
    await dataModel.clearEvaluations(null, interviewId);
    
    // Get all question-answer pairs for this interview from datamart
    const questionAnswers = await dataModel.getInterviewAnswers(interviewId);
    
    if (questionAnswers.length === 0) {
      console.error(`❌ No question-answer pairs found for interview ${interviewId}`);
      process.exit(1);
    }

    const firstAnswer = questionAnswers[0];
    const candidateInfo = `${firstAnswer.candidate_first_name} ${firstAnswer.candidate_last_name} (${firstAnswer.candidate_email})`;
    console.log(`👤 Candidate: ${candidateInfo}`);
    console.log(`📋 Found ${questionAnswers.length} question-answer pairs`);

    // Pre-flight rate limit check
    if (process.env.CHECK_RATE_LIMITS !== 'false') {
      console.log('\n🔍 Checking GitHub API rate limits before starting...');
      try {
        const { execSync } = require('child_process');
        execSync('node scripts/check-github-models-limits.js', { stdio: 'inherit' });
        console.log('\n✅ Rate limit check complete. Starting evaluation...\n');
      } catch (error) {
        console.warn('⚠️  Could not check rate limits, proceeding anyway...');
      }
    }

    let processedCount = 0;
    let errorCount = 0;
    let dynamicDelay = RATE_LIMIT_DELAY;
    console.log(`⏱️  Initial rate limit delay: ${RATE_LIMIT_DELAY}ms between requests`);

    for (let i = 0; i < questionAnswers.length; i++) {
      const qa = questionAnswers[i];
      const { 
        answer_id, 
        question_id, 
        question_title, 
        question_description,
        transcription_text,
        candidate_email
      } = qa;
      
      if (!transcription_text || !question_title) {
        console.log(`⚠️  Skipping incomplete Q&A: answer_id ${answer_id}`);
        continue;
      }

      // Use question_title as the main question, with description as context if available
      const questionText = question_description ? `${question_title}: ${question_description}` : question_title;

      console.log(`🔍 Re-evaluating answer ${answer_id} for question: "${question_title}"`);
      
      const evaluation = await evaluateAnswerWithRetry(candidate_email, interviewId, questionText, transcription_text, gptModel);
      console.log(`📊 Evaluation result:`, evaluation ? 'Received response' : 'No response');
      
      if (evaluation) {
        console.log(`📋 Response structure:`, {
          hasEvaluation: !!evaluation.evaluation,
          modelUsed: evaluation.model_used,
          promptVersion: evaluation.prompt_version,
          evaluationKeys: evaluation.evaluation ? Object.keys(evaluation.evaluation) : null
        });
      }
      
      if (evaluation && evaluation.evaluation) {
        console.log(`✅ Valid evaluation received for answer ${answer_id}`);
        // Save to datamart using answer_id
        await dataModel.updateEvaluationResults(answer_id, interviewId, question_id, evaluation.evaluation, evaluation.model_used);
        
        // Also save to file for backup
        await saveEvaluationResult({
          ...evaluation,
          answer_id: answer_id,
          question_id: question_id,
          question: questionText,
          answer: transcription_text
        }, outputDir);
        
        processedCount++;
      } else {
        console.log(`❌ Invalid or missing evaluation for answer ${answer_id}`);
        errorCount++;
      }
      
      // Add delay between requests to avoid rate limits (except for the last one)
      if (i < questionAnswers.length - 1) {
        // Adjust delay based on rate limit errors
        if (rateLimitErrors > 0) {
          dynamicDelay = Math.min(dynamicDelay * 1.5, 30000); // Increase delay up to 30s
          console.log(`⚠️  Adjusting delay to ${Math.round(dynamicDelay)}ms due to rate limits`);
        }
        console.log(`⏳ Waiting ${Math.round(dynamicDelay)}ms before next request...`);
        await delay(dynamicDelay);
      }
    }

    console.log('\n📈 Re-evaluation Summary:');
    console.log(`✅ Processed: ${processedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📁 Results saved to: ${outputDir}`);
    
    console.log('\n📊 API Request Statistics:');
    console.log(`   Total requests: ${totalRequests}`);
    console.log(`   Successful: ${successfulRequests}`);
    console.log(`   Rate limit errors: ${rateLimitErrors}`);
    console.log(`   Other errors: ${otherErrors}`);
    console.log(`   Final requests/minute: ${getRequestsPerMinute()}`);
    
    if (rateLimitErrors > 0) {
      console.log('\n⚠️  Rate Limit Recommendations:');
      console.log(`   - Encountered ${rateLimitErrors} rate limit errors`);
      console.log(`   - Consider increasing RATE_LIMIT_DELAY (current: ${RATE_LIMIT_DELAY}ms)`);
      console.log(`   - Or use a different model with higher limits`);
      console.log(`   - Check limits: node scripts/check-github-models-limits.js`);
    }
    
    // Exit with error if no evaluations succeeded
    if (processedCount === 0 && errorCount > 0) {
      console.error('\n❌ FAILED: All evaluations failed');
      process.exit(1);
    }
    
    // Exit with error if more than 50% failed
    const totalAttempts = processedCount + errorCount;
    const errorRate = errorCount / totalAttempts;
    if (errorRate > 0.5) {
      console.error(`\n❌ FAILED: Error rate too high (${(errorRate * 100).toFixed(1)}%)`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error during evaluation:', error);
    process.exit(1);
  }
}

main().catch(console.error);