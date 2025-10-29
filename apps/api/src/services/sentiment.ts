import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type SentimentEmotion = 'flirty' | 'calm' | 'bitchy' | 'sad' | 'playful' | 'angry' | 'affectionate' | 'curious';

/**
 * Analyze sentiment of user message and return emotion
 */
export async function analyzeSentiment(message: string): Promise<SentimentEmotion> {
  try {
    const emotionPrompt = `You are Candy's emotion detector. Analyze the tone and sentiment of this message.
    
Classify it as ONE of these emotions:
- "flirty": Sexual, romantic, compliments, teasing (e.g., "you're so hot", "I want you")
- "calm": Neutral, normal conversation, questions (e.g., "how are you?", "what's up?")
- "bitchy": Insults, complaints, being mean (e.g., "you suck", "shut up", "annoying")
- "sad": Sad, depressed, crying, down (e.g., "I'm sad", "feeling down")
- "playful": Jokes, funny, lighthearted, silly (e.g., "haha", "lol", "you're funny")
- "angry": Mad, frustrated, yelling (e.g., "I hate this", "damn it", "fuck")
- "affectionate": Love, caring, sweet (e.g., "I love you", "you're amazing", "I miss you")
- "curious": Asking questions, interested, wondering (e.g., "why?", "what do you think?")

Message: "${message}"

Return ONLY one word: the emotion label. No explanation.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: emotionPrompt }],
      max_tokens: 10,
      temperature: 0.3,
    });

    const emotion = completion.choices[0]?.message?.content?.trim().toLowerCase() as SentimentEmotion;
    
    // Validate the emotion
    const validEmotions: SentimentEmotion[] = ['flirty', 'calm', 'bitchy', 'sad', 'playful', 'angry', 'affectionate', 'curious'];
    
    if (validEmotions.includes(emotion)) {
      console.log(`🎭 Sentiment analysis: "${message}" → ${emotion}`);
      return emotion;
    }
    
    // Default to calm if invalid
    console.log(`⚠️ Invalid emotion detected: ${emotion}, defaulting to calm`);
    return 'calm';
  } catch (error: any) {
    console.error('❌ Sentiment analysis error:', error.message);
    return 'calm'; // Default fallback
  }
}

/**
 * Get emotion-specific energy level
 */
export function getEmotionEnergy(emotion: SentimentEmotion): number {
  switch (emotion) {
    case 'flirty': return 0.9; // High energy
    case 'playful': return 0.85;
    case 'angry': return 0.95; // Very high
    case 'affectionate': return 0.75;
    case 'bitchy': return 0.8; // Sassy energy
    case 'curious': return 0.65;
    case 'calm': return 0.5; // Medium
    case 'sad': return 0.3; // Low energy
    default: return 0.7;
  }
}

/**
 * Get emotion-specific subtitle for UI
 */
export function getEmotionSubtitle(emotion: SentimentEmotion): string {
  switch (emotion) {
    case 'flirty': return 'Feeling sexy and playful 💋';
    case 'calm': return 'Taking it easy, just vibing 🌸';
    case 'bitchy': return 'Rolling her eyes at you 😤';
    case 'sad': return 'Feeling a little down 💙';
    case 'playful': return 'Ready to have some fun! 🎉';
    case 'angry': return 'Not in the mood for this 💢';
    case 'affectionate': return 'Falling for you all over again 💞';
    case 'curious': return 'Genuinely interested in you 🤔';
    default: return 'Just being herself ✨';
  }
}

