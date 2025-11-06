/**
 * Firebase Admin SDK - Server-side initialization
 * Used in API routes and server-side operations
 */

import 'dotenv/config';
import admin from 'firebase-admin';
import path from 'path';

// Load environment variables from root .env (monorepo root)
// The 'dotenv/config' import above automatically loads .env from the root
// But we also try explicit paths to ensure it works
// Use process.cwd() for better compatibility with tsx watch
const rootEnvPath = path.resolve(process.cwd(), '.env');
const dotenvResult = require('dotenv').config({ path: rootEnvPath });

if (dotenvResult.error || !process.env.FIREBASE_PROJECT_ID) {
  // Fallback: try relative paths
  require('dotenv').config({ path: path.resolve(process.cwd(), '../../.env') });
  require('dotenv').config({ path: path.resolve(process.cwd(), 'apps/api/.env') });
}

if (process.env.FIREBASE_PROJECT_ID) {
  console.log('✅ Loaded Firebase config from root .env');
}

// Service account configuration
// Fix private key formatting - handle escaped newlines (\\n in .env becomes \n)
let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
if (privateKey) {
  // Replace escaped newlines (\\n) with actual newlines
  privateKey = privateKey.replace(/\\n/g, '\n');
  // Remove any quotes that might have been included
  privateKey = privateKey.replace(/^["']|["']$/g, '');
}

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: privateKey,
};

// Validate configuration
function validateAdminConfig() {
  if (!serviceAccount.projectId) {
    throw new Error('❌ FIREBASE_PROJECT_ID is missing');
  }
  if (!serviceAccount.clientEmail) {
    throw new Error('❌ FIREBASE_CLIENT_EMAIL is missing');
  }
  if (!serviceAccount.privateKey) {
    throw new Error('❌ FIREBASE_PRIVATE_KEY is missing');
  }
  
  // Validate private key format (should be much longer than 100 chars)
  if (serviceAccount.privateKey.length < 100) {
    throw new Error('❌ FIREBASE_PRIVATE_KEY appears invalid (too short)');
  }
  
  // Check for valid PEM format
  if (!serviceAccount.privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    throw new Error('❌ FIREBASE_PRIVATE_KEY missing BEGIN marker');
  }
  
  if (!serviceAccount.privateKey.includes('-----END PRIVATE KEY-----')) {
    throw new Error('❌ FIREBASE_PRIVATE_KEY missing END marker');
  }
  
  console.log('✅ Firebase Admin Config validated:', {
    projectId: serviceAccount.projectId,
    clientEmail: serviceAccount.clientEmail.substring(0, 20) + '...',
    keyLength: serviceAccount.privateKey.length,
  });
}

// Initialize Firebase Admin
let firebaseInitialized = false;
try {
  validateAdminConfig();
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
    console.log('🔥 Firebase Admin SDK initialized');
  } else {
    console.log('🔥 Firebase Admin SDK already initialized');
  }
  
  console.log('✅ Firebase Admin Connected:', serviceAccount.projectId);
  firebaseInitialized = true;
} catch (error: any) {
  console.error('❌ Firebase Admin initialization error:', error.message);
  console.warn('\n⚠️ Server will start WITHOUT Firebase - some features may not work');
  console.warn('⚠️ To fix Firebase:');
  console.warn('   1. Go to Firebase Console: https://console.firebase.google.com/');
  console.warn(`   2. Select project: ${serviceAccount.projectId || 'your-project'}`);
  console.warn('   3. Go to: Project Settings → Service Accounts');
  console.warn('   4. Click "Generate New Private Key"');
  console.warn('   5. Copy the ENTIRE private key to .env as FIREBASE_PRIVATE_KEY');
  console.warn('   6. Make sure to escape newlines as \\n\n');
  console.warn('🎯 For now: Core AI pipeline works without Firebase!\n');
  // Don't throw - allow server to start anyway
}

// Export Firestore and Storage instances (only if Firebase initialized)
export const db = firebaseInitialized ? admin.firestore() : null as any;
export const storage = firebaseInitialized ? admin.storage() : null as any;
export default admin;
export { firebaseInitialized };

// ═══════════════════════════════════════════════════════════
// FIRESTORE HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Get user document
 */
export async function getUser(userId: string) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      console.log('✅ User fetched:', userId);
      return userDoc.data();
    }
    return null;
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    throw error;
  }
}

/**
 * Update user state
 */
export async function updateUser(
  userId: string,
  updates: Record<string, any>
) {
  try {
    await db.collection('users').doc(userId).update({
      ...updates,
      lastInteraction: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('💖 User updated:', userId);
  } catch (error) {
    console.error('❌ Error updating user:', error);
    throw error;
  }
}

/**
 * Get all emotions from Firestore
 */
export async function getAllEmotions() {
  try {
    const emotionsSnapshot = await db.collection('emotions').get();
    const emotions: Record<string, any> = {};
    
    emotionsSnapshot.forEach(doc => {
      emotions[doc.id] = doc.data();
    });
    
    console.log('🎭 Emotions fetched:', Object.keys(emotions));
    return emotions;
  } catch (error) {
    console.error('❌ Error fetching emotions:', error);
    throw error;
  }
}

/**
 * Get specific emotion
 */
export async function getEmotion(emotionName: string) {
  try {
    const emotionDoc = await db.collection('emotions').doc(emotionName).get();
    if (emotionDoc.exists) {
      return emotionDoc.data();
    }
    console.warn(`⚠️ Emotion not found: ${emotionName}`);
    return null;
  } catch (error) {
    console.error('❌ Error fetching emotion:', error);
    throw error;
  }
}

/**
 * Get session
 */
export async function getSession(sessionId: string) {
  try {
    const sessionDoc = await db.collection('sessions').doc(sessionId).get();
    if (sessionDoc.exists) {
      console.log('✅ Session fetched:', sessionId);
      return sessionDoc.data();
    }
    return null;
  } catch (error) {
    console.error('❌ Error fetching session:', error);
    throw error;
  }
}

/**
 * Update session
 */
export async function updateSession(
  sessionId: string,
  updates: Record<string, any>
) {
  try {
    await db.collection('sessions').doc(sessionId).set(updates, { merge: true });
    console.log('💖 Session updated:', sessionId);
  } catch (error) {
    console.error('❌ Error updating session:', error);
    throw error;
  }
}

/**
 * Create session log entry
 */
export async function logSession(
  sessionId: string,
  userId: string,
  emotion: string,
  duration: number
) {
  try {
    await db.collection('sessions').doc(sessionId).set({
      userId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      dominantEmotion: emotion,
      duration,
      context: [],
      emotionScore: {
        [emotion]: 1.0
      }
    }, { merge: true });
    
    console.log('📝 Session logged:', { sessionId, emotion, duration });
  } catch (error) {
    console.error('❌ Error logging session:', error);
    throw error;
  }
}

