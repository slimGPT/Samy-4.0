/**
 * Initialize a demo session in Firestore
 * Run with: node scripts/init-demo-session.js
 */

const admin = require('firebase-admin');
require('dotenv').config();

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function initDemoSession() {
  const sessionId = 'demo-session';
  
  const demoData = {
    state: {
      phase: 'idle',
      emotion: 'calm',
      energy: 0.5,
      lastAudioUrl: null,
      lang: 'en',
      updatedAt: Date.now(),
    },
    metrics: {
      turns: 0,
      whQuestions: 0,
      sessionMinutes: 0,
      ci: 0,
    },
  };

  try {
    await db.collection('sessions').doc(sessionId).set(demoData);
    console.log('✅ Demo session created successfully!');
    console.log('📍 Session ID:', sessionId);
    console.log('📊 Initial state:', JSON.stringify(demoData.state, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating demo session:', error);
    process.exit(1);
  }
}

initDemoSession();

