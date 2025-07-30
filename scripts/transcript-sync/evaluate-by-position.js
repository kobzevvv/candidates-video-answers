#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { InterviewDataModel, createTables } = require('../../ai-evaluation/data-model');

const CLOUD_FUNCTION_URL = process.env.CLOUD_FUNCTION_URL;

const dataModel = new InterviewDataModel();

async function evaluateAnswer(candidateId, interviewId, question, answer, gptModel = 'gpt-3.5-turbo') {
  try {
    console.log(`🌐 Calling Cloud Function: ${CLOUD_FUNCTION_URL}`);
    const response = await axios.get(CLOUD_FUNCTION_URL, {
      params: {
        candidate_id: candidateId,
        interview_id: interviewId,
        question: question,
        answer: answer,
        gpt_model: gptModel
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
  const [positionId, skipEvaluated, gptModel = 'gpt-3.5-turbo'] = process.argv.slice(2);
  
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

    for (const interview of interviews) {
      const { interview_id: interviewId, candidate_email, candidate_first_name, candidate_last_name } = interview;
      
      console.log(`🔍 Processing interview: ${interviewId} for candidate: ${candidate_first_name} ${candidate_last_name} (${candidate_email})`);
      
      // Get all question-answer pairs for this interview
      const questionAnswers = await dataModel.getInterviewAnswers(interviewId);
      
      for (const qa of questionAnswers) {
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
    
  } catch (error) {
    console.error('❌ Error during evaluation:', error);
    process.exit(1);
  }
}

main().catch(console.error);