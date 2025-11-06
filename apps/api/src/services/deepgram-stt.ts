/**
 * Deepgram Fast Speech-to-Text Service
 * Fast, low-latency STT using Deepgram REST API
 * 
 * Features:
 * - Fast transcription (sub-500ms latency with Nova-2/Nova-3)
 * - Direct buffer upload (no file save required)
 * - Multilingual support (maintains English as default)
 * - Automatic fallback to Whisper
 */

import { createClient } from '@deepgram/sdk';
import axios from 'axios';
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
  model: 'nova-2', // Fast, accurate model (nova-3 available for even faster)
  punctuate: true,
};

/**
 * Transcribe audio buffer using Deepgram REST API (no file save required)
 * This is much faster than file-based approaches
 */
export async function transcribeAudioStream(
  audioBuffer: Buffer,
  options: StreamingSTTOptions = {}
): Promise<StreamingSTTResult> {
  const startTime = Date.now();
  
  if (!process.env.DEEPGRAM_API_KEY) {
    throw new Error('DEEPGRAM_API_KEY is not configured');
  }

  const config = { ...DEFAULT_OPTIONS, ...options };
  
  console.log('🎧 [DEEPGRAM-STT] Starting fast transcription...');
  console.log(`   Model: ${config.model}`);
  console.log(`   Language: ${config.language}`);
  console.log(`   Audio size: ${audioBuffer.length} bytes`);

  try {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    
    // Use the REST API for file transcription (fastest approach)
    const response = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: config.model,
        language: config.language,
        punctuate: config.punctuate,
      }
    );

    const duration = Date.now() - startTime;
    
    // Extract transcript from response
    const result = response.result;
    const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = result?.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;

    if (!transcript) {
      throw new Error('No transcript received from Deepgram');
    }

    console.log(`✅ [DEEPGRAM-STT] Transcription complete in ${duration}ms`);
    console.log(`   Transcript: "${transcript}"`);

    return {
      transcript: transcript.trim(),
      isFinal: true,
      confidence,
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('❌ [DEEPGRAM-STT] Transcription failed:', error.message);
    console.error(`   Duration: ${duration}ms`);
    throw new Error(`Deepgram transcription failed: ${error.message}`);
  }
}

/**
 * Transcribe audio file using Deepgram (for compatibility with existing code)
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
 * Fast transcription with automatic fallback to Whisper if Deepgram fails
 */
export async function transcribeWithFastFallback(
  audioBuffer: Buffer | string,
  options: StreamingSTTOptions = {}
): Promise<StreamingSTTResult> {
  const isFilePath = typeof audioBuffer === 'string';
  const startTime = Date.now();
  
  // Try Deepgram first (fastest)
  if (process.env.DEEPGRAM_API_KEY) {
    try {
      console.log('🚀 [STT] Attempting Deepgram (fastest)...');
      const buffer = isFilePath ? fs.readFileSync(audioBuffer) : audioBuffer;
      return await transcribeAudioStream(buffer, options);
    } catch (error: any) {
      console.warn(`⚠️ [STT] Deepgram failed: ${error.message}`);
      console.log('🔄 [STT] Falling back to Whisper...');
    }
  }

  // Fallback to Whisper
  if (process.env.OPENAI_API_KEY) {
    try {
      const { transcribeAudioSimple } = require('./whisper');
      if (!isFilePath) {
        throw new Error('Whisper requires file path, not buffer');
      }
      const transcript = await transcribeAudioSimple(audioBuffer);
      const duration = Date.now() - startTime;
      
      return {
        transcript,
        isFinal: true,
        duration,
      };
    } catch (error: any) {
      console.error(`❌ [STT] Whisper fallback failed: ${error.message}`);
      throw new Error(`All STT services failed: ${error.message}`);
    }
  }

  throw new Error('No STT service configured (DEEPGRAM_API_KEY or OPENAI_API_KEY required)');
}

