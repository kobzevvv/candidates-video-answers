#!/usr/bin/env node

// Load .env file if it exists (for local development)
// GitHub Actions will provide these as environment variables directly
const path = require('path');
const fsSync = require('fs');
const envPath = path.join(__dirname, '../../.env');
if (fsSync.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const fs = require('fs').promises;
const axios = require('axios');
const { InterviewDataModel, createTables, sql } = require('../../ai-evaluation/data-model');

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
      timeout: 60000 // 60 second timeout
    });
    console.log(`✅ Cloud Function response received`);
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
    }
    return null;
  }
}

async function saveEvaluationResult(result, outputDir) {
  const filename = `evaluation_${result.interview_id}_${result.answer_id}_${Date.now()}.json`;
  const filepath = path.join(outputDir, filename);
  await fs.writeFile(filepath, JSON.stringify(result, null, 2));
  console.log(`✅ Saved evaluation result: ${filename}`);
}

// Check if an evaluation already exists
async function getExistingEvaluations(interviewId) {
  try {
    const result = await sql`
      SELECT answer_id, gpt_model, evaluation_timestamp 
      FROM video_answers_with_gpt_reviews 
      WHERE interview_id = ${interviewId}
    `;
    return new Map(result.map(row => [row.answer_id, row]));
  } catch (error) {
    console.error('Error checking existing evaluations:', error);
    return new Map();
  }
}

async function main() {
  const [interviewId, gptModel = 'google/gemini-1.5-flash', forceRedo = 'false'] = process.argv.slice(2);
  
  if (!interviewId) {
    console.error('Usage: node evaluate-by-interview-resume.js <interview_id> [gpt_model] [force_redo]');
    console.error('  force_redo: true to re-evaluate all answers, false to skip existing (default: false)');
    process.exit(1);
  }

  if (!CLOUD_FUNCTION_URL || !process.env.DATABASE_URL) {
    console.error('Missing required environment variables: CLOUD_FUNCTION_URL, DATABASE_URL');
    process.exit(1);
  }

  console.log(`🔗 Cloud Function URL: ${CLOUD_FUNCTION_URL}`);
  console.log(`🗄️ Database URL: ${process.env.DATABASE_URL ? '[SET]' : '[NOT SET]'}`);
  
  const outputDir = './evaluation-results';
  await fs.mkdir(outputDir, { recursive: true });

  console.log(`🚀 Starting evaluation for interview: ${interviewId}`);
  console.log(`🤖 Using GPT model: ${gptModel}`);
  console.log(`♻️ Resume mode: ${forceRedo === 'true' ? 'DISABLED (force redo)' : 'ENABLED (skip existing)'}`);
  
  try {
    // Ensure tables exist
    await createTables();
    
    // Get existing evaluations
    const existingEvaluations = forceRedo === 'true' ? new Map() : await getExistingEvaluations(interviewId);
    console.log(`📋 Found ${existingEvaluations.size} existing evaluations`);
    
    // Clear existing evaluations only if force redo
    if (forceRedo === 'true' && existingEvaluations.size > 0) {
      console.log('🔄 Force redo enabled - clearing existing evaluations...');
      await dataModel.clearEvaluations(null, interviewId);
      console.log(`✅ Cleared ${existingEvaluations.size} evaluations for re-processing`);
    }
    
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
    
    // Count how many need processing
    let toProcess = 0;
    let skipped = 0;
    for (const qa of questionAnswers) {
      if (existingEvaluations.has(qa.answer_id)) {
        skipped++;
      } else {
        toProcess++;
      }
    }
    
    console.log(`⏭️  Skipping ${skipped} already evaluated answers`);
    console.log(`🎯 Processing ${toProcess} remaining answers`);

    if (toProcess === 0) {
      console.log('✅ All answers already evaluated! Nothing to do.');
      return;
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
      
      // Check if already evaluated
      if (existingEvaluations.has(answer_id)) {
        const existing = existingEvaluations.get(answer_id);
        console.log(`⏭️  Skipping already evaluated answer ${answer_id} (evaluated at ${existing.evaluation_timestamp})`);
        continue;
      }
      
      if (!transcription_text || !question_title) {
        console.log(`⚠️  Skipping incomplete Q&A: answer_id ${answer_id}`);
        continue;
      }

      // Use question_title as the main question, with description as context if available
      const questionText = question_description ? `${question_title}: ${question_description}` : question_title;

      console.log(`\n🔍 Evaluating answer ${answer_id} for question: "${question_title}"`);
      console.log(`📝 Progress: ${processedCount + skipped + 1}/${questionAnswers.length}`);
      
      const evaluation = await evaluateAnswerWithRetry(candidate_email, interviewId, questionText, transcription_text, gptModel);
      
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
      if (i < questionAnswers.length - 1 && !existingEvaluations.has(questionAnswers[i + 1]?.answer_id)) {
        // Adjust delay based on rate limit errors
        if (rateLimitErrors > 0) {
          dynamicDelay = Math.min(dynamicDelay * 1.5, 30000); // Increase delay up to 30s
          console.log(`⚠️  Adjusting delay to ${Math.round(dynamicDelay)}ms due to rate limits`);
        }
        console.log(`⏳ Waiting ${Math.round(dynamicDelay)}ms before next request...`);
        await delay(dynamicDelay);
      }
    }

    console.log('\n📈 Evaluation Summary:');
    console.log(`✅ Newly processed: ${processedCount}`);
    console.log(`⏭️  Previously evaluated: ${skipped}`);
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
    
  } catch (error) {
    console.error('❌ Error during evaluation:', error);
    process.exit(1);
  }
}

main().catch(console.error);