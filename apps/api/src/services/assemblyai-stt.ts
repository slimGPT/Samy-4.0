/**
 * AssemblyAI Fast Speech-to-Text Service
 * Fast, low-latency STT using AssemblyAI API
 * 
 * Features:
 * - Fast transcription (typically 1-3 seconds)
 * - Direct buffer upload (no file save required)
 * - Multilingual support (maintains English as default)
 * - Free tier available
 * - Automatic fallback to Whisper
 */

import { AssemblyAI } from 'assemblyai';
import fs from 'fs';

export interface StreamingSTTResult {
  transcript: string;
  isFinal: boolean;
  confidence?: number;
  duration: number;
}

export interface StreamingSTTOptions {
  language?: string;
  model?: string;
  punctuate?: boolean;
}

// Default configuration
const DEFAULT_OPTIONS: StreamingSTTOptions = {
  language: 'en',
  model: 'best', // Use best model for accuracy
  punctuate: true,
};

/**
 * Transcribe audio buffer using AssemblyAI (no file save required)
 * This is much faster than file-based approaches
 */
export async function transcribeAudioStream(
  audioBuffer: Buffer,
  options: StreamingSTTOptions = {}
): Promise<StreamingSTTResult> {
  const startTime = Date.now();
  
  if (!process.env.ASSEMBLYAI_API_KEY) {
    throw new Error('ASSEMBLYAI_API_KEY is not configured');
  }

  const config = { ...DEFAULT_OPTIONS, ...options };
  
  console.log('🎧 [ASSEMBLYAI-STT] Starting fast transcription...');
  console.log(`   Model: ${config.model}`);
  console.log(`   Language: ${config.language}`);
  console.log(`   Audio size: ${audioBuffer.length} bytes`);

  try {
    const client = new AssemblyAI({
      apiKey: process.env.ASSEMBLYAI_API_KEY,
    });

    // Upload audio file
    const uploadStartTime = Date.now();
    const uploadUrl = await client.files.upload(audioBuffer);
    const uploadDuration = Date.now() - uploadStartTime;
    console.log(`✅ [ASSEMBLYAI-STT] File uploaded in ${uploadDuration}ms: ${uploadUrl}`);

    // Transcribe with options
    const transcribeStartTime = Date.now();
    const transcript = await client.transcripts.transcribe({
      audio: uploadUrl,
      language_code: config.language || 'en',
      punctuate: config.punctuate,
    });

    const transcribeDuration = Date.now() - transcribeStartTime;
    const totalDuration = Date.now() - startTime;

    if (transcript.status === 'error') {
      throw new Error(transcript.error || 'Transcription failed');
    }

    if (transcript.status === 'queued' || transcript.status === 'processing') {
      // Poll for completion
      console.log(`⏳ [ASSEMBLYAI-STT] Transcription ${transcript.status}, polling...`);
      let pollCount = 0;
      const maxPolls = 60; // 60 seconds max
      
      while (transcript.status !== 'completed' && transcript.status !== 'error' && pollCount < maxPolls) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        const updated = await client.transcripts.get(transcript.id);
        
        if (updated.status === 'completed') {
          transcript.text = updated.text;
          transcript.confidence = updated.confidence;
          break;
        } else if (updated.status === 'error') {
          throw new Error(updated.error || 'Transcription failed');
        }
        
        pollCount++;
      }
      
      if (transcript.status !== 'completed') {
        throw new Error('Transcription timeout');
      }
    }

    const text = transcript.text || '';
    if (!text) {
      throw new Error('Empty transcript received from AssemblyAI');
    }

    console.log(`✅ [ASSEMBLYAI-STT] Transcription complete in ${totalDuration}ms`);
    console.log(`   Upload: ${uploadDuration}ms, Transcription: ${transcribeDuration}ms`);
    console.log(`   Transcript: "${text}"`);

    return {
      transcript: text.trim(),
      isFinal: true,
      confidence: transcript.confidence,
      duration: totalDuration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('❌ [ASSEMBLYAI-STT] Transcription failed:', error.message);
    console.error(`   Duration: ${duration}ms`);
    throw new Error(`AssemblyAI transcription failed: ${error.message}`);
  }
}

/**
 * Transcribe audio file using AssemblyAI (for compatibility with existing code)
 */
export async function transcribeAudioFile(
  audioFilePath: string,
  options: StreamingSTTOptions = {}
): Promise<StreamingSTTResult> {
  if (!fs.existsSync(audioFilePath)) {
    throw new Error(`Audio file not found: ${audioFilePath}`);
  }

  const audioBuffer = fs.readFileSync(audioFilePath);
  return transcribeAudioStream(audioBuffer, options);
}

/**
 * Fast transcription with Whisper as PRIMARY (fastest, ~2-5s)
 * AssemblyAI as fallback (slower due to polling)
 */
export async function transcribeWithFastFallback(
  audioBuffer: Buffer | string,
  options: StreamingSTTOptions = {}
): Promise<StreamingSTTResult> {
  const isFilePath = typeof audioBuffer === 'string';
  const startTime = Date.now();
  
  // PRIORITY 1: Use Whisper directly with buffer (FASTEST - ~2-5 seconds)
  if (process.env.OPENAI_API_KEY) {
    try {
      console.log('🚀 [STT] Attempting Whisper (fastest, direct buffer, ~2-5s)...');
      const { transcribeAudioBuffer } = require('./whisper');
      const buffer = isFilePath ? fs.readFileSync(audioBuffer) : audioBuffer;
      const transcript = await transcribeAudioBuffer(buffer, 'audio/webm');
      const duration = Date.now() - startTime;
      
      return {
        transcript,
        isFinal: true,
        duration,
      };
    } catch (error: any) {
      console.warn(`⚠️ [STT] Whisper failed: ${error.message}`);
      console.log('🔄 [STT] Falling back to AssemblyAI...');
    }
  }

  // PRIORITY 2: Fallback to AssemblyAI (slower due to polling, ~10s)
  if (process.env.ASSEMBLYAI_API_KEY) {
    try {
      console.log('🚀 [STT] Attempting AssemblyAI (fallback, slower due to polling)...');
      const buffer = isFilePath ? fs.readFileSync(audioBuffer) : audioBuffer;
      return await transcribeAudioStream(buffer, options);
    } catch (error: any) {
      console.error(`❌ [STT] AssemblyAI fallback failed: ${error.message}`);
      throw new Error(`All STT services failed: ${error.message}`);
    }
  }

  throw new Error('No STT service configured (OPENAI_API_KEY or ASSEMBLYAI_API_KEY required)');
}


