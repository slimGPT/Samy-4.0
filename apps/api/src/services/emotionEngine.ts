/**
 * Dynamic Emotion Engine for SamyBear 4.0
 * Manages emotion transitions based on conversation flow, time, and context
 */

import { db } from '../firebaseAdmin';

export type Emotion = 'flirty' | 'sweet' | 'sassy' | 'lazy';

export interface EmotionState {
  current: Emotion;
  intensity: number; // 0-1, how strongly she feels this emotion
  lastTransition: number; // timestamp
  sessionStart: number; // timestamp
  conversationTone: 'playful' | 'romantic' | 'deep' | 'comforting' | 'flirty' | 'neutral';
}

export interface EmotionTrigger {
  keywords: string[];
  targetEmotion: Emotion;
  intensity: number;
  tone?: EmotionState['conversationTone'];
}

// Emotion transition rules
const EMOTION_TRIGGERS: EmotionTrigger[] = [
  // Flirty triggers (sexy, teasing, playful)
  {
    keywords: ['kiss', 'cute', 'beautiful', 'gorgeous', 'sexy', 'hot', 'damn', 'mmm'],
    targetEmotion: 'flirty',
    intensity: 0.9,
    tone: 'flirty',
  },
  {
    keywords: ['love', 'babe', 'baby', 'honey', 'darling', 'miss you'],
    targetEmotion: 'flirty',
    intensity: 0.8,
    tone: 'romantic',
  },
  
  // Sweet triggers (caring, loving, supportive)
  {
    keywords: ['sad', 'worried', 'stressed', 'hard', 'difficult', 'upset', 'problem', 'help'],
    targetEmotion: 'sweet',
    intensity: 0.8,
    tone: 'comforting',
  },
  {
    keywords: ['thanks', 'thank you', 'appreciate', 'sweet', 'kind', 'care'],
    targetEmotion: 'sweet',
    intensity: 0.7,
    tone: 'romantic',
  },
  {
    keywords: ['miss', 'thinking about', 'remember', 'wish'],
    targetEmotion: 'sweet',
    intensity: 0.6,
    tone: 'romantic',
  },
  
  // Sassy triggers (bitchy, playful attitude, teasing)
  {
    keywords: ['really', 'seriously', 'whatever', 'sure', 'okay', 'fine', 'excuse me'],
    targetEmotion: 'sassy',
    intensity: 0.8,
    tone: 'playful',
  },
  {
    keywords: ['what', 'why', 'how', 'huh', 'wait', 'hold on'],
    targetEmotion: 'sassy',
    intensity: 0.7,
    tone: 'playful',
  },
  {
    keywords: ['shut up', 'stop', 'omg', 'bitch', 'ass'],
    targetEmotion: 'sassy',
    intensity: 0.9,
    tone: 'playful',
  },
  
  // Lazy triggers (tired, don't wanna do anything, chill)
  {
    keywords: ['tired', 'sleepy', 'bed', 'sleep', 'night', 'goodnight', 'exhausted', 'lazy'],
    targetEmotion: 'lazy',
    intensity: 0.9,
    tone: 'comforting',
  },
  {
    keywords: ['cuddle', 'cozy', 'warm', 'close', 'hold', 'chill', 'relax', 'nap'],
    targetEmotion: 'lazy',
    intensity: 0.8,
    tone: 'romantic',
  },
  {
    keywords: ['later', 'tomorrow', 'maybe', 'meh', 'don\'t wanna'],
    targetEmotion: 'lazy',
    intensity: 0.7,
    tone: 'playful',
  },
];

// Mood arcs - natural emotion progressions
const MOOD_ARCS = {
  // Natural conversation flow
  standard: ['flirty', 'sassy', 'sweet', 'flirty'] as Emotion[],
  
  // Evening/intimate progression
  evening: ['flirty', 'sweet', 'lazy'] as Emotion[],
  
  // Playful/teasing
  playful: ['sassy', 'flirty', 'sassy'] as Emotion[],
  
  // Chill vibes
  chill: ['lazy', 'sweet', 'flirty'] as Emotion[],
  
  // Comfort/support
  comforting: ['sweet', 'flirty', 'sweet'] as Emotion[],
};

