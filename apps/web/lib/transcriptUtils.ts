/**
 * Transcript Utilities
 * 
 * Functions for cleaning transcripts, detecting language, and parsing non-verbal cues
 */

// Non-verbal tag mappings (multilingual to English)
const NON_VERBAL_TAGS: Record<string, { emoji: string; label: string }> = {
  // Polish
  'śmiech': { emoji: '😊', label: 'User is laughing' },
  'kaszel': { emoji: '🤧', label: 'User is coughing' },
  'westchnienie': { emoji: '😌', label: 'User sighed' },
  'chichot': { emoji: '😄', label: 'User is giggling' },
  'mlaskanie': { emoji: '👅', label: 'User made mouth sounds' },
  
  // English
  'laughter': { emoji: '😊', label: 'User is laughing' },
  'cough': { emoji: '🤧', label: 'User is coughing' },
  'sigh': { emoji: '😌', label: 'User sighed' },
  'gasp': { emoji: '😮', label: 'User gasped' },
  'giggle': { emoji: '😄', label: 'User is giggling' },
  'sneeze': { emoji: '🤧', label: 'User is sneezing' },
  'breath': { emoji: '💨', label: 'User breathed' },
  'hiccup': { emoji: '😅', label: 'User hiccupped' },
  'snore': { emoji: '😴', label: 'User is snoring' },
  'yawn': { emoji: '😴', label: 'User yawned' },
  'cry': { emoji: '😢', label: 'User is crying' },
  'sob': { emoji: '😭', label: 'User is sobbing' },
  'whisper': { emoji: '🤫', label: 'User is whispering' },
  'clear throat': { emoji: '👤', label: 'User cleared throat' },
  
  // Spanish
  'risa': { emoji: '😊', label: 'User is laughing' },
  'tos': { emoji: '🤧', label: 'User is coughing' },
  
  // French
  'rire': { emoji: '😊', label: 'User is laughing' },
  'toux': { emoji: '🤧', label: 'User is coughing' },
  
  // German
  'lachen': { emoji: '😊', label: 'User is laughing' },
  'husten': { emoji: '🤧', label: 'User is coughing' },
};

export interface NonVerbalCue {
  emoji: string;
  label: string;
  rawTag: string;
}

export interface TranscriptData {
  raw: string;
  cleaned: string;
  language?: string;
  nonVerbalCues: NonVerbalCue[];
  isNonEnglish?: boolean; // Flag for English-only mode warnings
}

/**
 * Clean transcript by translating non-verbal tags to English
 */
export function cleanTranscript(rawTranscript: string): string {
  let cleaned = rawTranscript;
  
  // Remove all non-verbal tags and translate to English equivalents
  // Match patterns like [śmiech], [laughter], [cough], etc.
  const tagPattern = /\[([^\]]+)\]/gi;
  
  cleaned = cleaned.replace(tagPattern, (match, tagContent) => {
    const normalized = tagContent.toLowerCase().trim();
    const mapping = NON_VERBAL_TAGS[normalized];
    
    if (mapping) {
      return mapping.label;
    }
    
    // If no mapping found, just remove the tag
    return '';
  });
  
  // Clean up multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * Extract non-verbal cues from transcript
 */
export function extractNonVerbalCues(rawTranscript: string): NonVerbalCue[] {
  const cues: NonVerbalCue[] = [];
  const tagPattern = /\[([^\]]+)\]/gi;
  const foundTags = new Set<string>(); // Avoid duplicates
  
  let match;
  while ((match = tagPattern.exec(rawTranscript)) !== null) {
    const tagContent = match[1];
    const normalized = tagContent.toLowerCase().trim();
    
    // Skip if already processed
    if (foundTags.has(normalized)) continue;
    foundTags.add(normalized);
    
    const mapping = NON_VERBAL_TAGS[normalized];
    
    if (mapping) {
      cues.push({
        emoji: mapping.emoji,
        label: mapping.label,
        rawTag: tagContent,
      });
    }
  }
  
  return cues;
}

/**
 * Validate if text is English-only (for ENGLISH_ONLY_MODE)
 */
