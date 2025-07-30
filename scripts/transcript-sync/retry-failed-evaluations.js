#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');
const { InterviewDataModel } = require('../../ai-evaluation/data-model');
const fs = require('fs').promises;
const path = require('path');

const CLOUD_FUNCTION_URL = process.env.CLOUD_FUNCTION_URL;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

// Helper function to clean problematic text
function cleanTranscriptText(text) {
  if (!text) return '';
  
  // Remove control characters
  let cleaned = text.replace(/[\x00-\x1F\x7F]/g, ' ');
  
  // Replace multiple spaces with single space
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // Trim
  cleaned = cleaned.trim();
  
  return cleaned;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function evaluateWithRetry(candidateId, interviewId, question, answer, gptModel = 'openai/gpt-4o-mini', retries = 0) {
  try {
    // Clean the answer text
    const cleanedAnswer = cleanTranscriptText(answer);
    
    // Skip if answer is too short after cleaning
    if (cleanedAnswer.length < 20) {
      console.log(`⚠️  Skipping - answer too short (${cleanedAnswer.length} chars)`);
      return null;
    }
    
    // Truncate very long answers to avoid token limits
    const truncatedAnswer = cleanedAnswer.length > 4000 ? 
      cleanedAnswer.substring(0, 4000) + '... [truncated]' : 
      cleanedAnswer;
    
    const response = await axios.post(CLOUD_FUNCTION_URL, {
      candidate_id: candidateId,
      interview_id: interviewId,
      question: question,
      answer: truncatedAnswer,
      gpt_model: gptModel
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000, // 60 second timeout
      validateStatus: (status) => status < 500 // Don't throw on 4xx errors
    });
    
    if (response.status === 200 && response.data.evaluation) {
      return response.data;
    } else if (response.status === 400) {
      console.log(`❌ Bad request: ${response.data.error || response.data.message}`);
      return null;
    } else if (response.status === 429) {
      // Rate limit - wait and retry
      if (retries < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(2, retries); // Exponential backoff
        console.log(`⏳ Rate limited - waiting ${delay}ms before retry ${retries + 1}/${MAX_RETRIES}`);
        await sleep(delay);
        return evaluateWithRetry(candidateId, interviewId, question, answer, gptModel, retries + 1);
      }
    }
    
    console.log(`❌ Unexpected response status: ${response.status}`);
    return null;
    
  } catch (error) {
    if (retries < MAX_RETRIES) {
      const delay = RETRY_DELAY * Math.pow(2, retries);
      console.log(`⏳ Error occurred - waiting ${delay}ms before retry ${retries + 1}/${MAX_RETRIES}`);
      console.log(`   Error: ${error.message}`);
      await sleep(delay);
      return evaluateWithRetry(candidateId, interviewId, question, answer, gptModel, retries + 1);
    }
    
    console.log(`❌ Failed after ${MAX_RETRIES} retries: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🔄 Retrying Failed Evaluations\n');
  
  if (!CLOUD_FUNCTION_URL || !process.env.DATABASE_URL) {
    console.error('Missing required environment variables: CLOUD_FUNCTION_URL, DATABASE_URL');
    process.exit(1);
  }
  
  const dataModel = new InterviewDataModel();
  
  try {
    // Get unevaluated answers
    console.log('📋 Fetching unevaluated answers...');
    const unevaluated = await dataModel.sql`
      SELECT 
        ia.id as answer_id,
        ia.interview_id,
        iq.id as question_id,
        iq.question_text,
        ia.transcription_text,
        i.candidate_id,
        i.candidate_name,
        i.candidate_email,
        LENGTH(ia.transcription_text) as transcript_length
      FROM interview_answers ia
      JOIN interviews i ON ia.interview_id = i.id
      JOIN interview_questions iq ON ia.question_id = iq.id
      LEFT JOIN ai_evaluation_results aer ON ia.id = aer.answer_id
      WHERE ia.transcription_text IS NOT NULL
        AND LENGTH(ia.transcription_text) >= 20
        AND aer.answer_id IS NULL
      ORDER BY ia.created_at DESC
    `;
    
    console.log(`📊 Found ${unevaluated.length} unevaluated answers\n`);
    
    if (unevaluated.length === 0) {
      console.log('✅ No unevaluated answers found!');
      return;
    }
    
    // Create output directory
    const outputDir = './evaluation-results';
    await fs.mkdir(outputDir, { recursive: true });
    
    let processedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    // Process in batches to avoid overwhelming the API
    const BATCH_SIZE = 5;
    const BATCH_DELAY = 5000; // 5 seconds between batches
    
    for (let i = 0; i < unevaluated.length; i += BATCH_SIZE) {
      const batch = unevaluated.slice(i, i + BATCH_SIZE);
      
      console.log(`\n📦 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(unevaluated.length/BATCH_SIZE)}`);
      
      for (const answer of batch) {
        console.log(`\n🔍 Evaluating answer ${answer.answer_id}`);
        console.log(`   Candidate: ${answer.candidate_name} (${answer.candidate_email})`);
        console.log(`   Question: ${answer.question_text.substring(0, 60)}...`);
        console.log(`   Transcript length: ${answer.transcript_length} chars`);
        
        const evaluation = await evaluateWithRetry(
          answer.candidate_email,
          answer.interview_id,
          answer.question_text,
          answer.transcription_text
        );
        
        if (evaluation && evaluation.evaluation) {
          // Save to database
          await dataModel.updateEvaluationResults(
            answer.answer_id,
            answer.interview_id,
            answer.question_id,
            evaluation.evaluation,
            evaluation.model_used || 'openai/gpt-4o-mini'
          );
          
          // Save to file
          const filename = `evaluation_${answer.interview_id}_${Date.now()}.json`;
          await fs.writeFile(
            path.join(outputDir, filename),
            JSON.stringify({
              ...evaluation,
              answer_id: answer.answer_id,
              question: answer.question_text,
              answer: answer.transcription_text.substring(0, 200) + '...'
            }, null, 2)
          );
          
          console.log(`✅ Evaluation saved successfully`);
          console.log(`   Scores: Addressing=${evaluation.evaluation.addressing}, Specificity=${evaluation.evaluation.be_specific}, Openness=${evaluation.evaluation.openness}`);
          
          processedCount++;
        } else {
          console.log(`❌ Failed to evaluate`);
          errorCount++;
        }
      }
      
      // Wait between batches if not the last batch
      if (i + BATCH_SIZE < unevaluated.length) {
        console.log(`\n⏳ Waiting ${BATCH_DELAY/1000} seconds before next batch...`);
        await sleep(BATCH_DELAY);
      }
    }
    
    console.log('\n\n📈 Retry Summary:');
    console.log(`✅ Successfully evaluated: ${processedCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`📁 Results saved to: ${outputDir}`);
    
    // Exit with error if failure rate is too high
    const totalAttempts = processedCount + errorCount;
    if (totalAttempts > 0) {
      const errorRate = errorCount / totalAttempts;
      if (errorRate > 0.5) {
        console.error(`\n❌ High error rate: ${(errorRate * 100).toFixed(1)}%`);
        process.exit(1);
      }
    }
    
  } catch (error) {
    console.error('❌ Error during retry:', error);
    process.exit(1);
  }
}

main().catch(console.error);