// Emotion intensity decay over time (becomes more neutral)
const INTENSITY_DECAY_RATE = 0.0001; // per millisecond
const MIN_INTENSITY = 0.3;

// Time-based emotion transitions
const TIME_BASED_TRANSITIONS = [
  { afterMinutes: 15, targetEmotion: 'sweet' as Emotion, reason: 'long conversation' },
  { afterMinutes: 30, targetEmotion: 'lazy' as Emotion, reason: 'extended session' },
];

/**
 * Analyze user message and detect emotion triggers
 */
export function analyzeEmotionTriggers(message: string): EmotionTrigger | null {
  const lowerMessage = message.toLowerCase();
  
  // Find matching triggers (prioritize by keyword count)
  let bestMatch: EmotionTrigger | null = null;
  let maxMatches = 0;
  
  for (const trigger of EMOTION_TRIGGERS) {
    const matchCount = trigger.keywords.filter(keyword => 
      lowerMessage.includes(keyword)
    ).length;
    
    if (matchCount > maxMatches) {
      maxMatches = matchCount;
      bestMatch = trigger;
    }
  }
  
  return maxMatches > 0 ? bestMatch : null;
}

/**
 * Calculate emotion transition based on current state and triggers
 */
export function calculateEmotionTransition(
  currentState: EmotionState,
  userMessage: string,
  aiResponse: string
): Partial<EmotionState> {
  const now = Date.now();
  const sessionDuration = (now - currentState.sessionStart) / 1000 / 60; // minutes
  const timeSinceLastTransition = (now - currentState.lastTransition) / 1000; // seconds
  
  // Analyze triggers from user message
  const trigger = analyzeEmotionTriggers(userMessage);
  
  // Check if we should transition based on message triggers
  if (trigger && timeSinceLastTransition > 10) { // Don't transition too frequently
    console.log(`🎭 Emotion trigger detected: ${trigger.targetEmotion} (${trigger.tone})`);
    return {
      current: trigger.targetEmotion,
      intensity: trigger.intensity,
      conversationTone: trigger.tone || currentState.conversationTone,
      lastTransition: now,
    };
  }
  
  // Check time-based transitions
  for (const timeTransition of TIME_BASED_TRANSITIONS) {
    if (sessionDuration >= timeTransition.afterMinutes && 
        currentState.current !== timeTransition.targetEmotion &&
        timeSinceLastTransition > 120) { // 2 minutes minimum between time transitions
      console.log(`⏰ Time-based transition: ${timeTransition.targetEmotion} (${timeTransition.reason})`);
      return {
        current: timeTransition.targetEmotion,
        intensity: 0.6,
        lastTransition: now,
      };
    }
  }
  
  // Apply intensity decay
  const decay = INTENSITY_DECAY_RATE * (now - currentState.lastTransition);
  const newIntensity = Math.max(MIN_INTENSITY, currentState.intensity - decay);
  
  if (newIntensity !== currentState.intensity) {
    return {
      intensity: newIntensity,
    };
  }
  
  return {};
}

/**
 * Get mood arc suggestion based on conversation tone
 */
export function getMoodArc(tone: EmotionState['conversationTone']): Emotion[] {
  switch (tone) {
    case 'romantic':
    case 'flirty':
      return MOOD_ARCS.evening;
    case 'deep':
      return MOOD_ARCS.deep;
    case 'playful':
      return MOOD_ARCS.playful;
    case 'comforting':
      return MOOD_ARCS.comforting;
    default:
      return MOOD_ARCS.standard;
  }
}

/**
 * Get next emotion in mood arc
 */
