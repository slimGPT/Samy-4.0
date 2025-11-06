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
import { transcribeAudioBuffer } from './services/elevenlabs-stt-only';
import { generateSpeech, cleanupOldAudioFiles } from './services/tts';
import { streamSpeech, generateSpeechStreaming } from './services/tts-streaming';
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

/**
 * Multer Error Handler
 * Wraps multer middleware to catch upload errors
 */
function handleUploadErrors(uploadMiddleware: any) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    uploadMiddleware(req, res, (err: any) => {
      if (err) {
        console.error('❌ [MULTER] File upload error:', err.message);
        return res.status(400).json({
          error: err.message || 'File upload failed',
          message: 'Could not process audio file',
          details: err.code || 'UPLOAD_ERROR'
        });
      }
      next();
    });
  };
}

function normalizeSttError(error: any, fallbackMessage: string, extra: Record<string, unknown> = {}) {
  const responseStatus = error?.response?.status;
  const status = typeof responseStatus === 'number' ? responseStatus : undefined;
  const rawDetails = error?.response?.data ?? error?.details ?? error?.data ?? null;

  let parsedDetails = rawDetails;
  if (typeof rawDetails === 'string') {
    try {
      parsedDetails = JSON.parse(rawDetails);
    } catch {
      parsedDetails = rawDetails;
    }
  }

  const message = error?.message || (typeof parsedDetails === 'object' && parsedDetails ? parsedDetails.error || parsedDetails.message : null) || fallbackMessage;

  return {
    status,
    error: message,
    message,
    details: parsedDetails,
    code: error?.code || error?.response?.data?.code,
    success: false,
    ...extra,
  };
}

// Clean up old audio files every hour
setInterval(() => {
  cleanupOldAudioFiles(3600000); // 1 hour
}, 3600000);

/**
 * Content Safety Check for Child-appropriate Content
 * Filters out inappropriate content and redirects with curiosity-driven responses
 */
function checkContentSafety(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // Inappropriate content patterns (adult, romantic, violent, etc.)
  const inappropriatePatterns = [
    // Romantic/sexual content
    /\b(sexy|hot|love.*you|kiss|babe|baby|honey|darling|romantic|flirt|seduce)\b/i,
    // Adult language
    /\b(fuck|shit|damn|hell|bitch|ass|sex|naked|porn|adult)\b/i,
    // Violence
    /\b(kill|die|murder|violence|weapon|gun|knife|fight|hurt)\b/i,
    // Adult themes
    /\b(drug|alcohol|beer|wine|smoke|drunk|politics|election|war)\b/i,
  ];
  
  // Check for inappropriate patterns
  for (const pattern of inappropriatePatterns) {
    if (pattern.test(lowerText)) {
      console.log(`⚠️ [SAFETY] Blocked inappropriate content: "${text}"`);
      return true;
    }
  }
  
  return false;
}

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

    // Check if Firebase is initialized
    if (!db) {
      console.warn('⚠️ Firebase not initialized - state update skipped');
      return res.status(503).json({ 
        error: 'Firebase not available',
        message: 'State updates require Firebase configuration'
      });
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
    res.status(500).json({ error: 'Failed to update state', details: error.message });
  }
});

/**
 * POST /listen
 * Fast transcription using ElevenLabs STT only
 * OPTIMIZED: No file save, direct buffer processing, detailed timing logs
 */
