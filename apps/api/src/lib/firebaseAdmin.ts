/**
 * Firebase Admin SDK - Server-side initialization
 * Used in API routes and server-side operations
 */

import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env
// Try multiple paths to find the .env file
const possibleEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(__dirname, '../../../../.env'),
  'C:\\Users\\hssli\\Desktop\\PolstarAI\\Candy AI\\.env'
];

let envLoaded = false;
for (const envPath of possibleEnvPaths) {
  const result = dotenv.config({ path: envPath });
  if (!result.error && process.env.FIREBASE_PROJECT_ID) {
    console.log('✅ Loaded .env from:', envPath);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.warn('⚠️ Could not load .env file. Tried:', possibleEnvPaths);
  console.warn('📍 Current working directory:', process.cwd());
}

// Service account configuration
// Fix private key formatting - handle both escaped and literal newlines
let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
if (privateKey) {
  // Replace literal \n with actual newlines
  privateKey = privateKey.replace(/\\n/g, '\n');
  // Also handle if it's double-escaped
  privateKey = privateKey.replace(/\\\\n/g, '\n');
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
  
  console.log('✅ Firebase Admin Config validated:', {
    projectId: serviceAccount.projectId,
    clientEmail: serviceAccount.clientEmail.substring(0, 20) + '...',
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
  console.warn('⚠️ Server will start WITHOUT Firebase - some features may not work');
  console.warn('⚠️ To fix: Add Firebase credentials to .env file');
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

