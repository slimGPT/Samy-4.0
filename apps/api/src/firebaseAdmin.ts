/**
 * Firebase Admin SDK - Legacy export
 * This file re-exports from the new location for backward compatibility
 * 
 * New code should import from: './lib/firebaseAdmin'
 */

export {
  db,
  storage,
  default as admin,
  getUser,
  updateUser,
  getAllEmotions,
  getEmotion,
  getSession,
  updateSession,
  logSession
} from './lib/firebaseAdmin';

console.log('⚠️ Importing from legacy firebaseAdmin.ts - consider updating to ./lib/firebaseAdmin');

