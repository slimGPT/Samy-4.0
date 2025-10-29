/**
 * Firebase Client SDK - Browser-side initialization
 * Used in Next.js client components and pages
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  Firestore,
  doc, 
  getDoc, 
  setDoc, 
  collection,
  getDocs,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAuth, signInAnonymously, Auth } from 'firebase/auth';
import type { SessionState } from '@packages/shared';

// Firebase configuration from environment variables
function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
}

// Simple lazy initialization - Initialize only when getters are accessed
let _app: FirebaseApp | undefined;
let _db: Firestore | undefined;
let _storage: FirebaseStorage | undefined;
let _auth: Auth | undefined;
let _initialized = false;

function ensureFirebaseInit() {
  if (_initialized) return;
  _initialized = true;

  try {
    const firebaseConfig = getFirebaseConfig();
    
    // Validate required fields
    const required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'];
    const missing = required.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);
    
    if (missing.length > 0) {
      console.error('❌ Missing Firebase config:', missing);
      console.error('Check your .env.local file for these variables:', required.map(k => `NEXT_PUBLIC_FIREBASE_${k.toUpperCase()}`));
      return; // Don't throw, just return
    }
    
    // Check if Firebase is already initialized
    if (!getApps().length) {
      _app = initializeApp(firebaseConfig);
      console.log('🔥 Firebase Client SDK initialized');
    } else {
      _app = getApps()[0];
      console.log('🔥 Firebase Client SDK already initialized');
    }
    
    _db = getFirestore(_app);
    _storage = getStorage(_app);
    _auth = getAuth(_app);
    
    console.log('✅ Firebase Connected:', firebaseConfig.projectId);
  } catch (error: any) {
    console.error('❌ Firebase initialization error:', error.message);
    // Don't throw, just log
  }
}

// Getters that initialize on first access
export function getApp(): FirebaseApp {
  ensureFirebaseInit();
  if (!_app) throw new Error('Firebase app not initialized');
  return _app;
}

export function getDb(): Firestore {
  ensureFirebaseInit();
  if (!_db) throw new Error('Firestore not initialized');
  return _db;
}

export function getFirebaseStorage(): FirebaseStorage {
  ensureFirebaseInit();
  if (!_storage) throw new Error('Firebase Storage not initialized');
  return _storage;
}

export function getFirebaseAuth(): Auth {
  ensureFirebaseInit();
  if (!_auth) throw new Error('Firebase Auth not initialized');
  return _auth;
}

// Legacy exports for backward compatibility
export const app = {} as any;  // Dummy export
export const db = {} as any;   // Dummy export
export const storage = {} as any;  // Dummy export
export const auth = {} as any;  // Dummy export

/**
 * Ensure anonymous authentication
 * Creates an anonymous user session if one doesn't exist
 */
export async function ensureAnonAuth(): Promise<void> {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth.currentUser) {
    try {
      await signInAnonymously(firebaseAuth);
      console.log('✅ Anonymous auth successful');
    } catch (error: any) {
      console.error('❌ Anonymous auth failed:', error);
      throw error;
    }
  }
}

// ═══════════════════════════════════════════════════════════
// USERS COLLECTION
// ═══════════════════════════════════════════════════════════

export interface User {
  createdAt: Timestamp;
  energyLevel: number;
  lastInteraction: Timestamp;
  currentEmotion: string;
  settings: {
    username: string;
  };
}

/**
 * Get or create a user document
 */
export async function ensureUser(userId: string): Promise<User> {
  const userRef = doc(getDb(), 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    console.log('✅ User loaded:', userId);
    return userSnap.data() as User;
  }
  
  // Create new user
  const newUser: User = {
    createdAt: serverTimestamp() as Timestamp,
    energyLevel: 0.5,
    lastInteraction: serverTimestamp() as Timestamp,
    currentEmotion: 'neutral',
    settings: {
      username: 'User'
    }
  };
  
  await setDoc(userRef, newUser);
  console.log('📝 New user created:', userId);
  return newUser;
}

/**
 * Update user emotion and energy
 */
export async function updateUserState(
  userId: string, 
  emotion: string, 
  energyLevel: number
): Promise<void> {
  const userRef = doc(getDb(), 'users', userId);
  await updateDoc(userRef, {
    currentEmotion: emotion,
    energyLevel: energyLevel,
    lastInteraction: serverTimestamp()
  });
  console.log(`💖 User state updated: ${emotion} (energy: ${energyLevel})`);
}

// ═══════════════════════════════════════════════════════════
// EMOTIONS COLLECTION
// ═══════════════════════════════════════════════════════════

export interface EmotionData {
  emoji: string;
  description: string;
  responseStyle: string;
  triggers: string[];
  decayRate: number;
  energyModifier: number;
  transitionRules: Record<string, string>;
}

/**
 * Fetch all emotions from Firestore
 */
export async function fetchEmotions(): Promise<Record<string, EmotionData>> {
  try {
    const emotionsRef = collection(getDb(), 'emotions');
    const snapshot = await getDocs(emotionsRef);
    
    const emotions: Record<string, EmotionData> = {};
    snapshot.forEach(doc => {
      emotions[doc.id] = doc.data() as EmotionData;
    });
    
    console.log('🎭 Emotions loaded from Firestore:', Object.keys(emotions));
    return emotions;
  } catch (error) {
    console.error('❌ Error fetching emotions:', error);
    throw error;
  }
}

