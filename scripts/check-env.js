#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('\n🔍 Checking Environment Variables...\n');

const required = {
  '✅ OpenAI': process.env.OPENAI_API_KEY,
  '🔊 ElevenLabs': process.env.ELEVENLABS_API_KEY,
  '🔥 Firebase Project ID': process.env.FIREBASE_PROJECT_ID,
  '🔥 Firebase Client Email': process.env.FIREBASE_CLIENT_EMAIL,
  '🔥 Firebase Private Key': process.env.FIREBASE_PRIVATE_KEY,
  '🌐 Next Public Project ID': process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  '🌐 Next Public API Key': process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
};

let missing = [];

for (const [name, value] of Object.entries(required)) {
  if (!value) {
    console.log(`❌ ${name}: MISSING`);
    missing.push(name);
  } else {
    const preview = value.substring(0, 20) + '...';
    console.log(`✅ ${name}: ${preview}`);
  }
}

if (missing.length > 0) {
  console.log('\n❌ MISSING CREDENTIALS:\n');
  console.log('Open your .env file and add these:\n');
  
  if (missing.some(m => m.includes('Firebase'))) {
    console.log('📋 Get Firebase credentials:');
    console.log('   1. Go to: https://console.firebase.google.com/project/candy-ai-78a90/settings/serviceaccounts/adminsdk');
    console.log('   2. Click "Generate new private key"');
    console.log('   3. Add to .env:\n');
    console.log('FIREBASE_PROJECT_ID=candy-ai-78a90');
    console.log('FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@candy-ai-78a90.iam.gserviceaccount.com');
    console.log('FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"');
    console.log('\n   4. Get web config from: https://console.firebase.google.com/project/candy-ai-78a90/settings/general');
    console.log('   5. Add:\n');
    console.log('NEXT_PUBLIC_FIREBASE_PROJECT_ID=candy-ai-78a90');
    console.log('NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDJmcpzpp_WoGP8yw_dn9PUezI8Ov5CzkE');
    console.log('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=candy-ai-78a90.firebaseapp.com');
    console.log('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=candy-ai-78a90.firebasestorage.app');
    console.log('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=130149229887');
    console.log('NEXT_PUBLIC_FIREBASE_APP_ID=1:130149229887:web:edf79cc6088f6df689df8a');
  }
  
  process.exit(1);
} else {
  console.log('\n🎉 All credentials present!\n');
}

