import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type SentimentEmotion = 'curious' | 'happy' | 'calm' | 'sleepy' | 'confused' | 'excited' | 'empathetic' | 'sad';

/**
 * Analyze sentiment of user message and return emotion
 */
export async function analyzeSentiment(message: string): Promise<SentimentEmotion> {
  try {
    const emotionPrompt = `You are SamyBear's emotion detector for children (ages 5-10). Analyze the tone and sentiment of this message.

Classify it as ONE of these child-appropriate emotions:
- "curious": Asking questions, interested, wondering (e.g., "why?", "what's that?", "how does it work?")
- "happy": Excited, joyful, positive (e.g., "yay!", "I love it!", "that's fun!")
- "calm": Neutral, peaceful, normal conversation (e.g., "hi", "how are you?", "okay")
- "sleepy": Tired, quiet, ready for rest (e.g., "I'm tired", "goodnight", "bedtime")
- "confused": Unsure, puzzled, needs help (e.g., "I don't understand", "what?", "huh?")
- "excited": Very enthusiastic, energetic (e.g., "wow!", "amazing!", "so cool!")
- "empathetic": Caring, sharing feelings (e.g., "I care about you", "are you okay?", "I understand")
- "sad": Feeling down, disappointed (e.g., "I'm sad", "I don't like it", "that makes me sad")

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
    const validEmotions: SentimentEmotion[] = ['curious', 'happy', 'calm', 'sleepy', 'confused', 'excited', 'empathetic', 'sad'];
    
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
    case 'excited': return 0.9; // Very high energy
    case 'happy': return 0.8; // High energy
    case 'curious': return 0.7; // Medium-high
    case 'empathetic': return 0.65; // Medium
    case 'calm': return 0.5; // Medium
    case 'confused': return 0.4; // Lower energy
    case 'sleepy': return 0.3; // Low energy
    case 'sad': return 0.25; // Very low energy
    default: return 0.5;
  }
}

/**
 * Get emotion-specific subtitle for UI
 */
export function getEmotionSubtitle(emotion: SentimentEmotion): string {
  switch (emotion) {
    case 'curious': return 'Wondering about things 🐻';
    case 'happy': return 'Feeling joyful and happy! 🎉';
    case 'calm': return 'Peaceful and calm 🌸';
    case 'sleepy': return 'Getting a little sleepy... 😴';
    case 'confused': return 'Trying to understand 🤔';
    case 'excited': return 'Super excited! 🤩';
    case 'empathetic': return 'Caring about you, friend 💙';
    case 'sad': return 'Feeling a little down 💙';
    default: return 'Just being Samy ✨';
  }
}