/**
 * Get a specific emotion
 */
export async function getEmotion(emotionName: string): Promise<EmotionData | null> {
  try {
    const emotionRef = doc(getDb(), 'emotions', emotionName);
    const emotionSnap = await getDoc(emotionRef);
    
    if (emotionSnap.exists()) {
      return emotionSnap.data() as EmotionData;
    }
    
    console.warn(`⚠️ Emotion not found: ${emotionName}`);
    return null;
  } catch (error) {
    console.error(`❌ Error fetching emotion ${emotionName}:`, error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// SESSIONS COLLECTION (Enhanced)
// ═══════════════════════════════════════════════════════════

export interface Session {
  userId: string;
  timestamp: Timestamp;
  context: string[];
  dominantEmotion: string;
  emotionScore: Record<string, number>;
  duration: number;
  state?: SessionState;
  metrics?: {
    turns: number;
    whQuestions: number;
    sessionMinutes: number;
    ci: number;
  };
}

/**
 * Create or get session
 */
export async function ensureSession(sessionId: string, userId: string): Promise<void> {
  const sessionRef = doc(getDb(), 'sessions', sessionId);
  const sessionSnap = await getDoc(sessionRef);
  
  if (!sessionSnap.exists()) {
    const initialSession: Session = {
      userId: userId,
      timestamp: serverTimestamp() as Timestamp,
      context: [],
      dominantEmotion: 'neutral',
      emotionScore: {
        flirty: 0,
        bitchy: 0,
        calm: 0,
        caring: 0,
        jealous: 0,
        neutral: 1
      },
      duration: 0,
      state: {
        phase: 'idle',
        emotion: 'calm',
        energy: 0.3,
        lastAudioUrl: null,
        lang: 'en',
        updatedAt: Date.now(),
      },
      metrics: {
        turns: 0,
        whQuestions: 0,
        sessionMinutes: 0,
        ci: 0,
      }
    };
    
    await setDoc(sessionRef, initialSession);
    console.log('📝 New session created:', sessionId);
  } else {
    console.log('✅ Session loaded:', sessionId);
  }
}

/**
 * Update session emotion scores
 */
export async function updateSessionEmotion(
  sessionId: string,
  emotion: string,
  score: number
): Promise<void> {
  const sessionRef = doc(getDb(), 'sessions', sessionId);
  await updateDoc(sessionRef, {
    dominantEmotion: emotion,
    [`emotionScore.${emotion}`]: score,
    lastUpdated: serverTimestamp()
  });
  console.log(`💖 Session emotion updated: ${emotion} (score: ${score})`);
}

/**
 * Add context to session
 */
export async function addSessionContext(
  sessionId: string,
  contextItem: string
): Promise<void> {
  const sessionRef = doc(getDb(), 'sessions', sessionId);
  const sessionSnap = await getDoc(sessionRef);
  
  if (sessionSnap.exists()) {
    const currentContext = sessionSnap.data().context || [];
    await updateDoc(sessionRef, {
      context: [...currentContext, contextItem].slice(-10) // Keep last 10 items
    });
  }
}

/**
 * Subscribe to session state updates (Real-time)
 */
export function subscribeToSession(
  sessionId: string,
  onUpdate: (session: Session | null) => void,
  onError?: (error: Error) => void
): () => void {
  const sessionRef = doc(getDb(), 'sessions', sessionId);
  
  console.log('👂 Subscribing to session updates:', sessionId);
  
  return onSnapshot(
    sessionRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Session;
        console.log('🔄 Session updated:', {
          emotion: data.dominantEmotion,
          phase: data.state?.phase
        });
        onUpdate(data);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.error('❌ Firestore subscription error:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Update session state phase
 */
export async function patchSessionPhase(
  sessionId: string,
  phase: SessionState['phase'],
  additionalFields?: Partial<SessionState>
): Promise<void> {
  const sessionRef = doc(getDb(), 'sessions', sessionId);
  await setDoc(
    sessionRef,
    {
      state: {
        phase,
        updatedAt: Date.now(),
        ...additionalFields,
      },
    },
    { merge: true }
  );
  console.log(`🔄 Phase updated: ${phase}`);
}

// ═══════════════════════════════════════════════════════════
// LEGACY COMPATIBILITY (for existing code)
// ═══════════════════════════════════════════════════════════

export async function ensureState(sessionId: string): Promise<void> {
  await ensureSession(sessionId, 'default-user');
}

export function subscribeState(
  sessionId: string,
  onUpdate: (state: SessionState | null) => void,
  onError?: (error: Error) => void
): () => void {
  return subscribeToSession(
    sessionId,
    (session) => {
      if (session && session.state) {
        onUpdate(session.state);
      } else {
        onUpdate(null);
      }
    },
    onError
  );
}

export async function patchPhase(
  sessionId: string,
  phase: SessionState['phase'],
  additionalFields?: Partial<SessionState>
): Promise<void> {
  await patchSessionPhase(sessionId, phase, additionalFields);
}

