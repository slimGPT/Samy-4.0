/**
 * ElevenLabs Speech-to-Text Service
 * Uses ElevenLabs STT API to transcribe audio to text
 */

import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

/**
 * Transcribe audio file to text using ElevenLabs STT API
 * @param audioFilePath - Path to the audio file
 * @returns Transcribed text
 */
export async function transcribeAudioElevenLabs(audioFilePath: string): Promise<string> {
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    console.log(`🎧 Transcribing with ElevenLabs STT: ${audioFilePath}`);

    // Check if file exists
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found: ${audioFilePath}`);
    }

    // Create form data with the audio file
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    formData.append('model_id', 'scribe_v1'); // STT model (not TTS model!)

    // Call ElevenLabs STT API
    console.log('🌐 Calling ElevenLabs Speech-to-Text API...');
    const response = await axios.post(
      `${ELEVENLABS_API_URL}/speech-to-text`,
      formData,
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          ...formData.getHeaders(),
        },
        timeout: 60000, // 60 second timeout
      }
    );

    // Extract text from response
    const transcription = response.data.text || response.data.transcript || '';
    
    if (!transcription || transcription.trim() === '') {
      throw new Error('Empty transcription received from ElevenLabs');
    }

    console.log(`✅ ElevenLabs STT transcription: "${transcription}"`);
    return transcription;

  } catch (error: any) {
    console.error('❌ ElevenLabs STT error:', error.response?.data || error.message);
    
    // Provide helpful error messages
    if (error.response?.status === 401) {
      throw new Error('ElevenLabs API key is invalid or expired');
    } else if (error.response?.status === 403) {
      throw new Error('ElevenLabs API key does not have STT access enabled');
    } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      throw new Error('ElevenLabs STT request timed out');
    }
    
    throw new Error(`ElevenLabs STT failed: ${error.message}`);
  }
}

/**
 * Transcribe audio with retry logic
 */
export async function transcribeAudioWithRetry(audioFilePath: string, maxRetries: number = 2): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`🔄 Retry attempt ${attempt}/${maxRetries}...`);
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }

      return await transcribeAudioElevenLabs(audioFilePath);
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Attempt ${attempt + 1} failed: ${error.message}`);
      
      // Don't retry on auth errors
      if (error.message.includes('invalid') || error.message.includes('403')) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Transcription failed after all retries');
}

