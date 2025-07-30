#!/usr/bin/env node

require('dotenv').config();

const axios = require('axios');
const { InterviewDataModel } = require('../../ai-evaluation/data-model');

const CLOUD_FUNCTION_URL = process.env.CLOUD_FUNCTION_URL;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function testEvaluationPipeline() {
  console.log('\n🔍 Testing Video Answer Evaluation Pipeline\n');
  
  // Check environment variables
  console.log('1️⃣  Checking environment variables...');
  if (!CLOUD_FUNCTION_URL) {
    console.error('❌ CLOUD_FUNCTION_URL is not set in .env file');
    process.exit(1);
  }
  if (!GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN is not set in .env file');
    console.log('   Get a token from: https://github.com/settings/tokens');
    console.log('   Required scope: read:project');
    process.exit(1);
  }
  console.log('✅ Environment variables are set');
  console.log(`   Cloud Function URL: ${CLOUD_FUNCTION_URL}`);
  
  // Test database connection
  console.log('\n2️⃣  Testing database connection...');
  const dataModel = new InterviewDataModel();
  try {
    const testQuery = await dataModel.sql`SELECT NOW() as current_time`;
    console.log('✅ Database connection successful');
    console.log(`   Current time: ${testQuery[0].current_time}`);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
  
  // Get a sample video answer from database
  console.log('\n3️⃣  Fetching sample video answer from database...');
  let sampleAnswer;
  try {
    const answers = await dataModel.sql`
      SELECT 
        ia.id as answer_id,
        ia.interview_id,
        iq.id as question_id,
        iq.question_text,
        ia.transcription_text,
        i.candidate_id
      FROM interview_answers ia
      JOIN interview_questions iq ON ia.question_id = iq.id
      JOIN interviews i ON ia.interview_id = i.id
      WHERE ia.transcription_text IS NOT NULL
        AND LENGTH(ia.transcription_text) > 50
      ORDER BY ia.created_at DESC
      LIMIT 1
    `;
    
    if (answers.length === 0) {
      console.error('❌ No video answers with transcriptions found in database');
      process.exit(1);
    }
    
    sampleAnswer = answers[0];
    console.log('✅ Found sample answer');
    console.log(`   Answer ID: ${sampleAnswer.answer_id}`);
    console.log(`   Question: ${sampleAnswer.question_text.substring(0, 80)}...`);
    console.log(`   Transcription length: ${sampleAnswer.transcription_text.length} characters`);
  } catch (error) {
    console.error('❌ Failed to fetch sample answer:', error.message);
    process.exit(1);
  }
  
  // Test cloud function
  console.log('\n4️⃣  Testing cloud function evaluation...');
  let evaluationResult;
  try {
    const response = await axios.post(CLOUD_FUNCTION_URL, {
      candidate_id: sampleAnswer.candidate_id,
      interview_id: sampleAnswer.interview_id,
      question: sampleAnswer.question_text,
      answer: sampleAnswer.transcription_text,
      gpt_model: 'openai/gpt-4o-mini'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GITHUB_TOKEN}`
      },
      timeout: 30000
    });
    
    evaluationResult = response.data;
    console.log('✅ Cloud function evaluation successful');
    console.log('   Evaluation scores:');
    console.log(`   - Addressing: ${evaluationResult.evaluation.addressing}/10`);
    console.log(`   - Specificity: ${evaluationResult.evaluation.be_specific}/10`);
    console.log(`   - Openness: ${evaluationResult.evaluation.openness}/10`);
    console.log(`   Summary: ${evaluationResult.evaluation.short_summary}`);
  } catch (error) {
    console.error('❌ Cloud function evaluation failed:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
    process.exit(1);
  }
  
  // Test database storage
  console.log('\n5️⃣  Testing database storage...');
  try {
    await dataModel.updateEvaluationResults(
      sampleAnswer.answer_id,
      sampleAnswer.interview_id,
      sampleAnswer.question_id,
      evaluationResult.evaluation,
      evaluationResult.model_used
    );
    console.log('✅ Evaluation results stored successfully');
    
    // Verify storage
    const stored = await dataModel.sql`
      SELECT * FROM ai_evaluation_results 
      WHERE answer_id = ${sampleAnswer.answer_id}
    `;
    
    if (stored.length > 0) {
      console.log('✅ Verified: Results are in database');
      console.log(`   Evaluation timestamp: ${stored[0].evaluation_timestamp}`);
    }
  } catch (error) {
    console.error('❌ Failed to store evaluation results:', error.message);
    process.exit(1);
  }
  
  // Check for any unevaluated answers
  console.log('\n6️⃣  Checking for unevaluated video answers...');
  try {
    const unevaluated = await dataModel.sql`
      SELECT COUNT(*) as count
      FROM interview_answers ia
      LEFT JOIN ai_evaluation_results aer ON ia.id = aer.answer_id
      WHERE ia.transcription_text IS NOT NULL
        AND LENGTH(ia.transcription_text) > 50
        AND aer.answer_id IS NULL
    `;
    
    console.log(`📊 Unevaluated video answers: ${unevaluated[0].count}`);
    
    if (unevaluated[0].count > 0) {
      console.log('\n💡 To evaluate all unevaluated answers, run:');
      console.log('   node evaluate-by-position.js [position_id]');
      console.log('   or');
      console.log('   node evaluate-by-interview.js [interview_id]');
    }
  } catch (error) {
    console.error('❌ Failed to check unevaluated answers:', error.message);
  }
  
  console.log('\n✅ All pipeline tests passed successfully!\n');
}

// Run the test
testEvaluationPipeline().catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});