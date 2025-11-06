// Load environment variables FIRST before anything else
// Unified .env file at root level
import dotenv from 'dotenv';
import path from 'path';

// Load from root .env (monorepo root)
// Use process.cwd() for better compatibility with tsx watch
const rootEnvPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: rootEnvPath });

// Also try relative paths for flexibility
if (!process.env.OPENAI_API_KEY) {
  dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
  dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });
}

console.log('📍 Working directory:', process.cwd());

// Check if minimal mode is enabled
const isMinimalMode = process.env.MINIMAL_MODE === 'true';

if (isMinimalMode) {
  console.log('🔧 MODE: MINIMAL - Core AI Pipeline Only');
  console.log('   Firebase and Emotion Engine disabled');
} else {
  console.log('🔧 MODE: FULL - Complete SamyBear 4.0 Experience');
  console.log('   Firebase, Emotions, and User Context enabled');
}

console.log('✅ Environment loaded');
console.log('   - OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Found' : '❌ Missing');
console.log('   - ELEVENLABS_API_KEY:', process.env.ELEVENLABS_API_KEY ? '✅ Found' : '❌ Missing');

if (!isMinimalMode) {
  console.log('   - FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? '✅ Found' : '❌ Missing');
}

// Validate STT configuration
console.log('\n🎤 Speech-to-Text Configuration (ElevenLabs Only):');
if (process.env.ELEVENLABS_API_KEY) {
  console.log('   ✅ ElevenLabs STT (Primary and Only STT Service)');
  console.log('   🎯 Using ElevenLabs Real-Time STT for all transcription');
} else {
  console.error('   ❌ NO STT SERVICE AVAILABLE!');
  console.error('   Please configure ELEVENLABS_API_KEY');
}

// Load the appropriate app based on mode
let app;
if (isMinimalMode) {
  console.log('📦 Loading minimal app...');
  app = require('./app.minimal').default;
} else {
  console.log('📦 Loading full app...');
  app = require('./app.full').default;
}

const PORT = process.env.PORT || 3001;

// Validate API keys on startup
async function validateSTTServices() {
  console.log('\n🔍 Validating STT Services (ElevenLabs Only)...');
  
  const hasElevenLabs = !!process.env.ELEVENLABS_API_KEY;
  
  if (!hasElevenLabs) {
    console.error('❌ CRITICAL: No STT service configured!');
    console.error('   Add ELEVENLABS_API_KEY to your .env file');
    return false;
  }
  
  // Quick validation of API key format
  if (hasElevenLabs) {
    const key = process.env.ELEVENLABS_API_KEY || '';
    if (key.length > 20) {
      console.log('   ✅ ElevenLabs API key format looks valid');
    } else {
      console.warn('   ⚠️  ElevenLabs API key format may be invalid');
    }
  }
  
  console.log('✅ STT Configuration validated (ElevenLabs Only)\n');
  return true;
}

app.listen(PORT, async () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  
  // Validate STT services
  await validateSTTServices();
});

