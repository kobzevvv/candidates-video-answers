#!/usr/bin/env node

const { GITHUB_MODELS, MODEL_IDS, RECOMMENDED_MODELS, DEFAULT_MODEL } = require('../ai-evaluation/config/github-models');

console.log('\n🤖 GitHub Models API - Available Models');
console.log('=====================================\n');

console.log(`📊 Total models available: ${MODEL_IDS.length}`);
console.log(`⭐ Recommended models: ${RECOMMENDED_MODELS.length}`);
console.log(`🔷 Default model: ${DEFAULT_MODEL}\n`);

console.log('All Available Models:');
console.log('─'.repeat(100));
console.log('Model ID'.padEnd(40) + 'Provider'.padEnd(15) + 'Description'.padEnd(45));
console.log('─'.repeat(100));

MODEL_IDS.forEach(modelId => {
  const model = GITHUB_MODELS[modelId];
  const recommended = model.recommended ? '⭐ ' : '   ';
  const defaultMark = model.default ? ' (DEFAULT)' : '';
  console.log(
    `${recommended}${modelId}${defaultMark}`.padEnd(40) + 
    model.provider.padEnd(15) + 
    model.description
  );
});

console.log('─'.repeat(100));
console.log('\nUsage Examples:');
console.log('─'.repeat(50));
console.log('1. Run evaluation with default model:');
console.log('   node evaluate-by-interview.js <interview_id>');
console.log('\n2. Run evaluation with specific model:');
console.log('   node evaluate-by-interview.js <interview_id> gpt-4o');
console.log('   node evaluate-by-interview.js <interview_id> claude-3-5-sonnet-latest');
console.log('   node evaluate-by-interview.js <interview_id> meta-llama/llama-3.1-70b-instruct');
console.log('\n3. Test all recommended models:');
console.log('   node scripts/test-all-models.js');
console.log('\n⭐ = Recommended models for best results\n');