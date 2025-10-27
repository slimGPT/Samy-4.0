/**
 * Whisper Speech-to-Text Service
 * Uses OpenAI Whisper API to transcribe audio to text
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
}

/**
 * Transcribe audio file to text using Whisper API
 * @param audioFilePath - Path to the audio file (mp3, wav, m4a, etc.)
 * @returns Transcription result with text
 */
export async function transcribeAudio(audioFilePath: string): Promise<TranscriptionResult> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Create a read stream from the file
    const audioFile = fs.createReadStream(audioFilePath);

    // Call Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en', // Can be changed to auto-detect or specific language
      response_format: 'verbose_json',
    });

    return {
      text: transcription.text,
      language: transcription.language,
      duration: transcription.duration,
    };
  } catch (error: any) {
    console.error('❌ Whisper transcription error:', error.message);
    throw new Error(`Failed to transcribe audio: ${error.message}`);
  }
}

/**
 * Convert audio file to MP3 format for better OpenAI compatibility
 */
async function convertToMp3(inputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const outputPath = inputPath + '.mp3';
    
    ffmpeg(inputPath)
      .toFormat('mp3')
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .on('end', () => {
        console.log('✅ Audio converted to MP3');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('❌ FFmpeg conversion error:', err);
        reject(new Error(`Failed to convert audio: ${err.message}`));
      })
      .save(outputPath);
  });
}

/**
 * Transcribe audio with simple text response (faster)
 */
export async function transcribeAudioSimple(audioFilePath: string): Promise<string> {
  let convertedPath: string | null = null;
  
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    console.log(`🎧 Transcribing file: ${audioFilePath}`);
    
    // Check if file exists
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found: ${audioFilePath}`);
    }

    // Convert webm files to mp3 for better compatibility
    const ext = path.extname(audioFilePath).toLowerCase();
    let fileToTranscribe = audioFilePath;
    
    if (ext === '.webm' || ext === '') {
      console.log('🔄 Converting webm to mp3 for better OpenAI compatibility...');
      convertedPath = await convertToMp3(audioFilePath);
      fileToTranscribe = convertedPath;
    }

    const audioFile = fs.createReadStream(fileToTranscribe);

    // Try gpt-4o-mini-transcribe first, fallback to whisper-1
    let transcription: any;
    try {
      console.log('Attempting transcription with gpt-4o-mini-transcribe...');
      transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'gpt-4o-mini-transcribe',
        response_format: 'text',
        language: 'en',
      });
      console.log('✅ Used gpt-4o-mini-transcribe');
    } catch (primaryError: any) {
      console.log('⚠️ gpt-4o-mini-transcribe failed, falling back to whisper-1');
      console.log('Primary error:', primaryError.message);
      
      // Recreate the file stream since it was consumed
      const audioFileFallback = fs.createReadStream(fileToTranscribe);
      transcription = await openai.audio.transcriptions.create({
        file: audioFileFallback,
        model: 'whisper-1',
        response_format: 'text',
        language: 'en',
      });
      console.log('✅ Used whisper-1 fallback');
    }

    // Clean up converted file
    if (convertedPath && fs.existsSync(convertedPath)) {
      fs.unlinkSync(convertedPath);
      console.log('🧹 Cleaned up converted MP3 file');
    }

    console.log(`✅ Transcription successful: "${transcription}"`);

    return transcription as unknown as string;
  } catch (error: any) {
    // Clean up converted file on error
    if (convertedPath && fs.existsSync(convertedPath)) {
      fs.unlinkSync(convertedPath);
    }
    
    console.error('❌ Whisper transcription error:', error);
    console.error('Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      type: error.type,
      code: error.code,
    });
    
    // Re-throw with the full error object for better debugging
    const enhancedError: any = new Error(`Failed to transcribe audio: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.details = error.response?.data || error;
    throw enhancedError;
  }
}

