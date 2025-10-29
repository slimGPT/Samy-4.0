/**
 * FULL MODE - Candy AI with Firebase, Emotions, and User Context
 * 
 * This version includes:
 * - ElevenLabs STT (working and stable)
 * - GPT-4o (working and stable)
 * - ElevenLabs TTS (working and stable)
 * - Firebase integration (users, sessions, emotions)
 * - Emotion Engine (dynamic emotional responses)
 * - User context and session management
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Core AI services (stable and working)
import { transcribeAudioWithRetry } from './services/elevenlabs-stt';
import { generateSpeech, cleanupOldAudioFiles } from './services/tts';
import { chatMinimal } from './services/gpt.minimal';

// Firebase integration
import { db } from './firebaseAdmin';
import type { SessionState } from '@packages/shared';

// Emotion engine (re-enabled)
import { processEmotionTransition, initializeEmotionState } from './services/emotionEngine';
import { analyzeSentiment, getEmotionEnergy } from './services/sentiment';

const app = express();

app.use(cors());
app.use(express.json());

// Serve static audio files
const audioDir = path.join(process.cwd(), 'temp', 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}
app.use('/audio', express.static(audioDir));

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'temp', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm', 'audio/ogg'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav|m4a|webm|ogg)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio file type'));
    }
  },
});

// Clean up old audio files every hour
setInterval(() => {
  cleanupOldAudioFiles(3600000); // 1 hour
}, 3600000);

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  console.log('💚 Health check');
  res.json({ status: 'ok', mode: 'full', timestamp: Date.now() });
});

/**
 * POST /state
 * Update session state in Firebase
 */
app.post('/state', async (req, res) => {
  try {
    const { sessionId, patch } = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    if (!patch || typeof patch !== 'object') {
      return res.status(400).json({ error: 'patch is required' });
    }

    const sessionRef = db.collection('sessions').doc(sessionId);
    
    await sessionRef.set(
      {
        state: {
          ...patch,
          updatedAt: Date.now(),
        },
      },
      { merge: true }
    );

    console.log(`🔄 State updated for session ${sessionId}`);
    res.json({ success: true, sessionId });
  } catch (error: any) {
    console.error('❌ Error updating state:', error);
    res.status(500).json({ error: 'Failed to update state' });
  }
});

/**
 * POST /listen
 * Transcribe audio using ElevenLabs STT (stable)
 */
app.post('/listen', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('\n🎤 [ELEVENLABS-STT] Transcription request received');
    
    if (!req.file) {
      console.error('❌ No audio file in request');
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log(`   File: ${req.file.originalname} (${req.file.size} bytes)`);
    console.log(`   Type: ${req.file.mimetype}`);

    // Validate file size
    const MIN_FILE_SIZE = 500;
    if (req.file.size < MIN_FILE_SIZE) {
      console.warn(`⚠️ File too small (${req.file.size} bytes)`);
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ 
        error: 'Recording too short or corrupt',
        retry: true,
      });
    }

    // Verify file exists
    if (!fs.existsSync(req.file.path)) {
      console.error('❌ File does not exist after upload');
      return res.status(500).json({ 
        error: 'File upload failed',
        retry: true 
      });
    }

    // Transcribe with ElevenLabs STT
    console.log(`⏱️ [ELEVENLABS-STT] Starting transcription...`);
    
    try {
      const text = await transcribeAudioWithRetry(req.file.path);
      const duration = Date.now() - startTime;
      
      // Clean up uploaded file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      console.log(`✅ [ELEVENLABS-STT] Transcribed: "${text}"`);
      console.log(`⏱️ [ELEVENLABS-STT] Duration: ${duration}ms\n`);

      res.json({ text, duration });
    } catch (transcriptionError: any) {
      console.error('❌ [ELEVENLABS-STT] Transcription failed:', transcriptionError.message);
      
      // Clean up file on error
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(503).json({ 
        error: 'Transcription service unavailable',
        message: 'ElevenLabs STT failed. Please try again.',
        details: transcriptionError.message
      });
    }
  } catch (error: any) {
    console.error('❌ [ELEVENLABS-STT] Error:', error.message);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      error: error.message || 'Failed to transcribe audio',
    });
  }
});

/**
 * POST /talk
 * Full pipeline: GPT response + Emotion detection + TTS
 * WITH Firebase sync and emotion tracking
 */
