#!/usr/bin/env node

const axios = require('axios');

const CLOUD_FUNCTION_URL = 'https://evaluate-candidate-grz2olvbca-uc.a.run.app';

// Test various model ID formats
const modelsToTest = [
  // OpenAI models
  'gpt-4o',
  'gpt-4o-mini',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  
  // Google models
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'google/gemini-1.5-flash',
  'google/gemini-1.5-pro',
  
  // Claude models  
  'claude-3-5-sonnet',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-sonnet-latest',
  'anthropic/claude-3-5-sonnet',
  
  // Meta models
  'llama-3.1-70b-instruct',
  'meta/llama-3.1-70b-instruct',
  'meta-llama/llama-3.1-70b-instruct',
  
  // Mistral models
  'mistral-large',
  'mistral-large-2407',
  'mistral/mistral-large',
  'mistral/mistral-large-2407'
];

async function testModel(model) {
  const testData = {
    candidate_id: 'test-candidate',
    interview_id: 'test-interview',
    question: 'What is 2+2?',
    answer: 'The answer is 4.',
    gpt_model: model
  };

  try {
    console.log(`\nTesting: ${model}`);
    const startTime = Date.now();
    
    const response = await axios.post(CLOUD_FUNCTION_URL, testData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
      validateStatus: () => true
    });
    
    const duration = Date.now() - startTime;
    
    if (response.status === 200) {
      console.log(`✅ SUCCESS (${duration}ms) - Model ID: ${model}`);
      return { model, success: true, duration };
    } else {
      console.log(`❌ FAILED - Status: ${response.status}`);
      if (response.data?.error) {
        console.log(`   Error: ${response.data.error}`);
      }
      return { model, success: false };
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return { model, success: false, error: error.message };
  }
}

async function main() {
  console.log('🔍 Testing GitHub Models API model IDs...');
  console.log(`📍 Cloud Function: ${CLOUD_FUNCTION_URL}`);
  console.log('─'.repeat(60));
  
  const results = [];
  
  for (const model of modelsToTest) {
    const result = await testModel(model);
    results.push(result);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  const working = results.filter(r => r.success);
  
  if (working.length > 0) {
    console.log(`\n✅ Working Model IDs (${working.length}/${modelsToTest.length}):`);
    working.forEach(r => {
      console.log(`   • ${r.model.padEnd(35)} (${r.duration}ms)`);
    });
  }
  
  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.log(`\n❌ Failed Model IDs (${failed.length}/${modelsToTest.length}):`);
    failed.forEach(r => {
      console.log(`   • ${r.model}`);
    });
  }
}

main().catch(console.error);