export function getNextEmotionInArc(
  currentState: EmotionState,
  timeSinceLastTransition: number
): Emotion | null {
  // Only suggest arc progression after some time
  if (timeSinceLastTransition < 180) return null; // 3 minutes
  
  const arc = getMoodArc(currentState.conversationTone);
  const currentIndex = arc.indexOf(currentState.current);
  
  if (currentIndex === -1 || currentIndex === arc.length - 1) {
    return null; // Not in arc or at end
  }
  
  return arc[currentIndex + 1];
}

/**
 * Initialize emotion state for a new session
 */
export function initializeEmotionState(): EmotionState {
  const now = Date.now();
  return {
    current: 'flirty', // Always start flirty and excited
    intensity: 0.8,
    lastTransition: now,
    sessionStart: now,
    conversationTone: 'flirty',
  };
}

/**
 * Update emotion state in Firestore
 */
export async function updateEmotionState(
  sessionId: string,
  emotionUpdate: Partial<EmotionState>,
  energyLevel?: number
): Promise<void> {
  try {
    const sessionRef = db.collection('sessions').doc(sessionId);
    const snapshot = await sessionRef.get();
    
    let currentEmotionState: EmotionState;
    
    if (snapshot.exists()) {
      const data = snapshot.data();
      currentEmotionState = data?.emotionState || initializeEmotionState();
    } else {
      currentEmotionState = initializeEmotionState();
    }
    
    // Merge updates
    const newEmotionState = {
      ...currentEmotionState,
      ...emotionUpdate,
    };
    
    // Update Firestore
    await sessionRef.set(
      {
        state: {
          emotion: newEmotionState.current,
          energy: energyLevel !== undefined ? energyLevel : currentEmotionState.intensity,
          updatedAt: Date.now(),
        },
        emotionState: newEmotionState,
      },
      { merge: true }
    );
    
    console.log(`💖 SamyBear's emotion: ${newEmotionState.current} (intensity: ${newEmotionState.intensity.toFixed(2)}, tone: ${newEmotionState.conversationTone})`);
  } catch (error) {
    console.error('❌ Error updating emotion state:', error);
  }
}

/**
 * Get current emotion state from Firestore
 */
export async function getEmotionState(sessionId: string): Promise<EmotionState> {
  try {
    const sessionRef = db.collection('sessions').doc(sessionId);
    const snapshot = await sessionRef.get();
    
    if (snapshot.exists) {
      const data = snapshot.data();
      return data?.emotionState || initializeEmotionState();
    }
    
    return initializeEmotionState();
  } catch (error) {
    console.error('❌ Error getting emotion state:', error);
    return initializeEmotionState();
  }
}

/**
 * Process conversation and update emotion dynamically
 */
export async function processEmotionTransition(
  sessionId: string,
  userMessage: string,
  aiResponse: string
): Promise<Emotion> {
  try {
    // Get current state
    const currentState = await getEmotionState(sessionId);
    
    // Calculate transition
    const emotionUpdate = calculateEmotionTransition(currentState, userMessage, aiResponse);
    
    // Check if we should follow mood arc
    const timeSinceLastTransition = (Date.now() - currentState.lastTransition) / 1000;
    const arcSuggestion = getNextEmotionInArc(currentState, timeSinceLastTransition);
    
    if (arcSuggestion && !emotionUpdate.current && timeSinceLastTransition > 180) {
      console.log(`🎭 Following mood arc: ${currentState.current} → ${arcSuggestion}`);
      emotionUpdate.current = arcSuggestion;
      emotionUpdate.lastTransition = Date.now();
    }
    
    // Apply updates if any
    if (Object.keys(emotionUpdate).length > 0) {
      await updateEmotionState(sessionId, emotionUpdate);
    }
    
    return emotionUpdate.current || currentState.current;
  } catch (error) {
    console.error('❌ Error processing emotion transition:', error);
    return 'happy'; // Safe default
  }
}

