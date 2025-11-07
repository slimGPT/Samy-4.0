/**
 * Whisper Speech-to-Text Service
 * Uses OpenAI Whisper API to transcribe audio to text
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

// Lazy-load OpenAI client to ensure env vars are loaded first
let openai: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

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
    const transcription = await getOpenAIClient().audio.transcriptions.create({
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
 * Transcribe audio buffer directly (FASTEST - no file conversion overhead)
 * Whisper now supports webm directly, so we can skip conversion entirely
 */
export async function transcribeAudioBuffer(audioBuffer: Buffer, mimeType: string = 'audio/webm'): Promise<string> {
  const startTime = Date.now();
  let tempFilePath: string | null = null;
  
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    
    console.log(`🎧 [WHISPER-BUFFER] Transcribing buffer directly (${audioBuffer.length} bytes)...`);

    try {
      // Use buffer directly - convert to File via OpenAI helper for Uploadable type
      const extension = mimeType.split('/')[1] || 'webm';
      const uploadable = await OpenAI.toFile(audioBuffer, `audio-buffer.${extension}`);
      const transcription = await getOpenAIClient().audio.transcriptions.create({
        file: uploadable,
        model: 'whisper-1',
        response_format: 'text',
        language: 'en',
      }, {
        timeout: 30000, // 30 second timeout
      });

      const duration = Date.now() - startTime;
      const text = transcription as unknown as string;
      console.log(`✅ [WHISPER-BUFFER] Transcription complete in ${duration}ms: "${text}"`);
      return text;
    } catch (streamError: any) {
      // If stream approach fails, fallback to temp file (minimal overhead)
      if (streamError.message?.includes('file') || streamError.message?.includes('format')) {
        console.log('🔄 [WHISPER-BUFFER] Stream approach failed, using minimal temp file fallback...');
        
        // Create minimal temp file (only if stream fails)
        const tempDir = path.join(process.cwd(), 'temp', 'uploads');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        tempFilePath = path.join(tempDir, `whisper-temp-${Date.now()}.webm`);
        fs.writeFileSync(tempFilePath, audioBuffer);
        
        const audioFile = fs.createReadStream(tempFilePath);
        const transcription = await getOpenAIClient().audio.transcriptions.create({
          file: audioFile,
          model: 'whisper-1',
          response_format: 'text',
          language: 'en',
        }, {
          timeout: 30000,
        });

        // Clean up temp file immediately
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          tempFilePath = null;
        }

        const duration = Date.now() - startTime;
        const text = transcription as unknown as string;
        console.log(`✅ [WHISPER-BUFFER] Transcription complete in ${duration}ms (via temp file): "${text}"`);
        return text;
      }
      
      // Re-throw if it's not a file/format error
      throw streamError;
    }
  } catch (error: any) {
    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    
    const duration = Date.now() - startTime;
    console.error('❌ [WHISPER-BUFFER] Transcription error:', error.message);
    console.error(`   Duration: ${duration}ms`);
    throw new Error(`Whisper buffer transcription failed: ${error.message}`);
  }
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

    // Retry logic for connection errors (3 attempts with exponential backoff)
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // ms
    
    const attemptTranscription = async (model: string, retryCount: number = 0): Promise<any> => {
      try {
        const audioStream = fs.createReadStream(fileToTranscribe);
        return await getOpenAIClient().audio.transcriptions.create({
          file: audioStream,
          model: model,
          response_format: 'text',
          language: 'en',
        }, {
          timeout: 60000, // 60 second timeout for large audio files
        });
      } catch (error: any) {
        const isConnectionError = error.code === 'ECONNRESET' || 
                                  error.message?.includes('Connection error') ||
                                  error.message?.includes('ECONNRESET');
        
        if (isConnectionError && retryCount < MAX_RETRIES) {
          const backoffDelay = RETRY_DELAY * Math.pow(2, retryCount); // Exponential backoff
          console.log(`⚠️ Connection error, retrying (${retryCount + 1}/${MAX_RETRIES}) after ${backoffDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          return attemptTranscription(model, retryCount + 1);
        }
        
        throw error;
      }
    };

    // Try whisper-1 (primary model)
    let transcription: any;
    try {
      console.log('🎙️ Attempting transcription with whisper-1...');
      transcription = await attemptTranscription('whisper-1');
      console.log('✅ Transcription successful with whisper-1');
    } catch (error: any) {
      console.error('❌ Whisper-1 transcription failed');
      throw error;
    }

    // Clean up converted file
    if (convertedPath && fs.existsSync(convertedPath)) {
      fs.unlinkSync(convertedPath);
      console.log('🧹 Cleaned up converted MP3 file');
    }

    console.log(`✅ Transcription: "${transcription}"`);

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
    
    // Re-throw with clear error message
    const enhancedError: any = new Error(`Whisper transcription failed: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.details = error.response?.data || error;
    throw enhancedError;
  }
}

