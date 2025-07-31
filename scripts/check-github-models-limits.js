#!/usr/bin/env node

const axios = require('axios');

async function checkGitHubModelsRateLimits() {
  const token = process.env.GITHUB_TOKEN;
  
  if (!token) {
    console.error('❌ GITHUB_TOKEN environment variable is not set');
    process.exit(1);
  }

  try {
    console.log('🔍 Checking GitHub Models API rate limits...\n');
    
    // Check rate limits via GitHub API
    const response = await axios.get('https://api.github.com/rate_limit', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    const rateLimits = response.data;
    
    // Display core API limits
    console.log('📊 GitHub API Rate Limits:');
    console.log('========================');
    
    if (rateLimits.rate) {
      const core = rateLimits.rate;
      const resetTime = new Date(core.reset * 1000).toLocaleString();
      console.log(`\n🔵 Core API:`);
      console.log(`   Limit: ${core.limit} requests/hour`);
      console.log(`   Used: ${core.limit - core.remaining} requests`);
      console.log(`   Remaining: ${core.remaining} requests`);
      console.log(`   Resets at: ${resetTime}`);
    }

    // Check if there's specific models API limits
    if (rateLimits.models) {
      const models = rateLimits.models;
      const resetTime = new Date(models.reset * 1000).toLocaleString();
      console.log(`\n🤖 Models API:`);
      console.log(`   Limit: ${models.limit} requests/hour`);
      console.log(`   Used: ${models.limit - models.remaining} requests`);
      console.log(`   Remaining: ${models.remaining} requests`);
      console.log(`   Resets at: ${resetTime}`);
    }

    // Calculate usage percentage
    if (rateLimits.rate) {
      const usagePercent = ((rateLimits.rate.limit - rateLimits.rate.remaining) / rateLimits.rate.limit * 100).toFixed(1);
      console.log(`\n📈 Usage: ${usagePercent}% of hourly limit`);
      
      if (usagePercent > 80) {
        console.log('⚠️  WARNING: Approaching rate limit!');
      }
    }

    // Test GitHub Models endpoint
    console.log('\n🧪 Testing GitHub Models API endpoint...');
    try {
      const modelsResponse = await axios.get('https://models.github.ai/models', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      console.log('✅ GitHub Models API is accessible');
      console.log(`📋 Available models: ${modelsResponse.data.length || 'Unable to count'}`);
      
      // Show rate limit headers from the response
      const headers = modelsResponse.headers;
      if (headers['x-ratelimit-limit']) {
        console.log('\n🔄 Models API Rate Limit Headers:');
        console.log(`   Limit: ${headers['x-ratelimit-limit']}`);
        console.log(`   Remaining: ${headers['x-ratelimit-remaining']}`);
        console.log(`   Reset: ${new Date(parseInt(headers['x-ratelimit-reset']) * 1000).toLocaleString()}`);
      }
    } catch (error) {
      console.error('❌ Failed to access GitHub Models API');
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Message: ${error.response.data?.message || error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Error checking rate limits:', error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    }
    process.exit(1);
  }
}

// Run the check
checkGitHubModelsRateLimits();