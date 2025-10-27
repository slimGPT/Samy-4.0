import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import type { SessionState } from '@packages/shared';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);

/**
 * Ensure anonymous authentication (placeholder - not needed for demo)
 */
export async function ensureAnonAuth(): Promise<void> {
  // No auth needed for demo - just return
  console.log('✅ Using demo session (no auth required)');
}

/**
 * Ensure session state exists in Firestore
 */
export async function ensureState(sessionId: string): Promise<void> {
  try {
    const sessionRef = doc(db, 'sessions', sessionId);
    const snapshot = await getDoc(sessionRef);
    
    if (!snapshot.exists()) {
      console.log(`📝 Creating initial state for session: ${sessionId}`);
      const initialState: SessionState = {
        phase: 'idle',
        emotion: 'calm',
        energy: 0.3,
        lastAudioUrl: null,
        lang: 'en',
        updatedAt: Date.now(),
      };
      
      await setDoc(sessionRef, {
        state: initialState,
        metrics: {
          turns: 0,
          whQuestions: 0,
          sessionMinutes: 0,
          ci: 0,
        },
      });
    }
  } catch (error) {
    console.error('Error ensuring state:', error);
    // Don't throw - allow app to continue
  }
}

/**
 * Subscribe to session state updates
 */
export function subscribeState(
  sessionId: string,
  onUpdate: (state: SessionState | null) => void,
  onError?: (error: Error) => void
): () => void {
  const sessionRef = doc(db, 'sessions', sessionId);
  
  return onSnapshot(
    sessionRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onUpdate(data.state || null);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.error('Firestore subscription error:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Update session state phase
 */
export async function patchPhase(
  sessionId: string,
  phase: SessionState['phase'],
  additionalFields?: Partial<SessionState>
): Promise<void> {
  const sessionRef = doc(db, 'sessions', sessionId);
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
}