app.post('/listen', handleUploadErrors(upload.single('file')), async (req, res) => {
  const pipelineStartTime = Date.now();
  const timings: Record<string, number> = {};
  
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🎤 [/listen] NEW TRANSCRIPTION REQUEST');
    console.log('   Timestamp:', new Date().toISOString());
    
    // CRITICAL CHECK: File upload
    if (!req.file) {
      console.error('❌ [/listen] CRITICAL: No audio file in request!');
      return res.status(400).json({ 
        error: 'No file uploaded',
        message: 'Audio file is required',
      });
    }

    const fileReceiveTime = Date.now();
    timings.fileReceive = fileReceiveTime - pipelineStartTime;
    
    console.log(`   File: ${req.file.originalname} (${req.file.size} bytes)`);
    console.log(`   Type: ${req.file.mimetype}`);
    console.log(`⏱️ [TIMING] File received: ${timings.fileReceive}ms`);

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

    // Read file to buffer
    const fileReadStartTime = Date.now();
    const audioBuffer = fs.readFileSync(req.file.path);
    timings.fileRead = Date.now() - fileReadStartTime;
    console.log(`⏱️ [TIMING] File read to buffer: ${timings.fileRead}ms`);
    
    // Clean up file immediately (we have the buffer)
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      console.log('   ✅ Cleaned up uploaded file (using buffer now)');
    }

    // Fast transcription with ElevenLabs STT only
    const sttStartTime = Date.now();
    console.log('⏱️ [STT] Starting ElevenLabs STT transcription...');
    console.log('   API Key available:');
    console.log('   - ELEVENLABS_API_KEY:', process.env.ELEVENLABS_API_KEY ? '✅ Present' : '❌ Missing');
    
    try {
      const text = await transcribeAudioBuffer(audioBuffer, req.file.mimetype || 'audio/webm');
      timings.sttApi = Date.now() - sttStartTime;
      timings.sttTotal = timings.sttApi;
      
      console.log('✅ [STT] Transcription successful!');
      console.log(`   Text: "${text}"`);
      console.log(`⏱️ [TIMING] STT API duration: ${timings.sttApi}ms`);
      console.log(`⏱️ [TIMING] STT total (including overhead): ${timings.sttTotal}ms`);
      console.log(`⏱️ [TIMING] Audio size: ${audioBuffer.length} bytes`);
      console.log(`⏱️ [TIMING] Audio duration estimate: ~${Math.round(audioBuffer.length / 2000)}ms`);

      // Validate transcription result
      if (!text || text.trim() === '') {
        console.error('❌ [STT] CRITICAL: Empty transcription received!');
        throw new Error('Empty transcription received from STT service');
      }

      const totalDuration = Date.now() - pipelineStartTime;
      timings.total = totalDuration;
      
      console.log('✅ [/listen] SUCCESS');
      console.log(`⏱️ [TIMING] Total pipeline: ${totalDuration}ms`);
      console.log('   Breakdown:');
      console.log(`     - File receive: ${timings.fileReceive}ms`);
      console.log(`     - File read: ${timings.fileRead}ms`);
      console.log(`     - STT API: ${timings.sttApi}ms`);
      console.log(`     - STT total: ${timings.sttTotal}ms`);
      console.log(`     - Total: ${totalDuration}ms`);
      console.log('='.repeat(60) + '\n');

      return res.json({ 
        text: text.trim(), 
        duration: totalDuration,
        timings,
        success: true 
      });
    } catch (transcriptionError: any) {
      timings.sttTotal = Date.now() - sttStartTime;
      console.error('\n' + '!'.repeat(60));
      console.error('❌ [STT] TRANSCRIPTION FAILED');
      console.error(`⏱️ [TIMING] Failed after: ${timings.sttTotal}ms`);
      console.error('   Error message:', transcriptionError.message);
      console.error('!'.repeat(60));

      const retry = !transcriptionError?.message?.toLowerCase()?.includes('api key');
      const fallbackMessage = retry
        ? 'Could not transcribe audio. Please try again.'
        : 'Service configuration error. Please contact support.';

      const normalizedError = normalizeSttError(transcriptionError, fallbackMessage, {
        retry,
        timings,
        stage: 'transcription',
      });

      const statusCode = normalizedError.status && normalizedError.status >= 400
        ? normalizedError.status
        : 503;

      return res.status(statusCode).json(normalizedError);
    }
  } catch (error: any) {
    console.error('\n' + '!'.repeat(60));
    console.error('❌ [/listen] OUTER CATCH - UNEXPECTED ERROR');
    console.error('   Error:', error.message);
    console.error('!'.repeat(60) + '\n');
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    const normalizedError = normalizeSttError(error, 'An unexpected error occurred during transcription', {
      timings,
      stage: 'listen-handler',
    });

    const statusCode = normalizedError.status && normalizedError.status >= 400
      ? normalizedError.status
      : 500;

    return res.status(statusCode).json(normalizedError);
  }
});

/**
 * POST /talk
 * Full pipeline: GPT response + Emotion detection + TTS
 * WITH Firebase sync and emotion tracking
 * OPTIMIZED: Detailed timing logs for each step
 */
