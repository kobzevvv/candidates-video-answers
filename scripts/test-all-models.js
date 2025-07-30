#!/usr/bin/env node

const axios = require('axios');
const { RECOMMENDED_MODELS, GITHUB_MODELS } = require('../ai-evaluation/config/github-models');

const CLOUD_FUNCTION_URL = process.env.CLOUD_FUNCTION_URL || 'https://evaluate-candidate-grz2olvbca-uc.a.run.app';

// Use recommended models for testing
const models = RECOMMENDED_MODELS;

console.log('📋 Available GitHub Models:');
console.log('─'.repeat(80));
models.forEach(modelId => {
  const model = GITHUB_MODELS[modelId];
  console.log(`• ${modelId.padEnd(35)} - ${model.provider} - ${model.description}`);
});
console.log('─'.repeat(80));

async function testModel(model) {
  const testData = {
    candidate_id: 'test-candidate',
    interview_id: 'test-interview',
    question: 'What is your experience with cloud computing?',
    answer: 'I have 5 years of experience working with AWS and Google Cloud Platform.',
    gpt_model: model
  };

  try {
    console.log(`\n🧪 Testing model: ${model}`);
    const startTime = Date.now();
    
    const response = await axios.post(CLOUD_FUNCTION_URL, testData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
      validateStatus: () => true
    });
    
    const duration = Date.now() - startTime;
    
    if (response.status === 200) {
      console.log(`✅ SUCCESS (${duration}ms)`);
      if (response.data.evaluation) {
        console.log(`   Scores: addressing=${response.data.evaluation.addressing}, specific=${response.data.evaluation.be_specific}, openness=${response.data.evaluation.openness}`);
      }
    } else {
      console.log(`❌ FAILED - Status: ${response.status}`);
      if (response.data) {
        console.log(`   Error: ${JSON.stringify(response.data)}`);
      }
    }
    
    return { model, success: response.status === 200, duration };
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return { model, success: false, error: error.message };
  }
}

async function main() {
  console.log(`🔗 Testing Cloud Function: ${CLOUD_FUNCTION_URL}`);
  console.log(`📊 Testing ${models.length} models...`);
  
  const results = [];
  
  for (const model of models) {
    const result = await testModel(model);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between tests
  }
  
  console.log('\n📈 Summary:');
  console.log('─'.repeat(60));
  
  const working = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  if (working.length > 0) {
    console.log(`\n✅ Working models (${working.length}/${models.length}):`);
    working.forEach(r => {
      console.log(`   • ${r.model} (${r.duration}ms)`);
    });
  }
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed models (${failed.length}/${models.length}):`);
    failed.forEach(r => {
      console.log(`   • ${r.model}${r.error ? ` - ${r.error}` : ''}`);
    });
  }
  
  console.log('\n💡 Recommendation:');
  if (working.length > 0) {
    const fastest = working.sort((a, b) => a.duration - b.duration)[0];
    console.log(`   Use "${fastest.model}" for best performance (${fastest.duration}ms)`);
  } else {
    console.log('   ⚠️  No models are currently working!');
  }
}

main().catch(console.error);