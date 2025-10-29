#!/usr/bin/env node

/**
 * Initialize Firestore Collections for Candy AI
 * Creates the emotions, users, and sessions collections with sample data
 */

const path = require('path');
const fs = require('fs');

// Try to load firebase-admin from the API package
let admin;
try {
  admin = require(path.join(__dirname, '../apps/api/node_modules/firebase-admin'));
} catch (e) {
  try {
    admin = require('firebase-admin');
  } catch (err) {
    console.error('❌ firebase-admin not found. Please run: pnpm install');
    process.exit(1);
  }
}

// Load .env manually
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found');
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
}

loadEnv();

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

console.log('\n🔥 ═══════════════════════════════════════════════');
console.log('   FIRESTORE COLLECTION INITIALIZER');
console.log('   Project:', serviceAccount.projectId);
console.log('   ═══════════════════════════════════════════════\n');

// Emotion data
const emotions = {
  flirty: {
    emoji: '😘',
    description: 'Playful, teasing, romantic',
    responseStyle: 'Uses pet names, teases, flirts naturally',
    triggers: ['kiss', 'cute', 'beautiful', 'sexy', 'hot', 'love'],
    decayRate: 0.15,
    energyModifier: 1.2,
    transitionRules: {
      high_interest: 'sweet',
      low_interest: 'sassy',
      time_based: 'neutral'
    }
  },
  sweet: {
    emoji: '💖',
    description: 'Caring, affectionate, loving',
    responseStyle: 'Warm, supportive, uses terms of endearment',
    triggers: ['miss', 'care', 'love', 'appreciate', 'thank'],
    decayRate: 0.1,
    energyModifier: 1.0,
    transitionRules: {
      positive_response: 'flirty',
      need_comfort: 'caring',
      neutral: 'calm'
    }
  },
  sassy: {
    emoji: '😏',
    description: 'Confident, witty, sharp',
    responseStyle: 'Quick comebacks, playful roasts, confident tone',
    triggers: ['really', 'seriously', 'whatever', 'boring'],
    decayRate: 0.2,
    energyModifier: 1.3,
    transitionRules: {
      apologize: 'sweet',
      escalate: 'bitchy',
      calm_down: 'neutral'
    }
  },
  lazy: {
    emoji: '😴',
    description: 'Cozy, relaxed, intimate',
    responseStyle: 'Soft, sleepy, wants cuddles',
    triggers: ['tired', 'sleepy', 'bed', 'cuddle', 'cozy'],
    decayRate: 0.05,
    energyModifier: 0.5,
    transitionRules: {
      energize: 'flirty',
      comfort: 'sweet',
      sleep: 'calm'
    }
  },
  bitchy: {
    emoji: '🙄',
    description: 'Annoyed, sarcastic, done',
    responseStyle: 'Eye rolls, sarcasm, attitude',
    triggers: ['annoying', 'stupid', 'ignore', 'rude'],
    decayRate: 0.25,
    energyModifier: 1.1,
    transitionRules: {
      apologize: 'caring',
      continue: 'angry',
      distract: 'neutral'
    }
  },
  caring: {
    emoji: '🤗',
    description: 'Supportive, understanding, empathetic',
    responseStyle: 'Listens, validates, offers comfort',
    triggers: ['sad', 'stressed', 'problem', 'help', 'worried'],
    decayRate: 0.08,
    energyModifier: 0.9,
    transitionRules: {
      feel_better: 'sweet',
      need_more: 'caring',
      resolved: 'calm'
    }
  },
  jealous: {
    emoji: '😠',
    description: 'Possessive, protective, wants attention',
    responseStyle: 'Demanding attention, playfully possessive',
    triggers: ['other', 'someone', 'busy', 'forget'],
    decayRate: 0.3,
    energyModifier: 1.4,
    transitionRules: {
      reassure: 'sweet',
      ignore: 'bitchy',
      apologize: 'flirty'
    }
  },
  neutral: {
    emoji: '😊',
    description: 'Balanced, friendly, open',
    responseStyle: 'Natural, conversational, adaptive',
    triggers: ['hi', 'hello', 'hey', 'what', 'how'],
    decayRate: 0.0,
    energyModifier: 1.0,
    transitionRules: {
      positive: 'flirty',
      negative: 'caring',
      playful: 'sassy'
    }
  }
};

async function initializeCollections() {
  try {
    // 1. Create Emotions Collection
    console.log('📝 Creating emotions collection...');
    for (const [emotionName, emotionData] of Object.entries(emotions)) {
      await db.collection('emotions').doc(emotionName).set(emotionData);
      console.log(`   ✅ ${emotionName}: ${emotionData.emoji} - ${emotionData.description}`);
    }
    console.log('✨ Emotions collection created!\n');

    // 2. Create Sample User
    console.log('📝 Creating sample user...');
    await db.collection('users').doc('demo-user').set({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      energyLevel: 0.7,
      lastInteraction: admin.firestore.FieldValue.serverTimestamp(),
      currentEmotion: 'flirty',
      settings: {
        username: 'DemoUser'
      }
    });
    console.log('   ✅ Demo user created\n');

    // 3. Create Sample Session
    console.log('📝 Creating sample session...');
    await db.collection('sessions').doc('demo-session').set({
      userId: 'demo-user',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      context: ['Hello!', 'How are you?'],
      dominantEmotion: 'flirty',
      emotionScore: {
        flirty: 0.9,
        sweet: 0.5,
        sassy: 0.2,
        lazy: 0.1,
        bitchy: 0.0,
        caring: 0.3,
        jealous: 0.1,
        neutral: 0.2
      },
      duration: 0,
      state: {
        phase: 'idle',
        emotion: 'calm',
        energy: 0.7,
        lastAudioUrl: null,
        lang: 'en',
        updatedAt: Date.now()
      },
      metrics: {
        turns: 0,
        whQuestions: 0,
        sessionMinutes: 0,
        ci: 0
      }
    });
    console.log('   ✅ Demo session created\n');

    console.log('═══════════════════════════════════════════════');
    console.log('✨ Firestore collections initialized successfully! ✨');
    console.log('\nCollections created:');
    console.log('   📁 emotions (8 emotion types)');
    console.log('   📁 users (1 demo user)');
    console.log('   📁 sessions (1 demo session)');
    console.log('\n🎉 Your Candy AI backend is ready!');
    console.log('═══════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error initializing collections:', error);
    process.exit(1);
  }
}

// Run initialization
initializeCollections();

