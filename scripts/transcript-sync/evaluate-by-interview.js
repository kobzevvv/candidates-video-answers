#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { InterviewDataModel, createTables } = require('../../ai-evaluation/data-model');

const CLOUD_FUNCTION_URL = process.env.CLOUD_FUNCTION_URL;

const dataModel = new InterviewDataModel();

async function evaluateAnswer(candidateId, interviewId, question, answer, gptModel = 'gpt-3.5-turbo') {
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
      timeout: 60000 // 60 second timeout
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
  const [interviewId, gptModel = 'gpt-3.5-turbo'] = process.argv.slice(2);
  
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

    let processedCount = 0;
    let errorCount = 0;

    for (const qa of questionAnswers) {
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
    }

    console.log('\n📈 Re-evaluation Summary:');
    console.log(`✅ Processed: ${processedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📁 Results saved to: ${outputDir}`);
    
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