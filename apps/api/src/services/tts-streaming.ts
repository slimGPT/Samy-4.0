/**
 * ElevenLabs Streaming TTS Service
 * Streams audio chunks as they're generated, enabling immediate playback
 */

import axios from 'axios';
import { Readable } from 'stream';
import { enhanceTextWithDisfluencies } from './tts-disfluencies';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Default voice ID for SamyBear (Samy Bear 4.0 voice - child-friendly)
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'UgBBYS2sOqTuMpoF3BR0';

export interface StreamingTTSOptions {
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
  modelId?: string;
  emotion?: string;
}

export interface StreamingTTSChunk {
  audio: Buffer;
  isFinal: boolean;
  chunkIndex: number;
}

/**
 * Stream TTS audio chunks from ElevenLabs
 * Returns a readable stream of audio chunks
 */
export async function* streamSpeech(
  text: string,
  options: StreamingTTSOptions = {}
): AsyncGenerator<StreamingTTSChunk, void, unknown> {
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is not configured');
  }

  // Enhance text with natural disfluencies for SamyBear
  const enhancedText = enhanceTextWithDisfluencies(text, options.emotion);

  const voiceId = options.voiceId || DEFAULT_VOICE_ID;
  const stability = options.stability ?? 0.71;
  const similarityBoost = options.similarityBoost ?? 0.85;
  
  // Use English model by default for fastest response
  const modelId = options.modelId || 'eleven_monolingual_v1';

  console.log(`🔊 [ELEVENLABS-STREAMING-TTS] Starting streaming TTS...`);
  console.log(`   Voice ID: ${voiceId}`);
  console.log(`   Model: ${modelId} (English)`);
  console.log(`   Original text length: ${text.length} characters`);
  if (enhancedText !== text) {
    console.log(`   Enhanced text length: ${enhancedText.length} characters`);
  }

  try {
    const response = await axios.post(
      `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}/stream`,
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
        responseType: 'stream',
        timeout: 30000,
      }
    );

    let chunkIndex = 0;
    const stream = response.data as Readable;

    for await (const chunk of stream) {
      const audioBuffer = Buffer.from(chunk);
      
      if (audioBuffer.length > 0) {
        yield {
          audio: audioBuffer,
          isFinal: false,
          chunkIndex: chunkIndex++,
        };
      }
    }

    // Final chunk
    yield {
      audio: Buffer.alloc(0),
      isFinal: true,
      chunkIndex: chunkIndex,
    };

    console.log(`✅ [ELEVENLABS-STREAMING-TTS] Streaming complete (${chunkIndex} chunks)`);
  } catch (error: any) {
    console.error('❌ [ELEVENLABS-STREAMING-TTS] Error:', error.message);
    throw new Error(`Failed to stream speech: ${error.message}`);
  }
}

/**
 * Generate complete speech file (for compatibility with existing code)
 */
export async function generateSpeechStreaming(
  text: string,
  options: StreamingTTSOptions = {}
): Promise<{ audioUrl: string; audioPath: string; duration: number }> {
  const startTime = Date.now();
  const fs = require('fs');
  const path = require('path');

  // Enhance text with natural disfluencies for SamyBear
  const enhancedText = enhanceTextWithDisfluencies(text, options.emotion);

  const voiceId = options.voiceId || DEFAULT_VOICE_ID;
  const stability = options.stability ?? 0.71;
  const similarityBoost = options.similarityBoost ?? 0.85;
  const modelId = options.modelId || 'eleven_monolingual_v1';

  console.log(`🔊 [ELEVENLABS-STREAMING-TTS] Generating complete speech...`);

  try {
    const response = await axios.post(
      `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}/stream`,
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
        timeout: 30000,
      }
    );

    const duration = Date.now() - startTime;
    const audioBuffer = Buffer.from(response.data);

    // Save audio file
    const timestamp = Date.now();
    const fileName = `samybear-speech-${timestamp}.mp3`;
    const audioDir = path.join(process.cwd(), 'temp', 'audio');
    
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    const audioPath = path.join(audioDir, fileName);
    fs.writeFileSync(audioPath, audioBuffer);

    const audioUrl = `http://localhost:3001/audio/${fileName}`;

    console.log(`✅ [ELEVENLABS-STREAMING-TTS] Generated speech in ${duration}ms: ${audioUrl}`);

    return {
      audioUrl,
      audioPath,
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('❌ [ELEVENLABS-STREAMING-TTS] Error:', error.message);
    throw new Error(`Failed to generate speech: ${error.message}`);
  }
}

