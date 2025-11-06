/**
 * ElevenLabs Text-to-Speech Service
 * Converts text to speech using ElevenLabs API
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { enhanceTextWithDisfluencies } from './tts-disfluencies';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Default voice ID for SamyBear (child-friendly voice)
// Using Samy Bear 4.0 voice - warm, gentle, expressive voice suitable for children (ages 5-10)
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'UgBBYS2sOqTuMpoF3BR0';

export interface TTSOptions {
  voiceId?: string;
  stability?: number; // 0-1, controls voice consistency
  similarityBoost?: number; // 0-1, controls voice clarity
  modelId?: string;
}

export interface TTSResult {
  audioUrl: string;
  audioPath: string;
  duration?: number;
}

/**
 * Generate speech from text using ElevenLabs API
 * @param text - Text to convert to speech
 * @param options - TTS configuration options
 * @returns Audio file path and URL
 */
export async function generateSpeech(
  text: string,
  options: TTSOptions & { emotion?: string } = {}
): Promise<TTSResult> {
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    // Enhance text with natural disfluencies for SamyBear
    const enhancedText = enhanceTextWithDisfluencies(text, options.emotion);
    
    const voiceId = options.voiceId || DEFAULT_VOICE_ID;
    const stability = options.stability ?? 0.71; // Higher for more consistent voice
    const similarityBoost = options.similarityBoost ?? 0.85; // Higher for more expressive
    
    // ENGLISH-ONLY MODE: Use English-only TTS model
    const ENGLISH_ONLY_MODE = process.env.ENGLISH_ONLY_MODE === 'true';
    const modelId = ENGLISH_ONLY_MODE 
      ? (options.modelId || 'eleven_monolingual_v1') // English-only model
      : (options.modelId || 'eleven_multilingual_v2'); // Multilingual model

    console.log(`🔊 Generating speech with ElevenLabs...`);
    console.log(`   Voice ID: ${voiceId} (Samy Bear 4.0)`);
    console.log(`   Model: ${modelId}${ENGLISH_ONLY_MODE ? ' (ENGLISH-ONLY MODE)' : ' (MULTILINGUAL)'}`);
    console.log(`   Stability: ${stability}`);
    console.log(`   Similarity Boost: ${similarityBoost}`);
    console.log(`   Original text: "${text.substring(0, 50)}..."`);
    if (enhancedText !== text) {
      console.log(`   Enhanced text: "${enhancedText.substring(0, 50)}..."`);
    }

    // Call ElevenLabs API
    const response = await axios.post(
      `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
      {
        text: enhancedText,
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
        },
      },
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
        timeout: 30000, // 30 second timeout
      }
    );

    console.log(`✅ ElevenLabs response received (${response.data.byteLength} bytes)`);

    // Save audio file
    const timestamp = Date.now();
    const fileName = `candy-speech-${timestamp}.mp3`;
    const audioDir = path.join(process.cwd(), 'temp', 'audio');
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    const audioPath = path.join(audioDir, fileName);
    fs.writeFileSync(audioPath, response.data);

    // In production, you'd upload this to Firebase Storage or a CDN
    // For now, we'll serve it from the API server
    const audioUrl = `http://localhost:3001/audio/${fileName}`;

    console.log('✅ Generated speech:', audioUrl);

    return {
      audioUrl,
      audioPath,
    };
  } catch (error: any) {
    console.error('❌ ElevenLabs TTS error:', error.response?.data || error.message);
    throw new Error(`Failed to generate speech: ${error.message}`);
  }
}

/**
 * Get available voices from ElevenLabs
 */
export async function getAvailableVoices(): Promise<any[]> {
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    const response = await axios.get(`${ELEVENLABS_API_URL}/voices`, {
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
      },
    });

    return response.data.voices;
  } catch (error: any) {
    console.error('❌ Failed to fetch voices:', error.message);
    throw new Error(`Failed to fetch voices: ${error.message}`);
  }
}

/**
 * Clean up old audio files (optional utility)
 */
export function cleanupOldAudioFiles(olderThanMs: number = 3600000): void {
  const audioDir = path.join(process.cwd(), 'temp', 'audio');
  
  if (!fs.existsSync(audioDir)) return;

  const files = fs.readdirSync(audioDir);
  const now = Date.now();

  files.forEach((file) => {
    const filePath = path.join(audioDir, file);
    const stats = fs.statSync(filePath);
    const fileAge = now - stats.mtimeMs;

    if (fileAge > olderThanMs) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Cleaned up old audio file: ${file}`);
    }
  });
}

