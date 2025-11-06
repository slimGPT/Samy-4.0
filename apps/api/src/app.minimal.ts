/**
 * MINIMAL MODE - SamyBear 4.0 Core Pipeline Only
 * 
 * This version removes all Firebase, Emotion Engine, and state management.
 * Focus: ElevenLabs STT → GPT-4o → ElevenLabs TTS pipeline
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
// Using ElevenLabs STT directly for testing (no fallback)
import { transcribeAudioBuffer } from './services/elevenlabs-stt-only';
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

    // Transcribe with ElevenLabs STT only
    console.log(`⏱️ [STT] Starting transcription with ElevenLabs STT...`);
    console.log(`🔑 [STT] API Key: ${process.env.ELEVENLABS_API_KEY ? `${process.env.ELEVENLABS_API_KEY.substring(0, 15)}...` : 'NOT FOUND'}`);
    
    try {
      const { transcribeAudioBuffer } = require('./services/elevenlabs-stt-only');
      const audioBuffer = fs.readFileSync(req.file.path);
      const text = await transcribeAudioBuffer(audioBuffer, req.file.mimetype || 'audio/webm');
      const duration = Date.now() - startTime;
      
      // Clean up uploaded file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      // Validate transcription result
      if (!text || text.trim() === '') {
        throw new Error('Empty transcription received');
      }

      console.log(`✅ [STT] Transcribed: "${text}"`);
      console.log(`⏱️ [STT] Duration: ${duration}ms`);

      res.json({ 
        text: text.trim(), 
        duration,
        success: true 
      });
    } catch (transcriptionError: any) {
      console.error('❌ [STT] ElevenLabs STT transcription failed:', transcriptionError.message);
      console.error('   Error type:', transcriptionError.name);
      console.error('   Full error details:', {
        message: transcriptionError.message,
        status: transcriptionError.response?.status,
        statusText: transcriptionError.response?.statusText,
        apiResponse: transcriptionError.response?.data,
        stack: transcriptionError.stack
      });
      
      // Clean up file on error
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      // Determine user-friendly error message with detailed diagnostics
      let userMessage = 'Could not transcribe audio. Please try again.';
      let shouldRetry = true;
      
      if (transcriptionError.message.includes('API key')) {
        userMessage = 'ElevenLabs API key error. Check your API key configuration.';
        shouldRetry = false;
      } else if (transcriptionError.response?.status === 401) {
        userMessage = 'ElevenLabs API key is invalid or expired. Please update your API key.';
        shouldRetry = false;
      } else if (transcriptionError.response?.status === 403) {
        userMessage = 'ElevenLabs API access denied. Check your subscription and API key permissions.';
        shouldRetry = false;
      } else if (transcriptionError.response?.status === 429) {
        userMessage = 'ElevenLabs rate limit exceeded. Please wait a moment and try again.';
      } else if (transcriptionError.message.includes('rate limit') || transcriptionError.message.includes('quota')) {
        userMessage = 'Service temporarily unavailable. Please try again in a moment.';
      } else if (transcriptionError.message.includes('timeout')) {
        userMessage = 'Request timed out. Please try recording a shorter message.';
      } else if (transcriptionError.message.includes('unavailable')) {
        userMessage = 'ElevenLabs STT service is unavailable. Please try again later.';
      }
      
      return res.status(503).json({ 
        error: userMessage,
        message: userMessage,
        details: transcriptionError.message,
        status: transcriptionError.response?.status,
        apiResponse: transcriptionError.response?.data,
        retry: shouldRetry,
        success: false
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
 * POST /api/chat-gpt
 * Test GPT conversation flow only (no TTS)
 * Body: { text: string }
 */
