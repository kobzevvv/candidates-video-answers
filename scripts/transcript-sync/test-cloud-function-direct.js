#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

const CLOUD_FUNCTION_URL = process.env.CLOUD_FUNCTION_URL;

async function testCloudFunction() {
  console.log('🧪 Testing Cloud Function directly...\n');
  
  if (!CLOUD_FUNCTION_URL) {
    console.error('❌ CLOUD_FUNCTION_URL is not set');
    process.exit(1);
  }
  
  console.log(`🔗 Cloud Function URL: ${CLOUD_FUNCTION_URL}`);
  
  const testData = {
    candidate_id: 'test-candidate',
    interview_id: 'test-interview',
    question: 'What is your experience with cloud computing?',
    answer: 'I have 5 years of experience working with AWS and Google Cloud Platform, implementing serverless architectures and container orchestration.',
    gpt_model: 'google/gemini-1.5-flash'
  };
  
  try {
    console.log('\n📤 Sending POST request with test data...');
    console.log('📦 Request data:', JSON.stringify(testData, null, 2));
    
    const response = await axios.post(CLOUD_FUNCTION_URL, testData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000,
      validateStatus: () => true // Don't throw on any status
    });
    
    console.log(`\n📊 Response Status: ${response.status}`);
    console.log('📋 Response Headers:', response.headers);
    console.log('📦 Response Data:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200) {
      console.log('\n✅ Cloud function is working!');
      
      // Validate response structure
      if (response.data.evaluation) {
        console.log('\n📈 Evaluation scores:');
        console.log(`   Addressing: ${response.data.evaluation.addressing}/10`);
        console.log(`   Specificity: ${response.data.evaluation.be_specific}/10`);
        console.log(`   Openness: ${response.data.evaluation.openness}/10`);
      }
    } else if (response.status === 500 && response.data.message?.includes('GITHUB_TOKEN')) {
      console.error('\n❌ Cloud function error: GITHUB_TOKEN not configured');
      console.error('   The cloud function needs GITHUB_TOKEN environment variable set');
      console.error('   This should be set during deployment via PAT_GIT_HUB secret');
    } else {
      console.error(`\n❌ Cloud function returned error status: ${response.status}`);
    }
    
  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   Could not connect to cloud function');
    }
  }
}

testCloudFunction();