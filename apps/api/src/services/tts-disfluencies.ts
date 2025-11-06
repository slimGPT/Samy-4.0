/**
 * Natural Speech Disfluencies for SamyBear TTS
 * Adds natural pauses, thinking sounds, and playful expressions
 */

/**
 * Inject natural speech disfluencies into text for more natural TTS
 * Adds: "hmm...", "weeeell...", "ooooh!", laughter, and thoughtful pauses
 */
export function addNaturalDisfluencies(text: string, emotion?: string): string {
  // Don't add disfluencies to very short text
  if (text.length < 20) {
    return text;
  }

  // Split text into sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  // Determine disfluency style based on emotion
  const disfluencyMap: Record<string, string[]> = {
    curious: ['hmm...', 'weeeell...', 'ooooh!', 'huh...'],
    happy: ['hehe!', 'haha!', 'heehee!', 'yay!'],
    excited: ['wow!', 'ooooh!', 'yay!', 'whoa!'],
    calm: ['hmm...', 'well...', 'ah...'],
    sleepy: ['hmm...', 'zzz...', 'ah...'],
    confused: ['hmm?', 'um...', 'well...', 'huh?'],
    empathetic: ['oh...', 'hmm...', 'aw...'],
    sad: ['oh...', 'hmm...', 'aw...'],
  };

  const disfluencies = disfluencyMap[emotion || 'curious'] || ['hmm...', 'well...'];
  
  // Add disfluencies randomly to some sentences (30% chance)
  const modifiedSentences = sentences.map((sentence, index) => {
    // Don't add disfluencies to the first or last sentence often
    if (index === 0 && Math.random() > 0.2) {
      return sentence;
    }
    if (index === sentences.length - 1 && Math.random() > 0.2) {
      return sentence;
    }
    
    // 30% chance to add a disfluency before the sentence
    if (Math.random() < 0.3) {
      const disfluency = disfluencies[Math.floor(Math.random() * disfluencies.length)];
      return `${disfluency} ${sentence.trim()}`;
    }
    
    return sentence;
  });

  return modifiedSentences.join(' ');
}

/**
 * Add natural pauses and breathing sounds
 */
export function addNaturalPauses(text: string): string {
  // Add pauses after commas and conjunctions sometimes
  return text
    .replace(/,/g, (match, offset) => {
      // 20% chance to add a pause after comma
      if (Math.random() < 0.2) {
        return ',...';
      }
      return match;
    })
    .replace(/\sand\s/gi, (match) => {
      // 10% chance to add a pause before "and"
      if (Math.random() < 0.1) {
        return '... and ';
      }
      return match;
    });
}

/**
 * Add laughter or giggles based on emotion
 */
export function addLaughter(text: string, emotion?: string): string {
  if (emotion === 'happy' || emotion === 'excited') {
    // 15% chance to add laughter
    if (Math.random() < 0.15) {
      const laughter = ['*giggles*', '*chuckles*', '*laughs*'][Math.floor(Math.random() * 3)];
      return `${laughter} ${text}`;
    }
  }
  return text;
}

/**
 * Complete text enhancement with all natural disfluencies
 */
export function enhanceTextWithDisfluencies(text: string, emotion?: string): string {
  let enhanced = text;
  
  // Add laughter first (if applicable)
  enhanced = addLaughter(enhanced, emotion);
  
  // Add disfluencies
  enhanced = addNaturalDisfluencies(enhanced, emotion);
  
  // Add pauses
  enhanced = addNaturalPauses(enhanced);
  
  return enhanced;
}

