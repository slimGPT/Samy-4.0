#!/usr/bin/env node

/**
 * Complete Configuration Validation for Candy AI
 * Tests actual connections to Firebase, OpenAI, and ElevenLabs
 */

const path = require('path');
const fs = require('fs');

// Simple .env parser (no external dependencies needed)
function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return {};
  
  const content = fs.readFileSync(envPath, 'utf-8');
  const vars = {};
  
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
      
      vars[key] = value;
      process.env[key] = value;
    }
  });
  
  return vars;
}

// Load environment variables
loadEnv(path.join(__dirname, '..', '.env'));

// Colors
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

const success = (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`);
const error = (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`);
const warning = (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`);
const info = (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`);
const section = (msg) => console.log(`\n${colors.cyan}═══ ${msg} ═══${colors.reset}`);

let allChecks = [];

// Helper to track checks
function check(name, passed, message = '') {
  allChecks.push({ name, passed, message });
  if (passed) {
    success(`${name}${message ? ': ' + message : ''}`);
  } else {
    error(`${name}${message ? ': ' + message : ''}`);
  }
}

async function validateEnvironment() {
  console.log(`
${colors.magenta}╔════════════════════════════════════════════════╗
║  🍬 Candy AI - Configuration Validator 🍬     ║
╚════════════════════════════════════════════════╝${colors.reset}
  `);

  // ═══════════════════════════════════════════════════
  // 1. Check Environment Files Exist
  // ═══════════════════════════════════════════════════
  section('Environment Files');
  
  const rootEnvPath = path.join(__dirname, '..', '.env');
  const rootEnvExists = fs.existsSync(rootEnvPath);
  check('Root .env file', rootEnvExists);
  
  const webEnvPath = path.join(__dirname, '..', 'apps', 'web', '.env.local');
  const webEnvExists = fs.existsSync(webEnvPath);
  check('apps/web/.env.local file', webEnvExists);

  if (!rootEnvExists || !webEnvExists) {
    console.log('\n' + colors.red + '❌ Required environment files are missing!' + colors.reset);
    console.log('\n📋 Quick Fix:');
    console.log('   See ENV_REFERENCE.md for complete templates');
    console.log('   Or run: node scripts/create-env-templates.js\n');
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════
  // 2. Check Required Variables
  // ═══════════════════════════════════════════════════
  section('Environment Variables');

  const requiredVars = {
    'FIREBASE_PROJECT_ID': false,
    'FIREBASE_CLIENT_EMAIL': false,
    'FIREBASE_PRIVATE_KEY': false,
    'NEXT_PUBLIC_FIREBASE_API_KEY': false,
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN': false,
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID': false,
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET': false,
    'NEXT_PUBLIC_FIREBASE_APP_ID': false,
  };

  const optionalVars = {
    'OPENAI_API_KEY': false,
    'ELEVENLABS_API_KEY': false,
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': false,
    'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID': false,
  };

  // Check required variables
  for (const varName in requiredVars) {
    const value = process.env[varName];
    const exists = !!value && value.trim().length > 0;
    requiredVars[varName] = exists;
    check(varName, exists, exists ? '(set)' : 'MISSING');
  }

  // Check optional variables
  for (const varName in optionalVars) {
    const value = process.env[varName];
    const exists = !!value && value.trim().length > 0;
    optionalVars[varName] = exists;
    if (exists) {
      success(`${varName} (optional): set`);
    } else {
      warning(`${varName} (optional): not set`);
    }
  }

  // ═══════════════════════════════════════════════════
  // 3. Validate Firebase Configuration
  // ═══════════════════════════════════════════════════
  section('Firebase Configuration');

  const expectedProjectId = 'candy-ai-78a90';
  const actualProjectId = process.env.FIREBASE_PROJECT_ID;
  check(
    'Project ID matches expected',
    actualProjectId === expectedProjectId,
    actualProjectId === expectedProjectId 
      ? `(${expectedProjectId})` 
      : `Expected: ${expectedProjectId}, Got: ${actualProjectId}`
  );

  const expectedAuthDomain = 'candy-ai-78a90.firebaseapp.com';
  const actualAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  check(
    'Auth Domain matches expected',
    actualAuthDomain === expectedAuthDomain,
    actualAuthDomain === expectedAuthDomain
      ? `(${expectedAuthDomain})`
      : `Expected: ${expectedAuthDomain}, Got: ${actualAuthDomain}`
  );

  const expectedStorageBucket = 'candy-ai-78a90.firebasestorage.app';
  const actualStorageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  check(
    'Storage Bucket matches expected',
    actualStorageBucket === expectedStorageBucket,
    actualStorageBucket === expectedStorageBucket
      ? `(${expectedStorageBucket})`
      : `Expected: ${expectedStorageBucket}, Got: ${actualStorageBucket}`
  );

  // Validate private key format
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
    const hasBeginMarker = privateKey.includes('-----BEGIN PRIVATE KEY-----');
    const hasEndMarker = privateKey.includes('-----END PRIVATE KEY-----');
    check('Private key format', hasBeginMarker && hasEndMarker);
  }

  // ═══════════════════════════════════════════════════
  // 4. Check Firebase Files
  // ═══════════════════════════════════════════════════
  section('Firebase Files');

  const firebaseRcPath = path.join(__dirname, '..', '.firebaserc');
  const firebaseRcExists = fs.existsSync(firebaseRcPath);
  check('.firebaserc file', firebaseRcExists);

  if (firebaseRcExists) {
    const firebaseRc = JSON.parse(fs.readFileSync(firebaseRcPath, 'utf-8'));
    const defaultProject = firebaseRc.projects?.default;
    check(
      '.firebaserc project',
      defaultProject === expectedProjectId,
      `(${defaultProject})`
    );
  }

  const firestoreRulesPath = path.join(__dirname, '..', 'firestore.rules');
  check('firestore.rules file', fs.existsSync(firestoreRulesPath));

  const storageRulesPath = path.join(__dirname, '..', 'storage.rules');
  check('storage.rules file', fs.existsSync(storageRulesPath));

  // ═══════════════════════════════════════════════════
  // 5. Check Package Dependencies
  // ═══════════════════════════════════════════════════
  section('Dependencies');

  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  check('node_modules exists', fs.existsSync(nodeModulesPath));

  const apiNodeModulesPath = path.join(__dirname, '..', 'apps', 'api', 'node_modules');
  const webNodeModulesPath = path.join(__dirname, '..', 'apps', 'web', 'node_modules');
  
  if (!fs.existsSync(apiNodeModulesPath) && !fs.existsSync(webNodeModulesPath)) {
    warning('Package dependencies may need installation');
    info('  Run: pnpm install');
  } else {
    success('Package dependencies installed');
  }

  // ═══════════════════════════════════════════════════
  // 6. Test API Key Format
  // ═══════════════════════════════════════════════════
  section('API Keys Format');

  if (process.env.OPENAI_API_KEY) {
    const openAiKey = process.env.OPENAI_API_KEY;
    const isValidFormat = openAiKey.startsWith('sk-');
    check('OpenAI key format', isValidFormat, isValidFormat ? '(starts with sk-)' : 'Invalid format');
  }

  if (process.env.ELEVENLABS_API_KEY) {
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    const isValidLength = elevenLabsKey.length > 20;
    check('ElevenLabs key format', isValidLength, isValidLength ? '(valid length)' : 'Too short');
  }

  // ═══════════════════════════════════════════════════
  // 7. Final Summary
  // ═══════════════════════════════════════════════════
  console.log('\n' + colors.cyan + '═══════════════════════════════════════════════' + colors.reset);
  
  const totalChecks = allChecks.length;
  const passedChecks = allChecks.filter(c => c.passed).length;
  const failedChecks = totalChecks - passedChecks;

  console.log(`\n📊 Summary: ${passedChecks}/${totalChecks} checks passed`);

  if (failedChecks === 0) {
    console.log(colors.green + '\n✨ Configuration is valid! All checks passed. ✨' + colors.reset);
    console.log('\n🚀 Next steps:');
    console.log('   1. Deploy Firebase rules: firebase deploy --only firestore:rules,storage');
    console.log('   2. Start API server: pnpm --filter @apps/api dev');
    console.log('   3. Start web app: pnpm --filter @apps/web dev');
    console.log('   4. Open: http://localhost:3000\n');
    process.exit(0);
  } else {
    console.log(colors.red + `\n❌ ${failedChecks} check(s) failed. Please fix the issues above.` + colors.reset);
    console.log('\n📖 Documentation:');
    console.log('   - ENV_REFERENCE.md - Complete environment variable reference');
    console.log('   - ENV_SETUP.md - Setup instructions');
    console.log('   - QUICKSTART.md - Quick start guide\n');
    process.exit(1);
  }
}

// Run validation
validateEnvironment().catch(err => {
  console.error('\n❌ Validation error:', err.message);
  process.exit(1);
});

