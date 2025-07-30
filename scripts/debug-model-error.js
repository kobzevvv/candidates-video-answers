#!/usr/bin/env node

const axios = require('axios');

const CLOUD_FUNCTION_URL = process.env.CLOUD_FUNCTION_URL || 'https://evaluate-candidate-grz2olvbca-uc.a.run.app';

async function debugModel(model) {
  console.log(`\n🔍 Debugging model: ${model}`);
  console.log('─'.repeat(50));
  
  const testData = {
    candidate_id: 'debug-test',
    interview_id: 'debug-test',
    question: 'Test question',
    answer: 'Test answer',
    gpt_model: model
  };

  try {
    console.log('📤 Sending request...');
    
    const response = await axios.post(CLOUD_FUNCTION_URL, testData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
      validateStatus: () => true,
      maxRedirects: 0
    });
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log('📋 Headers:', response.headers);
    
    if (response.data) {
      console.log('📦 Response body:');
      if (typeof response.data === 'string') {
        console.log(response.data);
      } else {
        console.log(JSON.stringify(response.data, null, 2));
      }
    }
    
    // Check if it's an error response with details
    if (response.status !== 200 && response.data && typeof response.data === 'object') {
      if (response.data.error) console.log(`\n⚠️  Error: ${response.data.error}`);
      if (response.data.message) console.log(`⚠️  Message: ${response.data.message}`);
      if (response.data.details) console.log(`⚠️  Details: ${response.data.details}`);
    }
    
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data: ${JSON.stringify(error.response.data)}`);
    }
  }
}

async function main() {
  const problemModels = [
    'google/gemini-1.5-flash',
    'meta/llama-3.1-8b'
  ];
  
  console.log(`🔗 Cloud Function: ${CLOUD_FUNCTION_URL}`);
  
  for (const model of problemModels) {
    await debugModel(model);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n💡 Possible issues:');
  console.log('1. These models might not be available in GitHub Models API');
  console.log('2. The model names might need different formatting');
  console.log('3. The models might require different API parameters');
  console.log('4. Rate limiting or quota issues for specific models');
}

main().catch(console.error);