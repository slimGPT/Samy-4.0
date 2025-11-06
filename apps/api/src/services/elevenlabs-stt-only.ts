/**
 * ElevenLabs Speech-to-Text Service (STT)
 * PRIMARY: ElevenLabs STT API only
 * 
 * This is the ONLY STT service - no fallbacks to Whisper, Deepgram, or AssemblyAI
 */

import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

export interface STTResult {
  transcript: string;
  duration: number;
}

/**
 * Transcribe audio file using ElevenLabs STT API
 * @param audioFilePath - Path to the audio file
 * @returns Transcribed text
 */
export async function transcribeAudioFile(audioFilePath: string): Promise<string> {
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    console.log(`🎧 [ELEVENLABS-STT] Transcribing audio file: ${audioFilePath}`);
    
    const startTime = Date.now();
    
    // Read audio file
    const audioBuffer = fs.readFileSync(audioFilePath);
    console.log(`   File size: ${audioBuffer.length} bytes`);

    // Create FormData for multipart/form-data upload
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    formData.append('model_id', process.env.ELEVENLABS_STT_MODEL_ID || 'scribe_v1');

    // Call ElevenLabs STT API
    const response = await axios.post(
      `${ELEVENLABS_API_URL}/speech-to-text`,
      formData,
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          ...formData.getHeaders(),
        },
        timeout: 30000,
      }
    );

    const duration = Date.now() - startTime;
    const transcript = response.data?.text || response.data?.transcript || '';
    
    if (!transcript || transcript.trim() === '') {
      throw new Error('Empty transcript received from ElevenLabs STT');
    }

    console.log(`✅ [ELEVENLABS-STT] Transcription complete in ${duration}ms: "${transcript}"`);
    return transcript.trim();
  } catch (error: any) {
    console.error('❌ [ELEVENLABS-STT] Transcription failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    throw new Error(`ElevenLabs STT failed: ${error.message}`);
  }
}

/**
 * Transcribe audio buffer using ElevenLabs STT API
 * @param audioBuffer - Audio buffer data
 * @param mimeType - MIME type of the audio (e.g., 'audio/webm', 'audio/mp3')
 * @returns Transcribed text
 */
export async function transcribeAudioBuffer(audioBuffer: Buffer, mimeType: string = 'audio/webm'): Promise<string> {
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    console.log(`🎧 [ELEVENLABS-STT] Transcribing audio buffer (${audioBuffer.length} bytes, ${mimeType})...`);
    
    const startTime = Date.now();

    // Create FormData for multipart/form-data upload
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: `recording.${mimeType.split('/')[1] || 'webm'}`,
      contentType: mimeType,
    });
    formData.append('model_id', process.env.ELEVENLABS_STT_MODEL_ID || 'scribe_v1');
    if (process.env.NEXT_PUBLIC_ENGLISH_ONLY_MODE === 'true' || process.env.ENGLISH_ONLY_MODE === 'true') {
      formData.append('language', 'en');
    }

    // Call ElevenLabs STT API
    const response = await axios.post(
      `${ELEVENLABS_API_URL}/speech-to-text`,
      formData,
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          ...formData.getHeaders(),
        },
        timeout: 30000,
      }
    );

    const duration = Date.now() - startTime;
    const transcript = response.data?.text || response.data?.transcript || '';
    
    if (!transcript || transcript.trim() === '') {
      throw new Error('Empty transcript received from ElevenLabs STT');
    }

    console.log(`✅ [ELEVENLABS-STT] Transcription complete in ${duration}ms: "${transcript}"`);
    return transcript.trim();
  } catch (error: any) {
    console.error('❌ [ELEVENLABS-STT] Transcription failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    throw new Error(`ElevenLabs STT failed: ${error.message}`);
  }
}

/**
 * Main transcription function - ElevenLabs STT only
 * @param audioInput - Audio file path or buffer
 * @param options - Optional STT options
 * @returns STT result with transcript and duration
 */
export async function transcribe(audioInput: string | Buffer, options: { mimeType?: string } = {}): Promise<STTResult> {
  const startTime = Date.now();
  
  let transcript: string;
  
  if (typeof audioInput === 'string') {
    // File path
    transcript = await transcribeAudioFile(audioInput);
  } else {
    // Buffer
    transcript = await transcribeAudioBuffer(audioInput, options.mimeType || 'audio/webm');
  }
  
  const duration = Date.now() - startTime;
  
  return {
    transcript,
    duration,
  };
}

