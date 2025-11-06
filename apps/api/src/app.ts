import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from './firebaseAdmin';
import type { SessionState } from '@packages/shared';
import { transcribeAudioSimple } from './services/whisper';
import { chat } from './services/gpt';
import { generateSpeech, cleanupOldAudioFiles } from './services/tts';
import { processEmotionTransition, initializeEmotionState, updateEmotionState } from './services/emotionEngine';
import { analyzeSentiment, getEmotionEnergy, getEmotionSubtitle } from './services/sentiment';

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
 * POST /state
 * Updates session state in Firestore
 * Body: { sessionId: string, patch: Partial<SessionState> }
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
    
    // Merge the patch with current state and update timestamp
    await sessionRef.set(
      {
        state: {
          ...patch,
          updatedAt: Date.now(),
        },
      },
      { merge: true }
    );

    res.json({ success: true, sessionId });
  } catch (error) {
    console.error('Error updating state:', error);
    res.status(500).json({ error: 'Failed to update state' });
  }
});

/**
 * GET /api/listen/test
 * Test endpoint to check connectivity
 */
app.get('/api/listen/test', async (req, res) => {
  try {
    // Test OpenAI connectivity
    let openaiStatus = 'unknown';
    try {
      const testResponse = await fetch('https://api.openai.com/v1/models', {
        method: 'HEAD',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        signal: AbortSignal.timeout(3000),
      });
      openaiStatus = testResponse.ok ? 'reachable' : 'unreachable';
    } catch (error: any) {
      openaiStatus = error.name === 'TimeoutError' ? 'timeout' : 'unreachable';
    }

    res.json({
      ok: true,
      connection: 'local',
      openai: openaiStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * POST /listen
 * Transcribe audio to text using OpenAI API
 * Body: multipart/form-data with 'file' field
 */
app.post('/listen', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  try {
    console.log(`⏱️ [TIMING] /listen request received at ${new Date().toISOString()}`);
    
    if (!req.file) {
      console.error('❌ No audio file in request');
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log(`🎤 Transcribing audio: ${req.file.originalname}`);
    console.log(`   File size: ${req.file.size} bytes`);
    console.log(`   File type: ${req.file.mimetype}`);
    console.log(`   File path: ${req.file.path}`);
    console.log(`⏱️ [TIMING] File uploaded and validated (+${Date.now() - startTime}ms)`);

    // Validate file size (too small = corrupt/incomplete recording)
    const MIN_FILE_SIZE = 500; // bytes
    if (req.file.size < MIN_FILE_SIZE) {
      console.warn(`⚠️ File too small (${req.file.size} bytes) - likely corrupt or incomplete`);
      // Clean up the corrupt file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ 
        error: 'Recording too short or corrupt',
        retry: true,
        message: 'You gotta say *something*, babe 😘'
      });
    }

    // Verify file exists and is readable
    if (!fs.existsSync(req.file.path)) {
      console.error('❌ File does not exist after upload');
      return res.status(500).json({ 
        error: 'File upload failed',
        retry: true 
      });
    }

    // Transcribe audio using OpenAI Whisper (REAL transcription only - no fallbacks)
    console.log(`⏱️ [TIMING] Starting OpenAI Whisper transcription (+${Date.now() - startTime}ms)`);
    
    try {
      const text = await transcribeAudioSimple(req.file.path);
      console.log(`⏱️ [TIMING] Transcription completed (+${Date.now() - startTime}ms)`);
      
      // Clean up uploaded file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      console.log(`✅ Transcription: "${text}"`);
      console.log(`⏱️ [TIMING] Total /listen time: ${Date.now() - startTime}ms`);

      res.json({ text });
    } catch (transcriptionError: any) {
      console.error('❌ Transcription failed:', transcriptionError.message);
      
      // Clean up uploaded file on error
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      // Return 503 Service Unavailable - Whisper is down or unreachable
      return res.status(503).json({ 
        error: 'Transcription service unavailable',
        message: 'Whisper transcription failed. Please try again.',
        details: transcriptionError.message
      });
    }
  } catch (error: any) {
    console.error('❌ Error in /listen:', error.message);
    console.error('   Stack:', error.stack);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    // Return the actual OpenAI error payload for debugging
    const errorResponse: any = {
      error: error.message || 'Failed to transcribe audio',
      message: error.message,
    };
    
    // Include OpenAI-specific error details if available
    if (error.details) {
      errorResponse.details = error.details;
    }
    if (error.originalError) {
      errorResponse.openaiError = {
        type: error.originalError.type,
        code: error.originalError.code,
        status: error.originalError.status,
      };
    }
    
    res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/chat
 * Generate GPT response with emotion detection
 * Body: { sessionId: string, message: string, history?: Array }
 */
app.post('/api/chat', async (req, res) => {
  const startTime = Date.now();
  try {
    const { sessionId, message, history = [] } = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    console.log(`💬 Chat request for session ${sessionId}: "${message}"`);
    console.log(`⏱️ [TIMING] Chat request started at ${new Date().toISOString()}`);

    // 🧠 Step 1: Analyze sentiment of user message
    // TEMPORARILY DISABLED - using default to save API calls
    const detectedEmotion = 'calm';
    const emotionEnergy = 0.5;
    console.log(`🎭 Using default emotion: ${detectedEmotion} (bypassing sentiment API)`);
    
    /*
    try {
      detectedEmotion = await analyzeSentiment(message);
      emotionEnergy = getEmotionEnergy(detectedEmotion);
      console.log(`🎭 Detected emotion: ${detectedEmotion} (energy: ${Math.round(emotionEnergy * 100)}%)`);
    } catch (error: any) {
      console.error(`❌ Sentiment analysis failed: ${error.message}`);
      console.log('💡 Using default emotion: calm');
      detectedEmotion = 'calm';
      emotionEnergy = 0.5;
    }
    */

    // Update state to "thinking" with detected emotion
    console.log(`⏱️ [TIMING] Updating Firestore state...`);
    const sessionRef = db.collection('sessions').doc(sessionId);
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
    console.log(`⏱️ [TIMING] Firestore updated (+${Date.now() - startTime}ms)`);

    // Step 2: Get GPT response with emotion context
    console.log(`🤖 Calling GPT for response...`);
    console.log(`⏱️ [TIMING] GPT request started (+${Date.now() - startTime}ms)`);
    const response = await chat(message, history, detectedEmotion);
    console.log(`⏱️ [TIMING] GPT response received (+${Date.now() - startTime}ms)`);
    console.log(`✅ GPT response received: "${response.reply.substring(0, 50)}..."`);


    // Step 3: Keep the detected emotion (not from GPT)
    const finalEmotion = detectedEmotion;

    // ✅ Keep phase as 'thinking' - it will be updated to 'speaking' by /api/speak
    // Update state with emotion but keep thinking phase
    console.log(`⏱️ [TIMING] Updating final state...`);
    await sessionRef.set(
      {
        state: {
          phase: 'thinking', // Keep thinking until TTS starts
          emotion: finalEmotion,
          updatedAt: Date.now(),
        },
      },
      { merge: true }
    );
    console.log(`⏱️ [TIMING] Final state updated (+${Date.now() - startTime}ms)`);

    console.log(`✅ SamyBear's response (${finalEmotion}): "${response.reply}"`);
    console.log(`⏱️ [TIMING] Total chat time: ${Date.now() - startTime}ms`);

    res.json({
      success: true,
      reply: response.reply,
      emotion: finalEmotion,
    });
  } catch (error: any) {
    console.error('❌ Error in /api/chat:', error.message);
    console.error('   Full error:', error);
    console.error('   Stack:', error.stack);
    
    // Return detailed error for debugging
    res.status(500).json({ 
      error: error.message || 'Failed to generate response',
      details: error.response?.data || error.toString()
    });
  }
});

/**
 * POST /api/speak
 * Generate speech audio from text using ElevenLabs
 * Body: { sessionId: string, text: string, voiceId?: string }
 */
app.post('/api/speak', async (req, res) => {
  try {
    const { sessionId, text, voiceId } = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    console.log(`🔊 Generating speech for session ${sessionId}: "${text.substring(0, 50)}..."`);

    // Update state to "speaking"
    const sessionRef = db.collection('sessions').doc(sessionId);
    await sessionRef.set(
      {
        state: {
          phase: 'speaking',
          updatedAt: Date.now(),
        },
      },
      { merge: true }
    );

    // Generate speech with SamyBear's voice
    const result = await generateSpeech(text, { voiceId });

    // Update state with audio URL
    await sessionRef.set(
      {
        state: {
          phase: 'speaking',
          lastAudioUrl: result.audioUrl,
          updatedAt: Date.now(),
        },
      },
      { merge: true }
    );

    console.log(`✅ SamyBear's speech generated: ${result.audioUrl}`);

    res.json({
      success: true,
      audioUrl: result.audioUrl,
    });
  } catch (error: any) {
    console.error('Error in /api/speak:', error);
    res.status(500).json({ error: error.message || 'Failed to generate speech' });
  }
});

/**
 * GET /health
 * Simple health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

/**
 * GET /test-voice
 * Test Arabella voice generation
 */
app.get('/test-voice', async (req, res) => {
  try {
    console.log('🧪 Testing Arabella voice...');
    
    const testText = "Hello! This is SamyBear speaking. I'm your curious teddy bear friend!";
    
    const result = await generateSpeech(testText, {
      stability: 0.71,
      similarityBoost: 0.85,
    });
    
    console.log('✅ Test voice generated:', result.audioUrl);
    
    res.json({
      success: true,
      message: 'Arabella voice test successful',
      audioUrl: result.audioUrl,
      text: testText,
    });
  } catch (error: any) {
    console.error('❌ Test voice failed:', error);
    res.status(500).json({
      error: error.message,
      details: error.response?.data || error.toString(),
    });
  }
});

export default app;

