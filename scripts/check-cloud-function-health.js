#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

const CLOUD_FUNCTION_URL = process.env.CLOUD_FUNCTION_URL;

async function checkHealth() {
  console.log('🏥 Checking Cloud Function health...\n');
  
  if (!CLOUD_FUNCTION_URL) {
    console.error('❌ CLOUD_FUNCTION_URL is not set');
    process.exit(1);
  }
  
  console.log(`🔗 Cloud Function URL: ${CLOUD_FUNCTION_URL}`);
  
  try {
    // First check the health endpoint
    console.log('\n📋 Checking /health endpoint...');
    const healthUrl = CLOUD_FUNCTION_URL.replace(/\/$/, '') + '/health';
    
    const healthResponse = await axios.get(healthUrl, {
      timeout: 10000,
      validateStatus: () => true
    });
    
    console.log(`📊 Health Status: ${healthResponse.status}`);
    console.log('📦 Health Data:', JSON.stringify(healthResponse.data, null, 2));
    
    if (healthResponse.data?.hasToken === false) {
      console.error('\n❌ CRITICAL: Cloud Function does not have GITHUB_TOKEN configured!');
      console.error('   The function cannot call GitHub Models API without this token.');
      console.error('\n🔧 To fix this:');
      console.error('   1. Make sure PAT_GIT_HUB secret is set in GitHub repository settings');
      console.error('   2. Re-deploy the Cloud Function using the deploy workflow');
      console.error('   3. Or manually update the function environment variables in Google Cloud Console');
      return false;
    }
    
    console.log('\n✅ Cloud Function health check passed!');
    return true;
    
  } catch (error) {
    console.error('\n❌ Health check failed:', error.message);
    return false;
  }
}

async function main() {
  const isHealthy = await checkHealth();
  
  if (!isHealthy) {
    console.log('\n📝 Next steps:');
    console.log('1. Check if PAT_GIT_HUB secret exists in GitHub repository settings');
    console.log('2. Trigger the "Deploy AI Evaluation Function" workflow to redeploy');
    console.log('3. Or manually set GITHUB_TOKEN in Google Cloud Function console');
    process.exit(1);
  }
}

main();