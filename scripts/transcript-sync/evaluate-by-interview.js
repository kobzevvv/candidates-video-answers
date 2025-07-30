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
  const [interviewId, gptModel = 'gpt-3.5-turbo'] = process.argv.slice(2);
  
  if (!interviewId) {
    console.error('Usage: node evaluate-by-interview.js <interview_id> [gpt_model]');
    process.exit(1);
  }

  if (!CLOUD_FUNCTION_URL || !process.env.DATABASE_URL) {
    console.error('Missing required environment variables: CLOUD_FUNCTION_URL, DATABASE_URL');
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

    const candidateId = questionAnswers[0].candidate_id;
    console.log(`👤 Candidate ID: ${candidateId}`);
    console.log(`📋 Found ${questionAnswers.length} question-answer pairs`);

    let processedCount = 0;
    let errorCount = 0;

    for (const qa of questionAnswers) {
      const { question_id, question_text, answer_text } = qa;
      
      if (!question_text || !answer_text) {
        console.log(`⚠️  Skipping incomplete Q&A: ${question_id}`);
        continue;
      }

      console.log(`🔍 Re-evaluating Q&A pair: ${question_id}`);
      
      const evaluation = await evaluateAnswer(candidateId, interviewId, question_text, answer_text, gptModel);
      if (evaluation && evaluation.evaluation) {
        // Save to datamart
        await dataModel.updateEvaluationResults(interviewId, question_id, evaluation.evaluation, evaluation.model_used);
        
        // Also save to file for backup
        await saveEvaluationResult({
          ...evaluation,
          question_id: question_id,
          question: question_text,
          answer: answer_text
        }, outputDir);
        
        processedCount++;
      } else {
        errorCount++;
      }
    }

    console.log('\n📈 Re-evaluation Summary:');
    console.log(`✅ Processed: ${processedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📁 Results saved to: ${outputDir}`);
    
  } catch (error) {
    console.error('❌ Error during evaluation:', error);
    process.exit(1);
  }
}

main().catch(console.error);