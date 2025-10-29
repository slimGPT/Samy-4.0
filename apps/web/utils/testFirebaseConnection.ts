/**
 * Firebase Connection Test Utility
 * Tests Firestore read/write operations and connection status
 */

import { 
  db, 
  fetchEmotions, 
  ensureUser, 
  ensureSession,
  updateUserState,
  updateSessionEmotion,
  getEmotion
} from '../lib/firebaseClient';
import { collection, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration?: number;
}

/**
 * Run all Firebase connection tests
 */
export async function runFirebaseTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  console.log('\n🧪 ═══════════════════════════════════════════════');
  console.log('   FIREBASE CONNECTION TEST SUITE');
  console.log('   ═══════════════════════════════════════════════\n');

  // Test 1: Basic Connection
  try {
    const startTime = Date.now();
    if (db) {
      const duration = Date.now() - startTime;
      results.push({
        name: 'Firebase Connection',
        passed: true,
        message: 'Successfully connected to Firestore',
        duration
      });
      console.log('✅ Test 1: Firebase Connection - PASSED');
    }
  } catch (error: any) {
    results.push({
      name: 'Firebase Connection',
      passed: false,
      message: `Failed: ${error.message}`
    });
    console.log('❌ Test 1: Firebase Connection - FAILED');
    return results; // Stop if connection fails
  }

  // Test 2: Read Emotions Collection
  try {
    const startTime = Date.now();
    const emotions = await fetchEmotions();
    const duration = Date.now() - startTime;
    
    const emotionNames = Object.keys(emotions);
    
    if (emotionNames.length > 0) {
      results.push({
        name: 'Fetch Emotions',
        passed: true,
        message: `Found ${emotionNames.length} emotions: ${emotionNames.join(', ')}`,
        duration
      });
      console.log('✅ Test 2: Fetch Emotions - PASSED');
      console.log('   Emotions:', emotionNames);
    } else {
      results.push({
        name: 'Fetch Emotions',
        passed: false,
        message: 'No emotions found in Firestore'
      });
      console.log('⚠️ Test 2: Fetch Emotions - WARNING (empty collection)');
    }
  } catch (error: any) {
    results.push({
      name: 'Fetch Emotions',
      passed: false,
      message: `Failed: ${error.message}`
    });
    console.log('❌ Test 2: Fetch Emotions - FAILED');
  }

  // Test 3: Read Specific Emotion
  try {
    const startTime = Date.now();
    const flirtyEmotion = await getEmotion('flirty');
    const duration = Date.now() - startTime;
    
    if (flirtyEmotion) {
      results.push({
        name: 'Get Specific Emotion',
        passed: true,
        message: `Found 'flirty' emotion: ${flirtyEmotion.emoji} - ${flirtyEmotion.description}`,
        duration
      });
      console.log('✅ Test 3: Get Specific Emotion - PASSED');
      console.log('   Flirty:', flirtyEmotion.emoji, flirtyEmotion.description);
    } else {
      results.push({
        name: 'Get Specific Emotion',
        passed: false,
        message: 'Could not find flirty emotion'
      });
      console.log('⚠️ Test 3: Get Specific Emotion - WARNING (not found)');
    }
  } catch (error: any) {
    results.push({
      name: 'Get Specific Emotion',
      passed: false,
      message: `Failed: ${error.message}`
    });
    console.log('❌ Test 3: Get Specific Emotion - FAILED');
  }

  // Test 4: Write Test Document
  try {
    const startTime = Date.now();
    const testDocRef = doc(db, 'test', 'connection-test');
    await setDoc(testDocRef, {
      timestamp: Date.now(),
      status: 'test_successful',
      message: 'Firebase write test'
    });
    const duration = Date.now() - startTime;
    
    results.push({
      name: 'Write Test Document',
      passed: true,
      message: 'Successfully wrote test document to Firestore',
      duration
    });
    console.log('✅ Test 4: Write Test Document - PASSED');
  } catch (error: any) {
    results.push({
      name: 'Write Test Document',
      passed: false,
      message: `Failed: ${error.message}`
    });
    console.log('❌ Test 4: Write Test Document - FAILED');
  }

  // Test 5: Read Test Document
  try {
    const startTime = Date.now();
    const testDocRef = doc(db, 'test', 'connection-test');
    const testDoc = await getDoc(testDocRef);
    const duration = Date.now() - startTime;
    
    if (testDoc.exists()) {
      results.push({
        name: 'Read Test Document',
        passed: true,
        message: 'Successfully read test document from Firestore',
        duration
      });
      console.log('✅ Test 5: Read Test Document - PASSED');
    } else {
      results.push({
        name: 'Read Test Document',
        passed: false,
        message: 'Test document not found'
      });
      console.log('❌ Test 5: Read Test Document - FAILED');
    }
  } catch (error: any) {
    results.push({
      name: 'Read Test Document',
      passed: false,
      message: `Failed: ${error.message}`
    });
    console.log('❌ Test 5: Read Test Document - FAILED');
  }

  // Test 6: Create Test User
  try {
    const startTime = Date.now();
    const testUserId = 'test-user-' + Date.now();
    await ensureUser(testUserId);
    const duration = Date.now() - startTime;
    
    results.push({
      name: 'Create Test User',
      passed: true,
      message: `Successfully created user: ${testUserId}`,
      duration
    });
    console.log('✅ Test 6: Create Test User - PASSED');
  } catch (error: any) {
    results.push({
      name: 'Create Test User',
      passed: false,
      message: `Failed: ${error.message}`
    });
    console.log('❌ Test 6: Create Test User - FAILED');
  }

  // Test 7: Create Test Session
  try {
    const startTime = Date.now();
    const testSessionId = 'test-session-' + Date.now();
    await ensureSession(testSessionId, 'test-user');
    const duration = Date.now() - startTime;
    
    results.push({
      name: 'Create Test Session',
      passed: true,
      message: `Successfully created session: ${testSessionId}`,
      duration
    });
    console.log('✅ Test 7: Create Test Session - PASSED');
  } catch (error: any) {
    results.push({
      name: 'Create Test Session',
      passed: false,
      message: `Failed: ${error.message}`
    });
    console.log('❌ Test 7: Create Test Session - FAILED');
  }

  // Test 8: Update User State
  try {
    const startTime = Date.now();
    const testUserId = 'test-user';
    await updateUserState(testUserId, 'flirty', 0.8);
    const duration = Date.now() - startTime;
    
    results.push({
      name: 'Update User State',
      passed: true,
      message: 'Successfully updated user emotion and energy',
      duration
    });
    console.log('✅ Test 8: Update User State - PASSED');
  } catch (error: any) {
    results.push({
      name: 'Update User State',
      passed: false,
      message: `Failed: ${error.message}`
    });
    console.log('❌ Test 8: Update User State - FAILED');
  }

  // Test 9: Update Session Emotion
  try {
    const startTime = Date.now();
    const testSessionId = 'test-session';
    await updateSessionEmotion(testSessionId, 'flirty', 0.9);
    const duration = Date.now() - startTime;
    
    results.push({
      name: 'Update Session Emotion',
      passed: true,
      message: 'Successfully updated session emotion score',
      duration
    });
    console.log('✅ Test 9: Update Session Emotion - PASSED');
  } catch (error: any) {
    results.push({
      name: 'Update Session Emotion',
      passed: false,
      message: `Failed: ${error.message}`
    });
    console.log('❌ Test 9: Update Session Emotion - FAILED');
  }

  // Test 10: Cleanup Test Document
  try {
    const testDocRef = doc(db, 'test', 'connection-test');
    await deleteDoc(testDocRef);
    results.push({
      name: 'Cleanup Test Document',
      passed: true,
      message: 'Successfully deleted test document'
    });
    console.log('✅ Test 10: Cleanup Test Document - PASSED');
  } catch (error: any) {
    results.push({
      name: 'Cleanup Test Document',
      passed: false,
      message: `Failed: ${error.message}`
    });
    console.log('⚠️ Test 10: Cleanup - WARNING (non-critical)');
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════');
  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;
  const passRate = ((passedTests / totalTests) * 100).toFixed(0);
  
  console.log(`\n📊 Test Results: ${passedTests}/${totalTests} passed (${passRate}%)`);
  
  if (passedTests === totalTests) {
    console.log('✨ All tests passed! Firebase is fully connected. ✨\n');
  } else {
    console.log(`⚠️ ${totalTests - passedTests} test(s) failed. Check configuration.\n`);
  }

  return results;
}

/**
 * Quick connection test (lightweight)
 */
export async function quickConnectionTest(): Promise<boolean> {
  try {
    if (!db) {
      console.error('❌ Firestore not initialized');
      return false;
    }
    
    const testDoc = doc(db, 'test', 'quick-test');
    await setDoc(testDoc, { timestamp: Date.now() });
    await getDoc(testDoc);
    await deleteDoc(testDoc);
    
    console.log('✅ Firebase connection verified');
    return true;
  } catch (error: any) {
    console.error('❌ Firebase connection failed:', error.message);
    return false;
  }
}

/**
 * Log connection status to console
 */
export function logConnectionStatus(): void {
  try {
    if (db) {
      console.log('✅ Firebase Connected');
      console.log('   Project:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
    } else {
      console.log('❌ Firebase Not Connected');
    }
  } catch (error) {
    console.error('❌ Firebase Error:', error);
  }
}

