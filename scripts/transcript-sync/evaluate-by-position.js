#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { InterviewDataModel, createTables } = require('../../ai-evaluation/data-model');

const CLOUD_FUNCTION_URL = process.env.CLOUD_FUNCTION_URL;
const RATE_LIMIT_DELAY = process.env.RATE_LIMIT_DELAY ? parseInt(process.env.RATE_LIMIT_DELAY) : 3000; // Default 3 seconds

const dataModel = new InterviewDataModel();

// Helper function to add delay between API calls
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function evaluateAnswer(candidateId, interviewId, question, answer, gptModel = 'google/gemini-1.5-flash') {
  try {
    console.log(`🌐 Calling Cloud Function: ${CLOUD_FUNCTION_URL}`);
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
    return response.data;
  } catch (error) {
    console.error(`❌ Error evaluating answer for interview ${interviewId}:`);
    console.error(`   Error message: ${error.message}`);
    console.error(`   Error code: ${error.code}`);
    if (error.response) {
      console.error(`   HTTP Status: ${error.response.status}`);
      console.error(`   Response data:`, error.response.data);
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
  const [positionId, skipEvaluated, gptModel = 'google/gemini-1.5-flash'] = process.argv.slice(2);
  
  if (!positionId) {
    console.error('Usage: node evaluate-by-position.js <position_id> [skip_evaluated] [gpt_model]');
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

  console.log(`🚀 Starting evaluation for position: ${positionId}`);
  console.log(`🤖 Using GPT model: ${gptModel}`);
  console.log(`⏭️  Skip evaluated: ${skipEvaluated}`);
  
  try {
    // Ensure tables exist
    await createTables();
    
    // Clear evaluations if skip_evaluated is false (re-do all)
    if (skipEvaluated === 'false') {
      console.log('🔄 Clearing existing evaluations for re-processing...');
      await dataModel.clearEvaluations(positionId);
    }
    
    // Get interviews from datamart
    const interviews = await dataModel.getInterviewsByPosition(positionId);
    console.log(`📊 Found ${interviews.length} interviews for position ${positionId}`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    console.log(`⏱️  Rate limit delay: ${RATE_LIMIT_DELAY}ms between requests`);

    for (let i = 0; i < interviews.length; i++) {
      const interview = interviews[i];
      const { interview_id: interviewId, candidate_email, candidate_first_name, candidate_last_name } = interview;
      
      console.log(`🔍 Processing interview: ${interviewId} for candidate: ${candidate_first_name} ${candidate_last_name} (${candidate_email})`);
      
      // Get all question-answer pairs for this interview
      const questionAnswers = await dataModel.getInterviewAnswers(interviewId);
      
      for (let j = 0; j < questionAnswers.length; j++) {
        const qa = questionAnswers[j];
        const { 
          answer_id, 
          question_id, 
          question_title, 
          question_description,
          transcription_text, 
          evaluation_addressing 
        } = qa;
        
        // Skip if already evaluated (unless skip_evaluated is false)
        if (skipEvaluated === 'true' && evaluation_addressing !== null) {
          console.log(`⏭️  Skipping already evaluated answer: ${answer_id}`);
          skippedCount++;
          continue;
        }

        if (!transcription_text || !question_title) {
          console.log(`⚠️  Skipping incomplete Q&A: answer_id ${answer_id}`);
          continue;
        }

        // Use question_title as the main question, with description as context if available
        const questionText = question_description ? `${question_title}: ${question_description}` : question_title;

        console.log(`🔍 Evaluating answer ${answer_id} for question: "${question_title}"`);

        // Evaluate the answer
        const evaluation = await evaluateAnswer(candidate_email, interviewId, questionText, transcription_text, gptModel);
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
            position_id: positionId,
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
        
        // Add delay between requests to avoid rate limits
        // Skip delay if it's the last question in the last interview
        const isLastQuestion = j === questionAnswers.length - 1;
        const isLastInterview = i === interviews.length - 1;
        if (!(isLastQuestion && isLastInterview)) {
          console.log(`⏳ Waiting ${RATE_LIMIT_DELAY}ms before next request...`);
          await delay(RATE_LIMIT_DELAY);
        }
      }
    }

    // Get final statistics
    const stats = await dataModel.getEvaluationStats(positionId);
    
    console.log('\n📈 Evaluation Summary:');
    console.log(`✅ Processed: ${processedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total answers: ${stats.total_answers}`);
    console.log(`🏁 Evaluated answers: ${stats.evaluated_answers}`);
    console.log(`⏳ Pending answers: ${stats.pending_answers}`);
    console.log(`📁 Results saved to: ${outputDir}`);
    
    // Exit with error if no evaluations succeeded
    if (processedCount === 0 && errorCount > 0) {
      console.error('\n❌ FAILED: All evaluations failed');
      process.exit(1);
    }
    
    // Exit with error if more than 50% failed
    const totalAttempts = processedCount + errorCount;
    const errorRate = totalAttempts > 0 ? errorCount / totalAttempts : 0;
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