app.post('/talk', async (req, res) => {
  const pipelineStartTime = Date.now();
  const timings: Record<string, number> = {};
  
  try {
    const { text, sessionId, isPartial } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    console.log(`\n🧠 [/talk] NEW REQUEST`);
    console.log(`   Text: "${text}"`);
    console.log(`   Is partial: ${isPartial || false}`);
    
    // Default session if not provided
    const activeSessionId = sessionId || 'demo-session';

    // Content safety check for child-appropriate content
    const containsInappropriateContent = checkContentSafety(text);
    if (containsInappropriateContent) {
      console.log(`⚠️ [SAFETY] Inappropriate content detected, redirecting...`);
      return res.json({
        success: true,
        reply: "Hmm, that sounds tricky — wanna talk about animals instead? Or maybe we could explore something fun together!",
        audioUrl: null, // Skip TTS for safety redirects
        emotion: 'curious',
        metrics: { sentiment: 0, firebaseThinking: 0, gpt: 0, emotionTransition: 0, tts: 0, firebaseSpeaking: 0, total: 0 },
        timings: {}
      });
    }

    // OPTIMIZATION: Parallelize sentiment analysis and GPT (GPT can infer emotion)
    // Start GPT immediately, run sentiment in parallel
    const gptStartTime = Date.now();
    const sentimentStartTime = Date.now();
    
    console.log(`⏱️ [GPT] Starting GPT-4o as SamyBear (optimized pipeline)...`);
    
    // Start GPT and sentiment in parallel
    const [reply, sentimentResult] = await Promise.all([
      chatMinimal(text, 'curious'), // Start with default, will update after sentiment
      Promise.resolve().then(async () => {
        try {
          const emotion = await analyzeSentiment(text);
          const energy = getEmotionEnergy(emotion);
          timings.sentiment = Date.now() - sentimentStartTime;
          console.log(`✅ [SENTIMENT] Detected: ${emotion} (energy: ${Math.round(energy * 100)}%)`);
          console.log(`⏱️ [TIMING] Sentiment analysis: ${timings.sentiment}ms`);
          return { emotion, energy };
        } catch (error: any) {
          timings.sentiment = Date.now() - sentimentStartTime;
          console.warn(`⚠️ [SENTIMENT] Failed, using default: ${error.message}`);
          return { emotion: 'curious', energy: 0.65 };
        }
      })
    ]);

    timings.gpt = Date.now() - gptStartTime;
    let detectedEmotion = sentimentResult.emotion;
    let emotionEnergy = sentimentResult.energy;
    
    console.log(`✅ [GPT] Response: "${reply}"`);
    console.log(`⏱️ [TIMING] GPT generation: ${timings.gpt}ms`);

    // Update Firebase state to "thinking" (non-blocking, parallel)
    const firebaseThinkingStartTime = Date.now();
    if (sessionId && db) {
      const firebaseUpdate = db.collection('sessions').doc(activeSessionId).set(
        {
          state: {
            phase: 'thinking',
            emotion: detectedEmotion,
            energy: emotionEnergy,
            updatedAt: Date.now(),
          },
        },
        { merge: true }
      ).then(() => {
        timings.firebaseThinking = Date.now() - firebaseThinkingStartTime;
        console.log(`✅ [FIREBASE] State synced`);
        console.log(`⏱️ [TIMING] Firebase thinking update: ${timings.firebaseThinking}ms`);
      }).catch((error: any) => {
        timings.firebaseThinking = Date.now() - firebaseThinkingStartTime;
        console.warn(`⚠️ [FIREBASE] Sync failed: ${error.message}`);
      });
      // Don't await - let it run in background
    } else {
      timings.firebaseThinking = 0;
    }

    // Step 4: Process emotion transition (update SamyBear's emotion based on conversation)
    const emotionTransitionStartTime = Date.now();
    if (sessionId && db) {
      console.log(`🎭 [EMOTION] Processing emotion transition...`);
      try {
        const finalEmotion = await processEmotionTransition(activeSessionId, text, reply);
        timings.emotionTransition = Date.now() - emotionTransitionStartTime;
        console.log(`✅ [EMOTION] Updated to: ${finalEmotion}`);
        console.log(`⏱️ [TIMING] Emotion transition: ${timings.emotionTransition}ms`);
        detectedEmotion = finalEmotion;
      } catch (error: any) {
        timings.emotionTransition = Date.now() - emotionTransitionStartTime;
        console.warn(`⚠️ [EMOTION] Failed to process: ${error.message}`);
        console.log(`⏱️ [TIMING] Emotion transition (failed): ${timings.emotionTransition}ms`);
      }
    } else if (sessionId && !db) {
      timings.emotionTransition = 0;
      console.log(`⏭️ [EMOTION] Skipped (Firebase not initialized)`);
    } else {
      timings.emotionTransition = 0;
    }

    // Step 5: Generate speech with emotion-based settings (OPTIMIZED: Use streaming TTS)
    const ttsStartTime = Date.now();
    console.log(`\n🗣️ [ELEVENLABS-STREAMING-TTS] Starting streaming speech generation...`);
    
    // Emotion-based voice settings
    const voiceSettings = getEmotionVoiceSettings(detectedEmotion);
    
    // Use streaming TTS for faster response (English model for speed)
    const result = await generateSpeechStreaming(reply, {
      ...voiceSettings,
      modelId: 'eleven_monolingual_v1', // English-only for fastest response
    });
    timings.tts = Date.now() - ttsStartTime;

    console.log(`✅ [ELEVENLABS-STREAMING-TTS] Voice generated: ${result.audioUrl}`);
    console.log(`⏱️ [TIMING] TTS generation: ${timings.tts}ms`);

    // Step 6: Update Firebase state to "speaking"
    const firebaseSpeakingStartTime = Date.now();
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
        timings.firebaseSpeaking = Date.now() - firebaseSpeakingStartTime;
        console.log(`✅ [FIREBASE] State synced`);
        console.log(`⏱️ [TIMING] Firebase speaking update: ${timings.firebaseSpeaking}ms`);
      } catch (error: any) {
        timings.firebaseSpeaking = Date.now() - firebaseSpeakingStartTime;
        console.warn(`⚠️ [FIREBASE] Sync failed: ${error.message}`);
        console.log(`⏱️ [TIMING] Firebase speaking update (failed): ${timings.firebaseSpeaking}ms`);
      }
    } else if (sessionId && !db) {
      timings.firebaseSpeaking = 0;
      console.log(`⏭️ [FIREBASE] Skipped (not initialized)`);
    } else {
      timings.firebaseSpeaking = 0;
    }

    const totalDuration = Date.now() - pipelineStartTime;
    timings.total = totalDuration;
    
    console.log(`\n⏱️ [TOTAL] Pipeline duration: ${totalDuration}ms`);
    console.log('   Breakdown:');
    console.log(`     - Sentiment: ${timings.sentiment}ms`);
    console.log(`     - Firebase (thinking): ${timings.firebaseThinking}ms`);
    console.log(`     - GPT: ${timings.gpt}ms`);
    console.log(`     - Emotion transition: ${timings.emotionTransition}ms`);
    console.log(`     - TTS: ${timings.tts}ms`);
    console.log(`     - Firebase (speaking): ${timings.firebaseSpeaking}ms`);
    console.log(`     - Total: ${totalDuration}ms`);
    console.log('='.repeat(60) + '\n');

    res.json({
      success: true,
      reply,
      audioUrl: result.audioUrl,
      emotion: detectedEmotion,
      metrics: {
        sentiment: timings.sentiment,
        firebaseThinking: timings.firebaseThinking,
        gpt: timings.gpt,
        emotionTransition: timings.emotionTransition,
        tts: timings.tts,
        firebaseSpeaking: timings.firebaseSpeaking,
        total: totalDuration,
      },
      timings
    });
  } catch (error: any) {
    const totalDuration = Date.now() - pipelineStartTime;
    console.error('❌ [TALK] Error:', error.message);
    console.error(`⏱️ [TIMING] Failed after: ${totalDuration}ms`);
    res.status(500).json({ 
      error: error.message || 'Failed to generate response',
      timings: { ...timings, total: totalDuration }
    });
  }
});

