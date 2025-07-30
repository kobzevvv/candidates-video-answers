#!/usr/bin/env node

// Test script to debug Cloud Function issues locally

const axios = require('axios');

// Test configuration
const CLOUD_FUNCTION_URL = process.env.CLOUD_FUNCTION_URL;
const TEST_DATA = {
  candidate_id: 'test-candidate',
  interview_id: 'test-interview',
  question: 'Tell me about yourself',
  answer: 'I am a software engineer with 5 years of experience in web development.',
  gpt_model: 'gpt-3.5-turbo'
};

async function testCloudFunction() {
  console.log('🧪 Testing Cloud Function Locally');
  console.log('================================');
  
  if (!CLOUD_FUNCTION_URL) {
    console.error('❌ CLOUD_FUNCTION_URL environment variable is not set');
    console.log('\nPlease set it:');
    console.log('export CLOUD_FUNCTION_URL="https://your-region-your-project.cloudfunctions.net/evaluate-candidate"');
    process.exit(1);
  }
  
  console.log(`📍 Cloud Function URL: ${CLOUD_FUNCTION_URL}`);
  console.log(`📦 Test payload:`, JSON.stringify(TEST_DATA, null, 2));
  console.log('\n🔄 Calling Cloud Function...\n');
  
  try {
    const startTime = Date.now();
    const response = await axios.post(CLOUD_FUNCTION_URL, TEST_DATA, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000,
      validateStatus: () => true // Accept any status code
    });
    const duration = Date.now() - startTime;
    
    console.log(`⏱️  Response time: ${duration}ms`);
    console.log(`📊 Status code: ${response.status}`);
    console.log(`📋 Headers:`, response.headers);
    console.log(`\n📦 Response data:`);
    console.log(JSON.stringify(response.data, null, 2));
    
    // Validate response structure
    if (response.status === 200) {
      console.log('\n✅ Status check: PASSED');
      
      const data = response.data;
      const checks = {
        'Has evaluation field': !!data.evaluation,
        'Has addressing score': !!data.evaluation?.addressing,
        'Has be_specific score': !!data.evaluation?.be_specific,
        'Has openness score': !!data.evaluation?.openness,
        'Has summary': !!data.evaluation?.short_summary,
        'Has model_used': !!data.model_used,
        'Has prompt_version': !!data.prompt_version
      };
      
      console.log('\n🔍 Response validation:');
      Object.entries(checks).forEach(([check, passed]) => {
        console.log(`  ${passed ? '✅' : '❌'} ${check}`);
      });
      
      const allPassed = Object.values(checks).every(v => v);
      if (allPassed) {
        console.log('\n🎉 All checks passed! Cloud Function is working correctly.');
      } else {
        console.log('\n⚠️  Some checks failed. Response structure may be incorrect.');
      }
    } else {
      console.log('\n❌ Status check: FAILED');
      console.log('Expected status 200, got:', response.status);
    }
    
  } catch (error) {
    console.error('\n❌ Error calling Cloud Function:');
    console.error('Message:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n🔍 Connection refused. Possible issues:');
      console.error('  - Cloud Function URL is incorrect');
      console.error('  - Cloud Function is not deployed');
      console.error('  - Network/firewall issues');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('\n🔍 Request timed out. Possible issues:');
      console.error('  - Cloud Function is taking too long');
      console.error('  - Network issues');
    }
    
    if (error.response) {
      console.error('\n📋 Error response:');
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Run the test
testCloudFunction().catch(console.error);