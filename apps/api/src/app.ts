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
 * POST /listen
 * Transcribe audio to text using OpenAI API
 * Body: multipart/form-data with 'file' field
 */
app.post('/listen', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      console.error('❌ No audio file in request');
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log(`🎤 Transcribing audio: ${req.file.originalname}`);
    console.log(`   File size: ${req.file.size} bytes`);
    console.log(`   File type: ${req.file.mimetype}`);
    console.log(`   File path: ${req.file.path}`);

    const text = await transcribeAudioSimple(req.file.path);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    console.log(`✅ Transcription: "${text}"`);

    res.json({ text });
  } catch (error: any) {
    console.error('❌ Error in /listen:', error.message);
    console.error('   Stack:', error.stack);
    
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
  try {
    const { sessionId, message, history = [] } = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    console.log(`💬 Chat request for session ${sessionId}: "${message}"`);

    // Update state to "thinking"
    const sessionRef = db.collection('sessions').doc(sessionId);
    await sessionRef.set(
      {
        state: {
          phase: 'thinking',
          updatedAt: Date.now(),
        },
      },
      { merge: true }
    );

    // Get GPT response
    const response = await chat(message, history);

    // Update state with emotion
    await sessionRef.set(
      {
        state: {
          phase: 'idle',
          emotion: response.emotion,
          updatedAt: Date.now(),
        },
      },
      { merge: true }
    );

    console.log(`✅ GPT response (${response.emotion}): "${response.reply}"`);

    res.json({
      success: true,
      reply: response.reply,
      emotion: response.emotion,
    });
  } catch (error: any) {
    console.error('Error in /api/chat:', error);
    res.status(500).json({ error: error.message || 'Failed to generate response' });
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

    // Generate speech
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

    console.log(`✅ Speech generated: ${result.audioUrl}`);

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

export default app;

