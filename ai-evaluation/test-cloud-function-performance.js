#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

const CLOUD_FUNCTION_URL = process.env.CLOUD_FUNCTION_URL;

// Test payloads of different sizes
const TEST_CASES = [
  {
    name: 'Minimal',
    data: {
      candidate_id: 'test-perf',
      interview_id: 'test-perf',
      question: 'Hello?',
      answer: 'Hi',
      gpt_model: 'openai/gpt-4o-mini'
    }
  },
  {
    name: 'Small',
    data: {
      candidate_id: 'test-perf',
      interview_id: 'test-perf',
      question: 'What is your experience?',
      answer: 'I have 5 years of experience in software development.',
      gpt_model: 'openai/gpt-4o-mini'
    }
  },
  {
    name: 'Medium',
    data: {
      candidate_id: 'test-perf',
      interview_id: 'test-perf',
      question: 'Tell me about a challenging project you worked on and how you handled it?',
      answer: 'In my previous role, I led the development of a real-time analytics platform that processed millions of events per second. The main challenge was optimizing the data pipeline to handle peak loads while maintaining sub-second latency. I implemented a distributed architecture using Kafka for message queuing and Apache Flink for stream processing, which improved throughput by 300%.',
      gpt_model: 'openai/gpt-4o-mini'
    }
  }
];

async function testHealth() {
  console.log('🏥 Testing health endpoint...');
  try {
    const startTime = Date.now();
    const response = await axios.get(`${CLOUD_FUNCTION_URL}/health`, {
      timeout: 5000
    });
    const duration = Date.now() - startTime;
    
    console.log(`✅ Health check passed in ${duration}ms`);
    console.log('   Response:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testPerformance(testCase) {
  console.log(`\n📊 Testing ${testCase.name} payload...`);
  console.log(`   Question: ${testCase.data.question.substring(0, 50)}...`);
  console.log(`   Answer: ${testCase.data.answer.substring(0, 50)}...`);
  
  try {
    const startTime = Date.now();
    
    const response = await axios.post(CLOUD_FUNCTION_URL, testCase.data, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 120000, // 2 minute timeout
      validateStatus: () => true
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`⏱️  Response time: ${duration}ms`);
    console.log(`📈 Status: ${response.status}`);
    
    if (response.status === 200) {
      console.log('✅ Success!');
      if (response.data.evaluation) {
        console.log(`   Addressing: ${response.data.evaluation.addressing}/10`);
        console.log(`   Specificity: ${response.data.evaluation.be_specific}/10`);
        console.log(`   Openness: ${response.data.evaluation.openness}/10`);
      }
    } else {
      console.log('❌ Error response:', response.data);
    }
    
    return {
      name: testCase.name,
      duration: duration,
      status: response.status,
      success: response.status === 200
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Request failed after ${duration}ms:`, error.message);
    
    return {
      name: testCase.name,
      duration: duration,
      status: error.response?.status || 0,
      success: false,
      error: error.message
    };
  }
}

async function testConcurrent() {
  console.log('\n🔄 Testing concurrent requests...');
  
  const promises = [1, 2, 3].map(async (i) => {
    const startTime = Date.now();
    try {
      const response = await axios.post(CLOUD_FUNCTION_URL, {
        candidate_id: `test-concurrent-${i}`,
        interview_id: `test-concurrent-${i}`,
        question: 'Quick test?',
        answer: `Response ${i}`,
        gpt_model: 'openai/gpt-4o-mini'
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000
      });
      
      const duration = Date.now() - startTime;
      return { id: i, duration, status: response.status, success: true };
    } catch (error) {
      const duration = Date.now() - startTime;
      return { id: i, duration, status: error.response?.status || 0, success: false };
    }
  });
  
  const results = await Promise.all(promises);
  
  console.log('📊 Concurrent request results:');
  results.forEach(r => {
    console.log(`   Request ${r.id}: ${r.success ? '✅' : '❌'} ${r.duration}ms (Status: ${r.status})`);
  });
}

async function main() {
  console.log('🧪 Cloud Function Performance Test\n');
  
  if (!CLOUD_FUNCTION_URL) {
    console.error('❌ CLOUD_FUNCTION_URL environment variable is not set');
    process.exit(1);
  }
  
  console.log(`🔗 Testing: ${CLOUD_FUNCTION_URL}`);
  console.log(`📅 Time: ${new Date().toISOString()}\n`);
  
  // Test health endpoint
  const healthOk = await testHealth();
  if (!healthOk) {
    console.log('\n⚠️  Health check failed, but continuing with tests...\n');
  }
  
  // Test different payload sizes
  const results = [];
  for (const testCase of TEST_CASES) {
    const result = await testPerformance(testCase);
    results.push(result);
    
    // Wait between tests to avoid rate limits
    if (testCase !== TEST_CASES[TEST_CASES.length - 1]) {
      console.log('⏳ Waiting 5 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  // Test concurrent requests
  console.log('⏳ Waiting 10 seconds before concurrent test...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  await testConcurrent();
  
  // Summary
  console.log('\n📊 Performance Summary:');
  console.log('─'.repeat(50));
  results.forEach(r => {
    const status = r.success ? '✅' : '❌';
    console.log(`${status} ${r.name.padEnd(10)} ${r.duration.toString().padStart(6)}ms   Status: ${r.status}`);
  });
  
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const successRate = results.filter(r => r.success).length / results.length * 100;
  
  console.log('─'.repeat(50));
  console.log(`Average response time: ${Math.round(avgDuration)}ms`);
  console.log(`Success rate: ${successRate}%`);
  
  // Recommendations
  console.log('\n💡 Analysis:');
  if (avgDuration > 30000) {
    console.log('⚠️  Extremely slow response times detected (>30s)');
    console.log('   - Check cloud function logs for errors');
    console.log('   - Consider using a different model');
    console.log('   - Verify GITHUB_TOKEN has proper permissions');
  } else if (avgDuration > 10000) {
    console.log('⚠️  Slow response times detected (>10s)');
    console.log('   - Consider increasing cloud function memory');
    console.log('   - Check if cold starts are affecting performance');
  } else {
    console.log('✅ Response times are acceptable');
  }
  
  if (successRate < 100) {
    console.log('⚠️  Some requests failed');
    console.log('   - Check for rate limiting issues');
    console.log('   - Verify cloud function configuration');
  }
}

main().catch(console.error);