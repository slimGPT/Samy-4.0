#!/usr/bin/env node

/**
 * Environment Variables Verification Script
 * Run this to check if all required environment variables are set
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Environment Configuration...\n');

// Colors for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

const success = (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`);
const error = (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`);
const warning = (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`);
const info = (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`);

let allGood = true;

// Check root .env file
console.log('📄 Checking Root .env file...');
const rootEnvPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(rootEnvPath)) {
  success('Root .env file exists');
  
  const rootEnv = fs.readFileSync(rootEnvPath, 'utf-8');
  const checkVar = (varName, optional = false) => {
    if (rootEnv.includes(`${varName}=`) && !rootEnv.includes(`${varName}=\n`) && !rootEnv.includes(`${varName}= `)) {
      success(`  ${varName} is set`);
      return true;
    } else {
      if (optional) {
        warning(`  ${varName} is not set (optional)`);
      } else {
        error(`  ${varName} is missing or empty`);
        allGood = false;
      }
      return false;
    }
  };

  // Check API keys
  checkVar('OPENAI_API_KEY', true);
  checkVar('ELEVENLABS_API_KEY', true);
  
  // Check Firebase Admin SDK
  checkVar('FIREBASE_PROJECT_ID');
  checkVar('FIREBASE_CLIENT_EMAIL');
  checkVar('FIREBASE_PRIVATE_KEY');
  
} else {
  error('Root .env file not found!');
  info('  Create .env in the root directory');
  allGood = false;
}

console.log('');

// Check apps/web/.env.local file
console.log('📄 Checking apps/web/.env.local file...');
const webEnvPath = path.join(__dirname, '..', 'apps', 'web', '.env.local');
if (fs.existsSync(webEnvPath)) {
  success('apps/web/.env.local file exists');
  
  const webEnv = fs.readFileSync(webEnvPath, 'utf-8');
  const checkWebVar = (varName, optional = false) => {
    if (webEnv.includes(`${varName}=`) && !webEnv.includes(`${varName}=\n`) && !webEnv.includes(`${varName}= `)) {
      success(`  ${varName} is set`);
      return true;
    } else {
      if (optional) {
        warning(`  ${varName} is not set (optional)`);
      } else {
        error(`  ${varName} is missing or empty`);
        allGood = false;
      }
      return false;
    }
  };

  checkWebVar('NEXT_PUBLIC_FIREBASE_API_KEY');
  checkWebVar('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
  checkWebVar('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  checkWebVar('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET');
  checkWebVar('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
  checkWebVar('NEXT_PUBLIC_FIREBASE_APP_ID');
  checkWebVar('NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID', true);
  checkWebVar('NEXT_PUBLIC_API_URL');
  
} else {
  error('apps/web/.env.local file not found!');
  info('  Create .env.local in apps/web/ directory');
  info('  See ENV_REFERENCE.md for the complete template');
  allGood = false;
}

console.log('');

// Check Firebase config files
console.log('📄 Checking Firebase configuration files...');
const firebaseRcPath = path.join(__dirname, '..', '.firebaserc');
if (fs.existsSync(firebaseRcPath)) {
  success('.firebaserc exists');
} else {
  warning('.firebaserc not found (needed for Firebase deployment)');
}

const firestoreRulesPath = path.join(__dirname, '..', 'firestore.rules');
if (fs.existsSync(firestoreRulesPath)) {
  success('firestore.rules exists');
} else {
  error('firestore.rules not found');
  allGood = false;
}

const storageRulesPath = path.join(__dirname, '..', 'storage.rules');
if (fs.existsSync(storageRulesPath)) {
  success('storage.rules exists');
} else {
  error('storage.rules not found');
  allGood = false;
}

console.log('');

// Final verdict
console.log('═══════════════════════════════════════════');
if (allGood) {
  success('All environment variables are configured! ✨');
  console.log('');
  info('Next steps:');
  info('  1. Enable Firestore Database in Firebase Console');
  info('  2. Enable Firebase Storage in Firebase Console');
  info('  3. Deploy rules: firebase deploy --only firestore:rules,storage');
  info('  4. Run: pnpm install');
  info('  5. Start API: pnpm --filter @apps/api dev');
  info('  6. Start Web: pnpm --filter @apps/web dev');
} else {
  error('Some environment variables are missing!');
  console.log('');
  info('Please check the errors above and fix them.');
  info('See ENV_REFERENCE.md for the complete configuration.');
}
console.log('═══════════════════════════════════════════\n');

process.exit(allGood ? 0 : 1);

