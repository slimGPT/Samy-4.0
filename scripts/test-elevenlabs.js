#!/usr/bin/env node

/**
 * Test ElevenLabs API
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function testElevenLabs() {
  console.log('🔊 Testing ElevenLabs API...\n');

  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('❌ ELEVENLABS_API_KEY not found in environment');
    console.log('💡 Make sure .env file exists in root with ELEVENLABS_API_KEY');
    process.exit(1);
  }

  console.log('✅ API Key found:', process.env.ELEVENLABS_API_KEY.substring(0, 15) + '...');

  try {
    const axios = require('../apps/api/node_modules/axios').default;

    const voiceId = 'aEO01A4wXwd1O8GPgGlF'; // Arabella
    const testText = 'Hello! This is a test of the ElevenLabs voice system.';

    console.log('\n📡 Testing ElevenLabs API connection...');
    console.log(`   Voice: Arabella (${voiceId})`);
    console.log(`   Text: "${testText}"`);

    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: testText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.71,
          similarity_boost: 0.85,
        },
      },
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
        timeout: 30000,
      }
    );

    console.log(`✅ ElevenLabs API is working!`);
    console.log(`   Audio size: ${response.data.byteLength} bytes`);
    
    // Save test file
    const testFile = path.join(__dirname, '..', 'temp', 'test-elevenlabs.mp3');
    const tempDir = path.dirname(testFile);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    fs.writeFileSync(testFile, response.data);
    console.log(`   Saved to: ${testFile}`);
    console.log('\n🎉 ElevenLabs is working correctly!');
    console.log('💡 Play the test file to verify voice quality\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ElevenLabs API Error:', error.message);
    
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data?.toString() || 'No data');
      
      if (error.response.status === 401) {
        console.error('\n💡 Your ElevenLabs API key is invalid');
        console.error('   Get a new key at: https://elevenlabs.io/app/settings/api-keys');
      } else if (error.response.status === 429) {
        console.error('\n💡 Rate limit exceeded or quota exhausted');
        console.error('   Check your usage at: https://elevenlabs.io/app/usage');
      }
    }
    
    process.exit(1);
  }
}

testElevenLabs();

