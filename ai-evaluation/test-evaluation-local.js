#!/usr/bin/env node

// Test the evaluation process locally with real data

const { InterviewDataModel, createTables } = require('./data-model');
const axios = require('axios');

const CLOUD_FUNCTION_URL = process.env.CLOUD_FUNCTION_URL;
const TEST_INTERVIEW_ID = '688734e38fb4bc64261bffe0';

async function evaluateAnswer(candidateId, interviewId, question, answer, gptModel = 'gpt-3.5-turbo') {
  try {
    console.log(`\n🌐 Calling Cloud Function...`);
    console.log(`📍 URL: ${CLOUD_FUNCTION_URL}`);
    console.log(`📊 Params:`, {
      candidate_id: candidateId,
      interview_id: interviewId,
      question: question.substring(0, 50) + '...',
      answer: answer.substring(0, 50) + '...',
      gpt_model: gptModel
    });
    
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
      timeout: 30000,
      validateStatus: () => true
    });
    
    console.log(`✅ Response received - Status: ${response.status}`);
    console.log(`📦 Response data:`, JSON.stringify(response.data, null, 2));
    
    if (response.status !== 200) {
      console.error(`❌ Non-200 status code: ${response.status}`);
      return null;
    }
    
    return response.data;
  } catch (error) {
    console.error(`❌ Error calling Cloud Function:`);
    console.error(`   Message: ${error.message}`);
    console.error(`   Code: ${error.code}`);
    if (error.response) {
      console.error(`   HTTP Status: ${error.response.status}`);
      console.error(`   Response:`, error.response.data);
    }
    return null;
  }
}

async function testEvaluation() {
  console.log('🧪 Testing Evaluation Process Locally');
  console.log('====================================');
  
  // Check environment
  if (!CLOUD_FUNCTION_URL) {
    console.error('❌ CLOUD_FUNCTION_URL not set');
    console.log('\nTo set it:');
    console.log('export CLOUD_FUNCTION_URL="https://your-region-your-project.cloudfunctions.net/evaluate-candidate"');
    process.exit(1);
  }
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }
  
  console.log(`\n📋 Environment:`);
  console.log(`   Cloud Function: ${CLOUD_FUNCTION_URL}`);
  console.log(`   Database: [CONNECTED]`);
  console.log(`   Test Interview: ${TEST_INTERVIEW_ID}`);
  
  const dataModel = new InterviewDataModel();
  
  try {
    // Create tables if needed
    console.log('\n🔧 Ensuring database tables exist...');
    await createTables();
    
    // Get interview data
    console.log(`\n📊 Fetching interview data for ${TEST_INTERVIEW_ID}...`);
    const questionAnswers = await dataModel.getInterviewAnswers(TEST_INTERVIEW_ID);
    
    if (questionAnswers.length === 0) {
      console.error('❌ No question-answer pairs found for this interview');
      process.exit(1);
    }
    
    console.log(`✅ Found ${questionAnswers.length} question-answer pairs`);
    
    // Test with just the first question
    const firstQA = questionAnswers[0];
    console.log(`\n🎯 Testing with first question:`);
    console.log(`   Answer ID: ${firstQA.answer_id}`);
    console.log(`   Question: ${firstQA.question_title}`);
    console.log(`   Candidate: ${firstQA.candidate_email}`);
    
    // Check if transcription exists
    if (!firstQA.transcription_text) {
      console.error('❌ No transcription text for this answer');
      process.exit(1);
    }
    
    console.log(`   Transcription length: ${firstQA.transcription_text.length} chars`);
    
    // Call evaluation
    const questionText = firstQA.question_description 
      ? `${firstQA.question_title}: ${firstQA.question_description}` 
      : firstQA.question_title;
      
    const evaluation = await evaluateAnswer(
      firstQA.candidate_email,
      TEST_INTERVIEW_ID,
      questionText,
      firstQA.transcription_text,
      'gpt-3.5-turbo'
    );
    
    if (evaluation && evaluation.evaluation) {
      console.log('\n✅ Evaluation successful!');
      console.log('📊 Scores:');
      console.log(`   Addressing: ${evaluation.evaluation.addressing}/10`);
      console.log(`   Specificity: ${evaluation.evaluation.be_specific}/10`);
      console.log(`   Openness: ${evaluation.evaluation.openness}/10`);
      console.log(`   Summary: ${evaluation.evaluation.short_summary}`);
      
      // Try to save to database
      console.log('\n💾 Testing database save...');
      await dataModel.updateEvaluationResults(
        firstQA.answer_id,
        TEST_INTERVIEW_ID,
        firstQA.question_id,
        evaluation.evaluation,
        evaluation.model_used
      );
      console.log('✅ Database save successful!');
      
    } else {
      console.error('\n❌ Evaluation failed - no valid response');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Run the test
testEvaluation().catch(console.error);