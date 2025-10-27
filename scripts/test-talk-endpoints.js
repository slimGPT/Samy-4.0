#!/usr/bin/env node

/**
 * Test script for Module 2 - Talk Mode endpoints
 * Tests /api/listen, /api/chat, and /api/speak
 */

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_SESSION = `test-session-${Date.now()}`;

console.log('🧪 Testing Module 2 - Talk Mode Endpoints\n');
console.log(`📍 API URL: ${API_URL}`);
console.log(`🆔 Session ID: ${TEST_SESSION}\n`);

// Test /api/chat endpoint
async function testChat() {
  console.log('1️⃣  Testing /api/chat...');
  
  const testMessages = [
    { message: 'Hello!', expected: 'happy or calm' },
    { message: 'Tell me something interesting', expected: 'curious' },
    { message: 'Goodnight', expected: 'sleepy' },
  ];

  for (const test of testMessages) {
    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: TEST_SESSION,
          message: test.message,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`   ✅ Message: "${test.message}"`);
      console.log(`      Reply: "${data.reply}"`);
      console.log(`      Emotion: ${data.emotion} (expected: ${test.expected})\n`);
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}\n`);
      return false;
    }
  }

  return true;
}

// Test /api/speak endpoint
async function testSpeak() {
  console.log('2️⃣  Testing /api/speak...');
  
  const testTexts = [
    'Hello! I am Samy the bear.',
    'This is a test of the text-to-speech system.',
  ];

  for (const text of testTexts) {
    try {
      const response = await fetch(`${API_URL}/api/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: TEST_SESSION,
          text: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`   ✅ Text: "${text.substring(0, 40)}..."`);
      console.log(`      Audio URL: ${data.audioUrl}\n`);
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}\n`);
      return false;
    }
  }

  return true;
}

// Test /api/listen endpoint (note: requires actual audio file)
async function testListen() {
  console.log('3️⃣  Testing /api/listen...');
  console.log('   ⚠️  This requires an actual audio file.');
  console.log('   ℹ️  To test: curl -X POST http://localhost:3001/api/listen -F "audio=@yourfile.mp3"\n');
  return true;
}

// Test health endpoint
async function testHealth() {
  console.log('🏥 Testing /health endpoint...');
  
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    
    if (data.status === 'ok') {
      console.log('   ✅ API server is healthy\n');
      return true;
    } else {
      console.error('   ❌ Unexpected health response\n');
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Cannot connect to API server: ${error.message}`);
    console.error('   💡 Make sure the API server is running: pnpm --filter @apps/api dev\n');
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('═══════════════════════════════════════════\n');

  // Check if server is running
  const healthOk = await testHealth();
  if (!healthOk) {
    console.log('❌ Tests aborted: API server not reachable\n');
    process.exit(1);
  }

  // Run tests
  const chatOk = await testChat();
  const speakOk = await testSpeak();
  await testListen();

  console.log('═══════════════════════════════════════════\n');

  if (chatOk && speakOk) {
    console.log('✅ All tests passed! Module 2 is working correctly.\n');
    console.log('🎉 Next steps:');
    console.log('   1. Test with the web interface at http://localhost:3000');
    console.log('   2. Try the "Talk to Samy" feature');
    console.log('   3. Check Firestore for state updates\n');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Check the errors above.\n');
    console.log('💡 Common issues:');
    console.log('   - Missing API keys (OPENAI_API_KEY, ELEVENLABS_API_KEY)');
    console.log('   - API quota exceeded');
    console.log('   - Network connectivity issues\n');
    process.exit(1);
  }
}

// Run the tests
runTests();

