/**
 * Test script for Candy AI Minimal Mode
 * Tests the core pipeline: Whisper → GPT → ElevenLabs
 */

const API_URL = process.env.API_URL || 'http://localhost:3001';

console.log('🧪 Testing Candy AI Minimal Mode Pipeline\n');
console.log(`API URL: ${API_URL}\n`);

async function testHealthCheck() {
  console.log('1️⃣ Testing Health Check...');
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    
    if (data.status === 'ok' && data.mode === 'minimal') {
      console.log('✅ Health check passed');
      console.log(`   Mode: ${data.mode}`);
      console.log(`   Timestamp: ${new Date(data.timestamp).toISOString()}\n`);
      return true;
    } else {
      console.error('❌ Health check failed:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ Health check error:', error.message);
    console.error('   Is the API server running?\n');
    return false;
  }
}

async function testPipeline() {
  console.log('2️⃣ Testing Full Pipeline (/api/test)...');
  try {
    const startTime = Date.now();
    
    const response = await fetch(`${API_URL}/api/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hey babe, how are you doing?'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('❌ Pipeline test failed:', errorData);
      return false;
    }
    
    const data = await response.json();
    const duration = Date.now() - startTime;
    
    console.log('✅ Pipeline test passed');
    console.log(`   Input: "${data.test.input}"`);
    console.log(`   Output: "${data.test.output}"`);
    console.log(`   Audio URL: ${data.test.audioUrl}`);
    console.log('\n   📊 Metrics:');
    console.log(`   - Whisper: ${data.metrics.whisper}ms`);
    console.log(`   - GPT: ${data.metrics.gpt}ms`);
    console.log(`   - TTS: ${data.metrics.tts}ms`);
    console.log(`   - Total: ${data.metrics.total}ms`);
    console.log(`   - Target Met: ${data.metrics.targetMet ? '✅ YES' : '❌ NO'}`);
    console.log(`   - Request Duration: ${duration}ms\n`);
    
    if (data.metrics.total < 3000) {
      console.log('✅ Latency target met (< 3000ms)\n');
    } else {
      console.log('⚠️ Latency target not met (> 3000ms)\n');
      console.log('   Tips to improve latency:');
      console.log('   - Check your internet connection');
      console.log('   - Verify OpenAI and ElevenLabs API status');
      console.log('   - Try again (first request may be slower)\n');
    }
    
    return data.metrics.targetMet;
  } catch (error) {
    console.error('❌ Pipeline test error:', error.message);
    console.error('   Stack:', error.stack);
    return false;
  }
}

async function testTalkEndpoint() {
  console.log('3️⃣ Testing Talk Endpoint (/talk)...');
  try {
    const response = await fetch(`${API_URL}/talk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Tell me a joke'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('❌ Talk endpoint failed:', errorData);
      return false;
    }
    
    const data = await response.json();
    
    console.log('✅ Talk endpoint passed');
    console.log(`   Reply: "${data.reply}"`);
    console.log(`   Audio URL: ${data.audioUrl}`);
    console.log(`   GPT Duration: ${data.metrics.gpt}ms`);
    console.log(`   TTS Duration: ${data.metrics.tts}ms`);
    console.log(`   Total Duration: ${data.metrics.total}ms\n`);
    
    return true;
  } catch (error) {
    console.error('❌ Talk endpoint error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Candy AI - Minimal Mode Pipeline Test');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const results = {
    health: false,
    pipeline: false,
    talk: false,
  };
  
  // Test 1: Health Check
  results.health = await testHealthCheck();
  
  if (!results.health) {
    console.log('\n❌ TESTS FAILED - API server is not responding');
    console.log('   Please start the API server with: cd apps/api && pnpm dev\n');
    process.exit(1);
  }
  
  // Test 2: Full Pipeline
  results.pipeline = await testPipeline();
  
  // Test 3: Talk Endpoint
  results.talk = await testTalkEndpoint();
  
  // Summary
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Test Summary');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`   Health Check:     ${results.health ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Pipeline Test:    ${results.pipeline ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Talk Endpoint:    ${results.talk ? '✅ PASS' : '❌ FAIL'}`);
  console.log('\n═══════════════════════════════════════════════════════════════\n');
  
  const allPassed = results.health && results.pipeline && results.talk;
  
  if (allPassed) {
    console.log('✅ ALL TESTS PASSED');
    console.log('   Candy AI minimal mode is working correctly!\n');
    console.log('   Next steps:');
    console.log('   - Open http://localhost:3000 to use the web interface');
    console.log('   - Test with real voice input');
    console.log('   - Monitor latency and optimize if needed\n');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED');
    console.log('   Please check the error messages above and:');
    console.log('   - Verify API server is running (cd apps/api && pnpm dev)');
    console.log('   - Check OPENAI_API_KEY is set correctly');
    console.log('   - Check ELEVENLABS_API_KEY is set correctly');
    console.log('   - Review API server logs for errors\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ FATAL ERROR:', error.message);
  console.error(error.stack);
  process.exit(1);
});

