/**
 * MINIMAL MODE - Candy AI Core Pipeline Only
 * 
 * This version removes all Firebase, Emotion Engine, and state management.
 * Focus: Whisper → GPT-4o → ElevenLabs pipeline testing
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
// Using ElevenLabs STT instead of OpenAI Whisper (more reliable)
import { transcribeAudioWithRetry } from './services/elevenlabs-stt';
import { generateSpeech, cleanupOldAudioFiles } from './services/tts';

// ❌ DISABLED: Firebase
// import { db } from './firebaseAdmin';

// ❌ DISABLED: Emotion Engine
// import { processEmotionTransition, initializeEmotionState, updateEmotionState } from './services/emotionEngine';
// import { analyzeSentiment, getEmotionEnergy, getEmotionSubtitle } from './services/sentiment';

// Import minimal GPT chat
import { chatMinimal } from './services/gpt.minimal';

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
 * Simple health check endpoint
 */
app.get('/health', (req, res) => {
  console.log('💚 Health check');
  res.json({ status: 'ok', mode: 'minimal', timestamp: Date.now() });
});

/**
 * POST /listen
 * Transcribe audio to text using OpenAI Whisper
 * Body: multipart/form-data with 'file' field
 */
app.post('/listen', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('\n🎤 [WHISPER] Transcription request received');
    
    if (!req.file) {
      console.error('❌ [WHISPER] No audio file in request');
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log(`   File: ${req.file.originalname} (${req.file.size} bytes)`);
    console.log(`   Type: ${req.file.mimetype}`);

    // Validate file size
    const MIN_FILE_SIZE = 500;
    if (req.file.size < MIN_FILE_SIZE) {
      console.warn(`⚠️ [WHISPER] File too small (${req.file.size} bytes)`);
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
      console.error('❌ [WHISPER] File does not exist after upload');
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
      console.log(`⏱️ [ELEVENLABS-STT] Duration: ${duration}ms`);

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
    console.error('❌ [WHISPER] Error:', error.message);
    
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
 * Complete conversation pipeline: GPT response + Speech generation
 * Body: { text: string }
 */
app.post('/talk', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    console.log(`\n🧠 [GPT] Request: "${text}"`);

    // Step 1: Get GPT response (NO emotion, NO Firebase)
    console.log(`⏱️ [GPT] Calling GPT-4o...`);
    const gptStartTime = Date.now();
    const reply = await chatMinimal(text);
    const gptDuration = Date.now() - gptStartTime;
    
    console.log(`✅ [GPT] Response: "${reply}"`);
    console.log(`⏱️ [GPT] Duration: ${gptDuration}ms`);

    // Step 2: Generate speech with ElevenLabs
    console.log(`\n🗣️ [ELEVENLABS] Generating speech...`);
    const ttsStartTime = Date.now();
    const result = await generateSpeech(reply);
    const ttsDuration = Date.now() - ttsStartTime;

    console.log(`✅ [ELEVENLABS] Voice generated: ${result.audioUrl}`);
    console.log(`⏱️ [ELEVENLABS] Duration: ${ttsDuration}ms`);

    const totalDuration = Date.now() - startTime;
    console.log(`\n⏱️ [TOTAL] Pipeline duration: ${totalDuration}ms\n`);

    res.json({
      success: true,
      reply,
      audioUrl: result.audioUrl,
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
 * POST /api/test
 * Test the full pipeline with a fixed message
 * This is for testing without needing to record audio
 */
app.post('/api/test', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('\n🧪 [TEST] Running full pipeline test...\n');

    const testMessage = req.body.message || "Hey babe, how are you doing?";

    // Step 1: Simulate ElevenLabs STT (skip actual transcription)
    console.log(`🎤 [TEST/ELEVENLABS-STT] Simulated transcription: "${testMessage}"`);
    const sttDuration = 50; // Simulated

    // Step 2: GPT
    console.log(`\n🧠 [TEST/GPT] Calling GPT-4o...`);
    const gptStartTime = Date.now();
    const reply = await chatMinimal(testMessage);
    const gptDuration = Date.now() - gptStartTime;
    
    console.log(`✅ [TEST/GPT] Response: "${reply}"`);
    console.log(`⏱️ [TEST/GPT] Duration: ${gptDuration}ms`);

    // Step 3: ElevenLabs
    console.log(`\n🗣️ [TEST/ELEVENLABS] Generating speech...`);
    const ttsStartTime = Date.now();
    const result = await generateSpeech(reply);
    const ttsDuration = Date.now() - ttsStartTime;

    console.log(`✅ [TEST/ELEVENLABS] Voice generated: ${result.audioUrl}`);
    console.log(`⏱️ [TEST/ELEVENLABS] Duration: ${ttsDuration}ms`);

    const totalDuration = Date.now() - startTime;
    
    console.log(`\n✅ [TEST] Full pipeline test completed!`);
    console.log(`⏱️ [TEST] Metrics:`);
    console.log(`   - ElevenLabs STT: ${sttDuration}ms (simulated)`);
    console.log(`   - GPT: ${gptDuration}ms`);
    console.log(`   - TTS: ${ttsDuration}ms`);
    console.log(`   - Total: ${totalDuration}ms`);
    console.log(`   - Target: < 3000ms (${totalDuration < 3000 ? '✅ PASS' : '❌ FAIL'})\n`);

    res.json({
      success: true,
      test: {
        input: testMessage,
        output: reply,
        audioUrl: result.audioUrl,
      },
      metrics: {
        stt: sttDuration,
        gpt: gptDuration,
        tts: ttsDuration,
        total: totalDuration,
        targetMet: totalDuration < 3000,
      }
    });
  } catch (error: any) {
    console.error('❌ [TEST] Error:', error.message);
    res.status(500).json({ 
      error: error.message || 'Test failed',
      details: error.stack,
    });
  }
});

export default app;

