#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { InterviewDataModel, createTables } = require('../../ai-evaluation/data-model');

const CLOUD_FUNCTION_URL = process.env.CLOUD_FUNCTION_URL;

const dataModel = new InterviewDataModel();

async function evaluateAnswer(candidateId, interviewId, question, answer, gptModel = 'gpt-3.5-turbo') {
  try {
    const response = await axios.get(CLOUD_FUNCTION_URL, {
      params: {
        candidate_id: candidateId,
        interview_id: interviewId,
        question: question,
        answer: answer,
        gpt_model: gptModel
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Error evaluating answer for interview ${interviewId}:`, error.message);
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
      const { interview_id: interviewId, candidate_id: candidateId } = interview;
      
      console.log(`🔍 Processing interview: ${interviewId} for candidate: ${candidateId}`);
      
      // Get all question-answer pairs for this interview
      const questionAnswers = await dataModel.getInterviewAnswers(interviewId);
      
      for (const qa of questionAnswers) {
        const { question_id, question_text, answer_text, evaluation_addressing } = qa;
        
        // Skip if already evaluated (unless skip_evaluated is false)
        if (skipEvaluated === 'true' && evaluation_addressing !== null) {
          console.log(`⏭️  Skipping already evaluated Q&A: ${question_id}`);
          skippedCount++;
          continue;
        }

        if (!question_text || !answer_text) {
          console.log(`⚠️  Skipping incomplete Q&A: ${question_id}`);
          continue;
        }

        // Evaluate the answer
        const evaluation = await evaluateAnswer(candidateId, interviewId, question_text, answer_text, gptModel);
        if (evaluation && evaluation.evaluation) {
          // Save to datamart
          await dataModel.updateEvaluationResults(interviewId, question_id, evaluation.evaluation, evaluation.model_used);
          
          // Also save to file for backup
          await saveEvaluationResult({
            ...evaluation,
            position_id: positionId,
            question_id: question_id,
            question: question_text,
            answer: answer_text
          }, outputDir);
          
          processedCount++;
        } else {
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