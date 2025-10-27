#!/usr/bin/env node

/**
 * Test OpenAI API Key
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Try to load OpenAI from the API workspace
let OpenAI;
try {
  OpenAI = require('../apps/api/node_modules/openai').default;
} catch (e) {
  console.error('❌ OpenAI package not found. Installing...');
  console.log('Run: cd apps/api && pnpm install\n');
  process.exit(1);
}

async function testOpenAI() {
  console.log('🔑 Testing OpenAI API Key...\n');

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in environment');
    console.log('💡 Make sure .env file exists in root with OPENAI_API_KEY');
    process.exit(1);
  }

  console.log('✅ API Key found:', process.env.OPENAI_API_KEY.substring(0, 20) + '...');

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log('\n📡 Testing OpenAI API connection...');
    
    // Test with a simple completion
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Say "test successful" in 2 words' }],
      max_tokens: 10,
    });

    console.log('✅ OpenAI API is working!');
    console.log('Response:', completion.choices[0].message.content);
    console.log('\n🎉 Your OpenAI key is valid and working!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ OpenAI API Error:', error.message);
    
    if (error.status === 401) {
      console.error('💡 Your API key is invalid or expired');
      console.error('   Get a new key at: https://platform.openai.com/api-keys');
    } else if (error.status === 429) {
      console.error('💡 Rate limit exceeded or insufficient quota');
      console.error('   Check usage at: https://platform.openai.com/usage');
    } else if (error.code === 'insufficient_quota') {
      console.error('💡 Your OpenAI account has no credits');
      console.error('   Add credits at: https://platform.openai.com/account/billing');
    }
    
    process.exit(1);
  }
}

testOpenAI();