/**
 * POST /talk/stream
 * Streaming TTS endpoint - returns audio chunks as they're generated
 * Enables immediate playback on frontend
 */
app.post('/talk/stream', async (req, res) => {
  try {
    const { text, sessionId } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    console.log(`\n🗣️ [/talk/stream] Streaming TTS request`);
    console.log(`   Text: "${text.substring(0, 50)}..."`);

    // Set up streaming response
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const startTime = Date.now();
    let chunkCount = 0;

    try {
      // Stream audio chunks
      for await (const chunk of streamSpeech(text, {
        modelId: 'eleven_monolingual_v1', // English for fastest response
      })) {
        if (chunk.audio.length > 0) {
          chunkCount++;
          res.write(chunk.audio);
        }
        
        if (chunk.isFinal) {
          break;
        }
      }

      const duration = Date.now() - startTime;
      console.log(`✅ [/talk/stream] Streaming complete in ${duration}ms (${chunkCount} chunks)`);
      
      res.end();
    } catch (error: any) {
      console.error('❌ [/talk/stream] Error:', error.message);
      res.status(500).end();
    }
  } catch (error: any) {
    console.error('❌ [/talk/stream] Error:', error.message);
    res.status(500).json({ error: error.message });
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

/**
 * GLOBAL ERROR HANDLER
 * Ensures ALL errors return proper JSON responses (never empty bodies)
 */
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ [GLOBAL ERROR HANDLER] Uncaught error:', err);
  console.error('   Path:', req.path);
  console.error('   Method:', req.method);
  console.error('   Error:', err.message);
  console.error('   Stack:', err.stack);
  
  // Ensure we always send JSON
  if (!res.headersSent) {
    res.status(500).json({
      error: err.message || 'Internal server error',
      message: 'An unexpected error occurred',
      details: err.toString(),
      path: req.path
    });
  }
});

/**
 * 404 HANDLER
 * Handle routes that don't exist
 */
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} does not exist`,
    path: req.path
  });
});

export default app;

