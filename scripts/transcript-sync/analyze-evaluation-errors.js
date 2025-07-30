#!/usr/bin/env node

require('dotenv').config();
const { InterviewDataModel } = require('../../ai-evaluation/data-model');
const fs = require('fs').promises;
const path = require('path');

async function analyzeErrors() {
  console.log('🔍 Analyzing Evaluation Errors\n');
  
  const dataModel = new InterviewDataModel();
  
  try {
    // 1. Check for unevaluated answers
    console.log('1️⃣  Checking for unevaluated video answers...');
    const unevaluated = await dataModel.sql`
      SELECT 
        ia.id as answer_id,
        ia.interview_id,
        i.candidate_name,
        i.candidate_email,
        iq.question_text,
        LENGTH(ia.transcription_text) as transcript_length,
        ia.created_at
      FROM interview_answers ia
      JOIN interviews i ON ia.interview_id = i.id
      JOIN interview_questions iq ON ia.question_id = iq.id
      LEFT JOIN ai_evaluation_results aer ON ia.id = aer.answer_id
      WHERE ia.transcription_text IS NOT NULL
        AND aer.answer_id IS NULL
      ORDER BY ia.created_at DESC
      LIMIT 20
    `;
    
    console.log(`📊 Found ${unevaluated.length} unevaluated answers\n`);
    
    if (unevaluated.length > 0) {
      console.log('Sample unevaluated answers:');
      unevaluated.slice(0, 5).forEach(answer => {
        console.log(`  - Answer ID: ${answer.answer_id}`);
        console.log(`    Candidate: ${answer.candidate_name} (${answer.candidate_email})`);
        console.log(`    Question: ${answer.question_text.substring(0, 60)}...`);
        console.log(`    Transcript length: ${answer.transcript_length} chars`);
        console.log(`    Created: ${answer.created_at}\n`);
      });
    }
    
    // 2. Check for very short transcripts that might cause errors
    console.log('\n2️⃣  Checking for very short transcripts...');
    const shortTranscripts = await dataModel.sql`
      SELECT 
        ia.id as answer_id,
        ia.interview_id,
        i.candidate_name,
        iq.question_text,
        ia.transcription_text,
        LENGTH(ia.transcription_text) as length
      FROM interview_answers ia
      JOIN interviews i ON ia.interview_id = i.id
      JOIN interview_questions iq ON ia.question_id = iq.id
      WHERE ia.transcription_text IS NOT NULL
        AND LENGTH(ia.transcription_text) < 50
      ORDER BY LENGTH(ia.transcription_text) ASC
      LIMIT 10
    `;
    
    if (shortTranscripts.length > 0) {
      console.log(`⚠️  Found ${shortTranscripts.length} very short transcripts (< 50 chars):`);
      shortTranscripts.forEach(answer => {
        console.log(`  - Answer ID: ${answer.answer_id}`);
        console.log(`    Length: ${answer.length} chars`);
        console.log(`    Text: "${answer.transcription_text}"`);
        console.log('');
      });
    }
    
    // 3. Check for empty or null transcripts
    console.log('\n3️⃣  Checking for empty/null transcripts...');
    const emptyTranscripts = await dataModel.sql`
      SELECT 
        COUNT(*) as count,
        SUM(CASE WHEN transcription_text IS NULL THEN 1 ELSE 0 END) as null_count,
        SUM(CASE WHEN transcription_text = '' THEN 1 ELSE 0 END) as empty_count
      FROM interview_answers
    `;
    
    console.log(`📊 Transcript statistics:`);
    console.log(`   Total answers: ${emptyTranscripts[0].count}`);
    console.log(`   NULL transcripts: ${emptyTranscripts[0].null_count}`);
    console.log(`   Empty transcripts: ${emptyTranscripts[0].empty_count}`);
    
    // 4. Check evaluation failure patterns
    console.log('\n\n4️⃣  Checking recent evaluation attempts from logs...');
    
    // Read recent evaluation result files to look for patterns
    const resultsDir = './evaluation-results';
    try {
      const files = await fs.readdir(resultsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse().slice(0, 10);
      
      let successCount = 0;
      let errorPatterns = {};
      
      for (const file of jsonFiles) {
        const content = await fs.readFile(path.join(resultsDir, file), 'utf-8');
        const result = JSON.parse(content);
        
        if (result.evaluation && result.evaluation.addressing) {
          successCount++;
        } else if (result.error) {
          const errorKey = result.error.message || 'Unknown error';
          errorPatterns[errorKey] = (errorPatterns[errorKey] || 0) + 1;
        }
      }
      
      console.log(`📁 Analyzed ${jsonFiles.length} recent evaluation files:`);
      console.log(`   ✅ Successful: ${successCount}`);
      console.log(`   ❌ Failed: ${jsonFiles.length - successCount}`);
      
      if (Object.keys(errorPatterns).length > 0) {
        console.log('\n   Error patterns:');
        Object.entries(errorPatterns).forEach(([error, count]) => {
          console.log(`   - "${error}": ${count} times`);
        });
      }
    } catch (error) {
      console.log('   No evaluation result files found');
    }
    
    // 5. Provide recommendations
    console.log('\n\n💡 Recommendations:');
    
    if (unevaluated.length > 0) {
      console.log('\n1. To evaluate all unevaluated answers:');
      console.log('   node evaluate-by-position.js [position_id]');
    }
    
    if (shortTranscripts.length > 0) {
      console.log('\n2. Very short transcripts might cause evaluation issues.');
      console.log('   Consider filtering out answers < 50 characters');
    }
    
    console.log('\n3. To retry failed evaluations with better error handling:');
    console.log('   node retry-failed-evaluations.js');
    
    // 6. Check for specific problematic characters
    console.log('\n\n5️⃣  Checking for problematic characters in transcripts...');
    const problematicChars = await dataModel.sql`
      SELECT 
        ia.id as answer_id,
        i.candidate_name,
        CASE 
          WHEN ia.transcription_text ~ '[\\x00-\\x1F\\x7F]' THEN 'Control characters'
          WHEN ia.transcription_text ~ '[\\uD800-\\uDFFF]' THEN 'Invalid UTF-16'
          WHEN LENGTH(ia.transcription_text) != CHAR_LENGTH(ia.transcription_text) THEN 'Multi-byte issues'
          ELSE 'Other'
        END as issue_type
      FROM interview_answers ia
      JOIN interviews i ON ia.interview_id = i.id
      WHERE ia.transcription_text IS NOT NULL
        AND (
          ia.transcription_text ~ '[\\x00-\\x1F\\x7F]' OR
          ia.transcription_text ~ '[\\uD800-\\uDFFF]' OR
          LENGTH(ia.transcription_text) != CHAR_LENGTH(ia.transcription_text)
        )
      LIMIT 10
    `;
    
    if (problematicChars.length > 0) {
      console.log(`⚠️  Found ${problematicChars.length} answers with problematic characters:`);
      problematicChars.forEach(answer => {
        console.log(`  - Answer ID: ${answer.answer_id}`);
        console.log(`    Candidate: ${answer.candidate_name}`);
        console.log(`    Issue: ${answer.issue_type}`);
      });
    } else {
      console.log('✅ No problematic characters found');
    }
    
  } catch (error) {
    console.error('❌ Error analyzing evaluations:', error);
  }
}

analyzeErrors().catch(console.error);