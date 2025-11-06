/**
 * Robust Speech-to-Text Service with Auto-Fallback
 * PRIMARY: OpenAI Whisper (Most Reliable)
 * FALLBACK: ElevenLabs STT API
 * 
 * This ensures STT never fails completely - if one service is down, we use the other.
 */

import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import OpenAI from 'openai';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Strategy: Try Whisper first (more reliable), fallback to ElevenLabs
const USE_WHISPER_FIRST = true;

// Lazy-load OpenAI client
let openai: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai!;
}

/**
 * PRIMARY: Transcribe using OpenAI Whisper (Most Reliable)
 */
async function transcribeWithWhisper(audioFilePath: string): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('🎧 Transcribing with OpenAI Whisper (PRIMARY)...');
    const audioStream = fs.createReadStream(audioFilePath);
    const response = await getOpenAIClient().audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1',
      response_format: 'text',
      language: 'en',
    });

    const text = response as unknown as string;
    console.log(`✅ Whisper transcription: "${text}"`);
    return text;
  } catch (error: any) {
    console.error('❌ Whisper transcription failed:', error.message);
    throw error;
  }
}

/**
 * Validate if transcript is English-only
 * Simple heuristic: check for non-Latin scripts or common non-English characters
 */
function validateEnglishOnly(transcript: string): boolean {
  // Remove common punctuation and whitespace
  const cleaned = transcript.replace(/[.,!?;:'"\[\](){}—–\-_\s]/g, '').trim();
  
  if (!cleaned) return true; // Empty or only punctuation
  
  // Check for non-Latin scripts (Cyrillic, Arabic, Devanagari, Chinese, etc.)
  // These Unicode ranges cover most non-Latin scripts
  const nonLatinPattern = /[\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;
  if (nonLatinPattern.test(cleaned)) {
    console.error('❌ [ENGLISH_ONLY] Non-Latin script detected');
    return false;
  }
  
  // Check for common non-English characters (Polish, Spanish, French, German diacritics)
  // But allow common English contractions and possessives
  const diacriticsPattern = /[ąćęłńóśźżñáéíóúàâäéèêëïîôùûüÿçäöüß]/i;
  if (diacriticsPattern.test(cleaned)) {
    // Check if it's actually non-English (not just an English word with similar chars)
    const nonEnglishChars = cleaned.match(/[ąćęłńóśźżñáéíóúàâäéèêëïîôùûüÿçäöüß]/gi);
    if (nonEnglishChars && nonEnglishChars.length > cleaned.length * 0.1) {
      // More than 10% of characters are non-English diacritics
      console.error('❌ [ENGLISH_ONLY] Non-English diacritics detected:', nonEnglishChars.length);
      return false;
    }
  }
  
  return true;
}

/**
 * FALLBACK: Transcribe audio file to text using ElevenLabs STT API
 * @param audioFilePath - Path to the audio file
 * @returns Transcribed text
 */
export async function transcribeWithElevenLabs(audioFilePath: string): Promise<string> {
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not configured');
    }

    console.log(`🎧 Transcribing with ElevenLabs STT: ${audioFilePath}`);

    // Check if file exists
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found: ${audioFilePath}`);
    }

    // Check file size
    const stats = fs.statSync(audioFilePath);
    if (stats.size === 0) {
      throw new Error('Audio file is empty');
    }

    // Create form data with the audio file
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    // Use scribe_v1_experimental (verified working in test)
    formData.append('model_id', 'scribe_v1_experimental');
    
    // English-only mode: force English language if API supports it
    const ENGLISH_ONLY_MODE = process.env.ENGLISH_ONLY_MODE === 'true';
    if (ENGLISH_ONLY_MODE) {
      // ElevenLabs STT doesn't support language parameter, so we'll validate post-transcription
      console.log('🇬🇧 [ENGLISH_ONLY] Mode enabled - will validate English-only after transcription');
    }

    // Debug logging
    console.log('📤 [ELEVENLABS-STT] Preparing request...');
    console.log('   API URL:', `${ELEVENLABS_API_URL}/speech-to-text`);
    console.log('   Model ID: scribe_v1_experimental');
    console.log('   File size:', stats.size, 'bytes');
    console.log('   File path:', audioFilePath);
    console.log('   API Key:', process.env.ELEVENLABS_API_KEY ? `${process.env.ELEVENLABS_API_KEY.substring(0, 15)}...` : 'NOT FOUND');
    console.log('   Full API Key length:', process.env.ELEVENLABS_API_KEY?.length || 0);

    // Call ElevenLabs STT API with better error handling
    console.log('🌐 [ELEVENLABS-STT] Calling ElevenLabs Speech-to-Text API...');
    let response;
    try {
      response = await axios.post(
        `${ELEVENLABS_API_URL}/speech-to-text`,
        formData,
        {
          headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY!,
            ...formData.getHeaders(),
          },
          timeout: 30000, // 30 second timeout
          validateStatus: (status) => status < 500, // Don't throw on 4xx errors
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );

      console.log('📥 [ELEVENLABS-STT] Response received:', {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        dataKeys: Object.keys(response.data || {}),
        dataType: typeof response.data,
        fullData: JSON.stringify(response.data, null, 2)
      });
    } catch (axiosError: any) {
      console.error('❌ [ELEVENLABS-STT] Axios error occurred:');
      console.error('   Error message:', axiosError.message);
      console.error('   Error code:', axiosError.code);
      console.error('   Response status:', axiosError.response?.status);
      console.error('   Response data:', axiosError.response?.data);
      console.error('   Response headers:', axiosError.response?.headers);
      throw axiosError;
    }

    // Handle non-2xx responses
    if (response.status !== 200) {
      const errorMsg = response.data?.detail || response.data?.message || JSON.stringify(response.data);
      console.error(`❌ ElevenLabs STT returned ${response.status}:`, errorMsg);
      throw new Error(`ElevenLabs returned ${response.status}: ${errorMsg}`);
    }

    // Extract text from response - check multiple possible response formats
    let transcription = '';
    
    // Try different response formats
    if (typeof response.data === 'string') {
      // Response might be plain text
      transcription = response.data.trim();
    } else if (response.data?.text) {
      transcription = response.data.text;
    } else if (response.data?.transcript) {
      transcription = response.data.transcript;
    } else if (response.data?.transcription) {
      transcription = response.data.transcription;
    } else {
      // Log the entire response to see what we got
      console.error('❌ [ELEVENLABS-STT] Unexpected response format:', JSON.stringify(response.data, null, 2));
      throw new Error(`Unexpected response format from ElevenLabs: ${JSON.stringify(response.data)}`);
    }
    
    if (!transcription || transcription.trim() === '') {
      console.error('❌ [ELEVENLABS-STT] Empty transcription received. Full response:', JSON.stringify(response.data, null, 2));
      throw new Error('Empty transcription from ElevenLabs');
    }

    console.log(`✅ ElevenLabs STT transcription: "${transcription}"`);
    
    // ENGLISH-ONLY MODE: Validate transcript is English
    if (ENGLISH_ONLY_MODE) {
      const isEnglish = validateEnglishOnly(transcription);
      if (!isEnglish) {
        console.error('❌ [ENGLISH_ONLY] Non-English transcript detected');
        console.error('   Transcript:', transcription);
        throw new Error('ENGLISH_ONLY_MODE: Only English is supported. Please speak in English.');
      }
      console.log('🇬🇧 [ENGLISH_ONLY] Transcript validated as English');
    }
    
    return transcription.trim();

  } catch (error: any) {
    console.error('❌ ElevenLabs STT error:', error.response?.data || error.message);
    
    // Provide helpful error messages
    if (error.response?.status === 401) {
      throw new Error('ElevenLabs API key is invalid or expired. Please update your API key.');
    } else if (error.response?.status === 403) {
      throw new Error('ElevenLabs API access denied. Check your subscription.');
    } else if (error.response?.status === 429) {
      throw new Error('ElevenLabs rate limit exceeded. Please wait and try again.');
    } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      throw new Error('Speech-to-text request timed out. Please try again.');
    }
    
    throw new Error(`Speech-to-text failed: ${error.message}`);
  }
}

/**
 * MAIN EXPORT: Smart transcription with automatic fallback
 * Tries Whisper first (more reliable), then ElevenLabs as backup
 * COMPREHENSIVE ERROR TRACING ENABLED
 */
export async function transcribeAudioWithRetry(audioFilePath: string): Promise<string> {
  console.log('\n' + '='.repeat(50));
  console.log('🎤 [STT SERVICE] Starting transcription');
  console.log('   File:', audioFilePath);
  
  // Validate file exists
  if (!fs.existsSync(audioFilePath)) {
    console.error('❌ [STT] File does not exist:', audioFilePath);
    throw new Error(`Audio file not found: ${audioFilePath}`);
  }

  const stats = fs.statSync(audioFilePath);
  console.log('   File size:', stats.size, 'bytes');
  
  if (stats.size === 0) {
    console.error('❌ [STT] File is empty (0 bytes)');
    throw new Error('Audio file is empty');
  }
  
  if (stats.size < 500) {
    console.error('❌ [STT] File too small:', stats.size, 'bytes (minimum 500)');
    throw new Error('Recording too short or corrupt - please speak for at least 2 seconds');
  }

  const errors: string[] = [];

  // Check API keys
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasElevenLabs = !!process.env.ELEVENLABS_API_KEY;
  
  console.log('   Available services:');
  console.log('   - OpenAI Whisper:', hasOpenAI ? '✅ Ready' : '❌ No API key');
  console.log('   - ElevenLabs STT:', hasElevenLabs ? '✅ Ready' : '❌ No API key');

  if (!hasOpenAI && !hasElevenLabs) {
    console.error('❌ [STT] CRITICAL: No API keys configured!');
    throw new Error('No STT service configured. Please add OPENAI_API_KEY or ELEVENLABS_API_KEY to your .env file');
  }

  // STRATEGY 1: Try Whisper first (most reliable)
  if (hasOpenAI) {
    try {
      console.log('\n📍 [STT] Strategy 1: Using OpenAI Whisper (PRIMARY)');
      console.log('   Calling Whisper API...');
      const result = await transcribeWithWhisper(audioFilePath);
      console.log('✅ [STT] Transcription successful via Whisper');
      console.log('   Result length:', result.length, 'characters');
      console.log('='.repeat(50) + '\n');
      return result;
    } catch (error: any) {
      const errMsg = `Whisper failed: ${error.message}`;
      console.error('❌ [STT] Whisper service failed');
      console.error('   Error:', error.message);
      console.error('   Type:', error.name);
      if (error.response) {
        console.error('   API Response status:', error.response.status);
        console.error('   API Response data:', JSON.stringify(error.response.data));
      }
      console.warn(`⚠️ ${errMsg}`);
      errors.push(errMsg);
    }
  }

  // STRATEGY 2: Fallback to ElevenLabs
  if (hasElevenLabs) {
    try {
      console.log('\n📍 [STT] Strategy 2: Falling back to ElevenLabs STT');
      console.log('   Calling ElevenLabs API...');
      const result = await transcribeWithElevenLabs(audioFilePath);
      console.log('✅ [STT] Transcription successful via ElevenLabs (fallback)');
      console.log('   Result length:', result.length, 'characters');
      console.log('='.repeat(50) + '\n');
      return result;
    } catch (error: any) {
      const errMsg = `ElevenLabs failed: ${error.message}`;
      console.error('❌ [STT] ElevenLabs service failed');
      console.error('   Error:', error.message);
      console.error('   Type:', error.name);
      if (error.response) {
        console.error('   API Response status:', error.response.status);
        console.error('   API Response data:', JSON.stringify(error.response.data));
      }
      console.warn(`⚠️ ${errMsg}`);
      errors.push(errMsg);
    }
  }

  // Both services failed
  console.error('\n' + '!'.repeat(50));
  console.error('❌ [STT] ALL TRANSCRIPTION SERVICES FAILED');
  console.error('   Attempted services:', errors.length);
  console.error('   Errors:');
  errors.forEach((err, i) => {
    console.error(`     ${i + 1}. ${err}`);
  });
  console.error('!'.repeat(50) + '\n');
  
  throw new Error(`All STT services failed. Errors: ${errors.join('; ')}`);
}

/**
 * Export alternative name for compatibility
 */
export async function transcribeAudioElevenLabs(audioFilePath: string): Promise<string> {
  return transcribeAudioWithRetry(audioFilePath);
}

