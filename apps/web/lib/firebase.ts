/**
 * Firebase Client SDK - Legacy export
 * This file re-exports from the new location for backward compatibility
 * 
 * New code should import from: './firebaseClient'
 */

export {
  app,
  db,
  storage,
  auth,
  // Auth
  ensureAnonAuth,
  // Collections
  ensureUser,
  updateUserState,
  fetchEmotions,
  getEmotion,
  ensureSession,
  updateSessionEmotion,
  addSessionContext,
  subscribeToSession,
  patchSessionPhase,
  // Legacy compatibility
  ensureState,
  subscribeState,
  patchPhase,
  // Types
  type User,
  type EmotionData,
  type Session
} from './firebaseClient';

console.log('⚠️ Importing from legacy firebase.ts - consider updating to ./firebaseClient');