app.post('/talk', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { text, sessionId } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    console.log(`\n🧠 [GPT] Request: "${text}"`);
    
    // Default session if not provided
    const activeSessionId = sessionId || 'demo-session';

    // Step 1: Analyze sentiment (detect emotion from user message)
    console.log(`🎭 [SENTIMENT] Analyzing user emotion...`);
    let detectedEmotion = 'calm';
    let emotionEnergy = 0.5;
    
    try {
      detectedEmotion = await analyzeSentiment(text);
      emotionEnergy = getEmotionEnergy(detectedEmotion);
      console.log(`✅ [SENTIMENT] Detected: ${detectedEmotion} (energy: ${Math.round(emotionEnergy * 100)}%)`);
    } catch (error: any) {
      console.warn(`⚠️ [SENTIMENT] Failed, using default: ${error.message}`);
    }

    // Step 2: Update Firebase state to "thinking" with detected emotion
    if (sessionId && db) {
      console.log(`🔄 [FIREBASE] Updating state to 'thinking'...`);
      try {
        const sessionRef = db.collection('sessions').doc(activeSessionId);
        await sessionRef.set(
          {
            state: {
              phase: 'thinking',
              emotion: detectedEmotion,
              energy: emotionEnergy,
              updatedAt: Date.now(),
            },
          },
          { merge: true }
        );
        console.log(`✅ [FIREBASE] State synced`);
      } catch (error: any) {
        console.warn(`⚠️ [FIREBASE] Sync failed: ${error.message}`);
      }
    } else if (sessionId && !db) {
      console.log(`⏭️ [FIREBASE] Skipped (not initialized)`);
    }

    // Step 3: Get GPT response (stable)
    console.log(`⏱️ [GPT] Calling GPT-4o...`);
    const gptStartTime = Date.now();
    const reply = await chatMinimal(text);
    const gptDuration = Date.now() - gptStartTime;
    
    console.log(`✅ [GPT] Response: "${reply}"`);
    console.log(`⏱️ [GPT] Duration: ${gptDuration}ms`);

    // Step 4: Process emotion transition (update Candy's emotion based on conversation)
    if (sessionId && db) {
      console.log(`🎭 [EMOTION] Processing emotion transition...`);
      try {
        const finalEmotion = await processEmotionTransition(activeSessionId, text, reply);
        console.log(`✅ [EMOTION] Updated to: ${finalEmotion}`);
        detectedEmotion = finalEmotion;
      } catch (error: any) {
        console.warn(`⚠️ [EMOTION] Failed to process: ${error.message}`);
      }
    } else if (sessionId && !db) {
      console.log(`⏭️ [EMOTION] Skipped (Firebase not initialized)`);
    }

    // Step 5: Generate speech with emotion-based settings
    console.log(`\n🗣️ [ELEVENLABS-TTS] Generating speech...`);
    const ttsStartTime = Date.now();
    
    // Emotion-based voice settings
    const voiceSettings = getEmotionVoiceSettings(detectedEmotion);
    const result = await generateSpeech(reply, voiceSettings);
    const ttsDuration = Date.now() - ttsStartTime;

    console.log(`✅ [ELEVENLABS-TTS] Voice generated: ${result.audioUrl}`);
    console.log(`⏱️ [ELEVENLABS-TTS] Duration: ${ttsDuration}ms`);

    // Step 6: Update Firebase state to "speaking"
    if (sessionId && db) {
      console.log(`🔄 [FIREBASE] Updating state to 'speaking'...`);
      try {
        const sessionRef = db.collection('sessions').doc(activeSessionId);
        await sessionRef.set(
          {
            state: {
              phase: 'speaking',
              emotion: detectedEmotion,
              lastAudioUrl: result.audioUrl,
              updatedAt: Date.now(),
            },
          },
          { merge: true }
        );
        console.log(`✅ [FIREBASE] State synced`);
      } catch (error: any) {
        console.warn(`⚠️ [FIREBASE] Sync failed: ${error.message}`);
      }
    } else if (sessionId && !db) {
      console.log(`⏭️ [FIREBASE] Skipped (not initialized)`);
    }

    const totalDuration = Date.now() - startTime;
    console.log(`\n⏱️ [TOTAL] Pipeline duration: ${totalDuration}ms\n`);

    res.json({
      success: true,
      reply,
      audioUrl: result.audioUrl,
      emotion: detectedEmotion,
      metrics: {
        gpt: gptDuration,
        tts: ttsDuration,
        total: totalDuration,
      }
    });
  } catch (error: any) {
    console.error('❌ [TALK] Error:', error.message);
    res.status(500).json({ 
      error: error.message || 'Failed to generate response',
    });
  }
});

/**
 * Get emotion-based voice settings for TTS
 */
function getEmotionVoiceSettings(emotion: string): any {
  const settings: Record<string, any> = {
    flirty: { stability: 0.65, similarityBoost: 0.90 }, // More expressive
    affectionate: { stability: 0.75, similarityBoost: 0.85 }, // Warm and caring
    playful: { stability: 0.60, similarityBoost: 0.90 }, // Energetic
    bitchy: { stability: 0.70, similarityBoost: 0.85 }, // Confident
    sad: { stability: 0.80, similarityBoost: 0.75 }, // Softer
    angry: { stability: 0.65, similarityBoost: 0.90 }, // Intense
    calm: { stability: 0.75, similarityBoost: 0.80 }, // Balanced
    curious: { stability: 0.70, similarityBoost: 0.85 }, // Engaged
  };

  return settings[emotion] || { stability: 0.71, similarityBoost: 0.85 };
}

export default app;