app.post('/api/chat-gpt', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    console.log(`\n🧠 [GPT-ONLY] Request: "${text}"`);

    const gptStartTime = Date.now();
    const reply = await chatMinimal(text);
    const gptDuration = Date.now() - gptStartTime;
    
    console.log(`✅ [GPT-ONLY] Response: "${reply}"`);
    console.log(`⏱️ [GPT-ONLY] Duration: ${gptDuration}ms`);

    res.json({
      success: true,
      input: text,
      reply,
      metrics: {
        gpt: gptDuration,
        total: Date.now() - startTime,
      }
    });
  } catch (error: any) {
    console.error('❌ [GPT-ONLY] Error:', error.message);
    res.status(500).json({ 
      error: error.message || 'Failed to generate response',
      details: error.stack,
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

/**
 * ISOLATED TEST ENDPOINTS - For step-by-step debugging
 * These endpoints test each service independently
 */

/**
 * POST /api/test/stt
 * TEST STEP 1: Test STT (Speech-to-Text) only
 * This tests ElevenLabs STT API DIRECTLY (no fallback to Whisper)
 */
app.post('/api/test/stt', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('\n🧪 [TEST/STT] Testing STT (Speech-to-Text) ONLY with ElevenLabs...\n');
    
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No audio file provided',
        step: 'STT',
        test: 'failed'
      });
    }

    console.log(`📁 [TEST/STT] File received: ${req.file.originalname} (${req.file.size} bytes)`);
    console.log(`   Type: ${req.file.mimetype}`);
    console.log(`   Path: ${req.file.path}`);

    // Validate file size
    if (req.file.size < 500) {
      return res.status(400).json({ 
        error: 'File too small (need at least 500 bytes)',
        step: 'STT',
        test: 'failed',
        fileSize: req.file.size
      });
    }

    // Check API key
    if (!process.env.ELEVENLABS_API_KEY) {
      return res.status(500).json({
        success: false,
        step: 'STT',
        test: 'failed',
        error: 'ELEVENLABS_API_KEY not configured'
      });
    }

    console.log(`🔑 [TEST/STT] API Key found: ${process.env.ELEVENLABS_API_KEY.substring(0, 15)}...`);
    
    // Test ElevenLabs STT only
    console.log(`⏱️ [TEST/STT] Calling ElevenLabs STT API...`);
    const sttStartTime = Date.now();
    
    // Use ElevenLabs STT only
    const { transcribeAudioBuffer } = require('./services/elevenlabs-stt-only');
    const audioBuffer = fs.readFileSync(req.file.path);
    const text = await transcribeAudioBuffer(audioBuffer, req.file.mimetype || 'audio/webm');
    const sttDuration = Date.now() - sttStartTime;
    
    // Clean up uploaded file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.log(`✅ [TEST/STT] Transcription successful!`);
    console.log(`   Text: "${text}"`);
    console.log(`   Duration: ${sttDuration}ms\n`);

    res.json({
      success: true,
      step: 'STT',
      test: 'passed',
      service: 'ElevenLabs STT',
      transcription: text,
      metrics: {
        duration: sttDuration,
        fileSize: req.file.size
      }
    });
  } catch (error: any) {
    console.error('❌ [TEST/STT] Transcription failed:', error.message);
    console.error('   Error details:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      stack: error.stack
    });
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      step: 'STT',
      test: 'failed',
      service: 'ElevenLabs STT',
      error: error.message,
      status: error.response?.status,
      apiResponse: error.response?.data,
      details: error.stack
    });
  }
});

/**
 * POST /api/test/gpt
 * TEST STEP 2: Test GPT (Thinking) only
 * This tests OpenAI GPT API with text input
 */
app.post('/api/test/gpt', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ 
        error: 'text is required',
        step: 'GPT',
        test: 'failed'
      });
    }

    console.log('\n🧪 [TEST/GPT] Testing GPT (Thinking) only...\n');
    console.log(`📝 [TEST/GPT] Input text: "${text}"`);

    // Test GPT only
    console.log(`⏱️ [TEST/GPT] Calling OpenAI GPT...`);
    const gptStartTime = Date.now();
    
    const reply = await chatMinimal(text);
    const gptDuration = Date.now() - gptStartTime;
    
    console.log(`✅ [TEST/GPT] GPT response successful!`);
    console.log(`   Response: "${reply}"`);
    console.log(`   Duration: ${gptDuration}ms\n`);

    res.json({
      success: true,
      step: 'GPT',
      test: 'passed',
      input: text,
      reply: reply,
      metrics: {
        duration: gptDuration
      }
    });
  } catch (error: any) {
    console.error('❌ [TEST/GPT] GPT failed:', error.message);
    
    res.status(500).json({
      success: false,
      step: 'GPT',
      test: 'failed',
      error: error.message,
      details: error.stack
    });
  }
});

/**
 * POST /api/test/tts
 * TEST STEP 3: Test TTS (Text-to-Speech) only
 * This tests ElevenLabs TTS API with text input
 */
app.post('/api/test/tts', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ 
        error: 'text is required',
        step: 'TTS',
        test: 'failed'
      });
    }

    console.log('\n🧪 [TEST/TTS] Testing TTS (Text-to-Speech) only...\n');
    console.log(`📝 [TEST/TTS] Input text: "${text}"`);

    // Test TTS only
    console.log(`⏱️ [TEST/TTS] Calling ElevenLabs TTS...`);
    const ttsStartTime = Date.now();
    
    const result = await generateSpeech(text);
    const ttsDuration = Date.now() - ttsStartTime;
    
    console.log(`✅ [TEST/TTS] TTS generation successful!`);
    console.log(`   Audio URL: ${result.audioUrl}`);
    console.log(`   Duration: ${ttsDuration}ms\n`);

    res.json({
      success: true,
      step: 'TTS',
      test: 'passed',
      text: text,
      audioUrl: result.audioUrl,
      metrics: {
        duration: ttsDuration
      }
    });
  } catch (error: any) {
    console.error('❌ [TEST/TTS] TTS failed:', error.message);
    
    res.status(500).json({
      success: false,
      step: 'TTS',
      test: 'failed',
      error: error.message,
      details: error.stack
    });
  }
});

export default app;