export function validateEnglishOnly(text: string): { isEnglish: boolean; detectedLanguage?: string } {
  // Remove common punctuation and whitespace
  const cleaned = text.replace(/[.,!?;:'"\[\](){}—–\-_\s]/g, '').trim();
  
  if (!cleaned) return { isEnglish: true };
  
  // Check for non-Latin scripts
  const nonLatinPattern = /[\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;
  if (nonLatinPattern.test(cleaned)) {
    if (/[\u0900-\u097F]/.test(cleaned)) return { isEnglish: false, detectedLanguage: 'Hindi' };
    if (/[\u0400-\u04FF]/.test(cleaned)) return { isEnglish: false, detectedLanguage: 'Cyrillic' };
    if (/[\u0600-\u06FF]/.test(cleaned)) return { isEnglish: false, detectedLanguage: 'Arabic' };
    if (/[\u4E00-\u9FFF]/.test(cleaned)) return { isEnglish: false, detectedLanguage: 'Chinese' };
    return { isEnglish: false, detectedLanguage: 'Non-Latin' };
  }
  
  // Check for common non-English diacritics
  const polishChars = /[ąćęłńóśźż]/i;
  const spanishChars = /[ñáéíóú¿¡]/i;
  const frenchChars = /[àâäéèêëïîôùûüÿç]/i;
  const germanChars = /[äöüß]/i;
  
  if (polishChars.test(cleaned)) return { isEnglish: false, detectedLanguage: 'Polish' };
  if (spanishChars.test(cleaned)) return { isEnglish: false, detectedLanguage: 'Spanish' };
  if (frenchChars.test(cleaned)) return { isEnglish: false, detectedLanguage: 'French' };
  if (germanChars.test(cleaned)) return { isEnglish: false, detectedLanguage: 'German' };
  
  return { isEnglish: true };
}

/**
 * Lightweight language detection from transcript
 * 
 * This is a simple heuristic-based detector. For production, consider:
 * - Using ElevenLabs API response if it includes language info
 * - Using a lightweight language detection library
 */
export function detectLanguage(transcript: string, englishOnlyMode: boolean = false): string | undefined {
  // ENGLISH-ONLY MODE: Skip detection, always return English or undefined
  if (englishOnlyMode) {
    const validation = validateEnglishOnly(transcript);
    if (!validation.isEnglish) {
      return validation.detectedLanguage || 'Non-English';
    }
    return 'English';
  }
  
  // Original multilingual detection logic
  // Check for non-verbal tags that indicate language
  if (/\[śmiech\]|\[kaszel\]|\[westchnienie\]|\[chichot\]|\[mlaskanie\]/gi.test(transcript)) {
    return 'Polish';
  }
  
  // Check for common language patterns
  const polishChars = /[ąćęłńóśźż]/i;
  const spanishChars = /[ñáéíóú¿¡]/i;
  const frenchChars = /[àâäéèêëïîôùûüÿç]/i;
  const germanChars = /[äöüß]/i;
  
  if (polishChars.test(transcript)) {
    return 'Polish';
  } else if (spanishChars.test(transcript)) {
    return 'Spanish';
  } else if (frenchChars.test(transcript)) {
    return 'French';
  } else if (germanChars.test(transcript)) {
    return 'German';
  }
  
  // Default to English if no indicators found
  return 'English';
}

/**
 * Process transcript: clean, detect language, extract cues
 */
export function processTranscript(rawTranscript: string, englishOnlyMode: boolean = false): TranscriptData {
  const cleaned = cleanTranscript(rawTranscript);
  const language = detectLanguage(rawTranscript, englishOnlyMode);
  const nonVerbalCues = extractNonVerbalCues(rawTranscript);
  
  // ENGLISH-ONLY MODE: Validate and flag non-English
  let isNonEnglish = false;
  if (englishOnlyMode && language && language !== 'English') {
    isNonEnglish = true;
  }
  
  return {
    raw: rawTranscript,
    cleaned,
    language,
    nonVerbalCues,
    isNonEnglish, // Flag for UI warning
  };
}

