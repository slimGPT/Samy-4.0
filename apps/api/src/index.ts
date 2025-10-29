// Load environment variables FIRST before anything else
import dotenv from 'dotenv';
import path from 'path';

// Load from root .env
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config(); // Also try default locations

console.log('📍 Working directory:', process.cwd());

// Check if minimal mode is enabled
const isMinimalMode = process.env.MINIMAL_MODE === 'true';

if (isMinimalMode) {
  console.log('🔧 MODE: MINIMAL - Core AI Pipeline Only');
  console.log('   Firebase and Emotion Engine disabled');
} else {
  console.log('🔧 MODE: FULL - Complete Candy AI Experience');
  console.log('   Firebase, Emotions, and User Context enabled');
}

console.log('✅ Environment loaded');
console.log('   - OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Found' : '❌ Missing');
console.log('   - ELEVENLABS_API_KEY:', process.env.ELEVENLABS_API_KEY ? '✅ Found' : '❌ Missing');

if (!isMinimalMode) {
  console.log('   - FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? '✅ Found' : '❌ Missing');
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

app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
});

