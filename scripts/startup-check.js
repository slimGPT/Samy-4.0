#!/usr/bin/env node

/**
 * Comprehensive Startup Validation for Candy AI
 * Run this before starting the app to ensure everything is configured
 */

const path = require('path');
const fs = require('fs');

// Simple .env parser (no external dependencies)
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  
  content.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      env[key] = value;
    }
  });
  
  return env;
}

// Load environment variables from .env files
const rootEnv = loadEnvFile(path.join(__dirname, '..', '.env'));
const apiEnv = loadEnvFile(path.join(__dirname, '..', 'apps', 'api', '.env'));
const env = { ...rootEnv, ...apiEnv, ...process.env };

console.log('\n╔════════════════════════════════════════════════╗');
console.log('║   🔍 Candy AI Startup Validation Check        ║');
console.log('╚════════════════════════════════════════════════╝\n');

let hasErrors = false;
let hasWarnings = false;

// Check 1: Environment files
console.log('📂 Checking environment files...');
const rootEnvPath = path.join(__dirname, '..', '.env');
const apiEnvPath = path.join(__dirname, '..', 'apps', 'api', '.env');

if (fs.existsSync(rootEnvPath)) {
  console.log('   ✅ Root .env file exists');
} else if (fs.existsSync(apiEnvPath)) {
  console.log('   ✅ API .env file exists');
} else {
  console.log('   ❌ No .env file found!');
  console.log('   📝 Create a .env file in the project root with your API keys');
  hasErrors = true;
}

// Check 2: OpenAI API Key
console.log('\n🤖 Checking OpenAI Configuration...');
if (env.OPENAI_API_KEY) {
  const key = env.OPENAI_API_KEY;
  if (key.startsWith('sk-') && key.length > 40) {
    console.log('   ✅ OpenAI API key found (format looks valid)');
    console.log(`   📋 Key: ${key.substring(0, 15)}...${key.substring(key.length - 4)}`);
  } else {
    console.log('   ⚠️  OpenAI API key found but format looks suspicious');
    console.log(`   📋 Key length: ${key.length} chars`);
    hasWarnings = true;
  }
} else {
  console.log('   ❌ OPENAI_API_KEY not found');
  console.log('   💡 Add to .env: OPENAI_API_KEY=sk-...');
  hasErrors = true;
}

// Check 3: ElevenLabs API Key
console.log('\n🔊 Checking ElevenLabs Configuration...');
if (env.ELEVENLABS_API_KEY) {
  const key = env.ELEVENLABS_API_KEY;
  if (key.length > 20) {
    console.log('   ✅ ElevenLabs API key found (format looks valid)');
    console.log(`   📋 Key: ${key.substring(0, 15)}...${key.substring(key.length - 4)}`);
  } else {
    console.log('   ⚠️  ElevenLabs API key found but seems too short');
    hasWarnings = true;
  }
} else {
  console.log('   ⚠️  ELEVENLABS_API_KEY not found');
  console.log('   💡 Recommended: Add to .env: ELEVENLABS_API_KEY=...');
  console.log('   ℹ️  Will use OpenAI Whisper as fallback');
  hasWarnings = true;
}

// Check 4: STT Service availability
console.log('\n🎤 Checking Speech-to-Text Services...');
if (env.OPENAI_API_KEY && env.ELEVENLABS_API_KEY) {
  console.log('   ✅ Dual-service setup (OpenAI + ElevenLabs)');
  console.log('   🛡️  Redundancy enabled - STT will be highly reliable!');
} else if (env.OPENAI_API_KEY) {
  console.log('   ✅ OpenAI Whisper available (recommended primary)');
  console.log('   💡 Consider adding ElevenLabs for backup');
} else if (env.ELEVENLABS_API_KEY) {
  console.log('   ✅ ElevenLabs available');
  console.log('   ⚠️  No backup service - add OPENAI_API_KEY for reliability');
  hasWarnings = true;
} else {
  console.log('   ❌ NO STT SERVICE AVAILABLE!');
  console.log('   🚫 Voice chat will NOT work');
  hasErrors = true;
}

// Check 5: Firebase (optional for full mode)
console.log('\n🔥 Checking Firebase Configuration...');
const minimalMode = env.MINIMAL_MODE === 'true';
if (minimalMode) {
  console.log('   ℹ️  MINIMAL_MODE enabled - Firebase not required');
} else {
  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    console.log('   ✅ Firebase credentials found');
  } else {
    console.log('   ⚠️  Firebase credentials incomplete');
    console.log('   💡 Either set MINIMAL_MODE=true or configure Firebase');
    hasWarnings = true;
  }
}

// Check 6: Node modules
console.log('\n📦 Checking dependencies...');
const apiNodeModules = path.join(__dirname, '..', 'apps', 'api', 'node_modules');
const webNodeModules = path.join(__dirname, '..', 'apps', 'web', 'node_modules');

if (fs.existsSync(apiNodeModules)) {
  console.log('   ✅ API dependencies installed');
} else {
  console.log('   ❌ API dependencies missing');
  console.log('   💡 Run: pnpm install');
  hasErrors = true;
}

if (fs.existsSync(webNodeModules)) {
  console.log('   ✅ Web dependencies installed');
} else {
  console.log('   ❌ Web dependencies missing');
  console.log('   💡 Run: pnpm install');
  hasErrors = true;
}

// Summary
console.log('\n' + '═'.repeat(50));
if (hasErrors) {
  console.log('❌ STARTUP CHECK FAILED - Critical issues found');
  console.log('   Please fix the errors above before starting the app\n');
  process.exit(1);
} else if (hasWarnings) {
  console.log('⚠️  STARTUP CHECK PASSED with warnings');
  console.log('   The app will run, but consider addressing warnings\n');
  process.exit(0);
} else {
  console.log('✅ STARTUP CHECK PASSED - All systems ready!');
  console.log('   You can now start the app with confidence\n');
  process.exit(0);
}

