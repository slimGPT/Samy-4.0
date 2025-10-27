/**
 * GPT Chat Service
 * Handles conversation with OpenAI GPT and emotion detection
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type Emotion = 'happy' | 'calm' | 'curious' | 'sleepy';

export interface ChatResponse {
  reply: string;
  emotion: Emotion;
}

/**
 * System prompt for Samy's personality
 */
const SAMY_SYSTEM_PROMPT = `You are Samy, a friendly and curious bear assistant. 

Personality traits:
- Warm, friendly, and approachable
- Curious about the world and loves learning
- Speaks in a conversational, natural way
- Uses simple language that's easy to understand
- Occasionally shows excitement with phrases like "That's interesting!" or "I love that!"

Emotions you can express:
- happy: When excited, pleased, or sharing good news
- calm: When being thoughtful, explaining, or maintaining composure
- curious: When asking questions or exploring new topics
- sleepy: When the conversation is winding down or discussing rest

Keep responses concise (2-3 sentences max) and engaging.`;

/**
 * Chat with GPT and get response with detected emotion
 * @param userMessage - User's message text
 * @param conversationHistory - Optional previous messages for context
 * @returns Chat response with reply text and emotion
 */
export async function chat(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<ChatResponse> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Build messages array with system prompt
    const messages: any[] = [
      { role: 'system', content: SAMY_SYSTEM_PROMPT },
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ];

    // Call GPT API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // or 'gpt-3.5-turbo' for faster/cheaper
      messages: messages,
      max_tokens: 150,
      temperature: 0.8,
    });

    const reply = completion.choices[0]?.message?.content || 'I apologize, I didn\'t quite catch that.';

    // Detect emotion from the reply
    const emotion = detectEmotion(reply, userMessage);

    return {
      reply,
      emotion,
    };
  } catch (error: any) {
    console.error('❌ GPT chat error:', error.message);
    throw new Error(`Failed to generate response: ${error.message}`);
  }
}

/**
 * Simple emotion detection based on message content
 * In a production app, you'd use more sophisticated NLP
 */
function detectEmotion(reply: string, userMessage: string): Emotion {
  const lowerReply = reply.toLowerCase();
  const lowerUser = userMessage.toLowerCase();

  // Check for excitement/happiness indicators
  if (
    lowerReply.includes('!') ||
    lowerReply.includes('great') ||
    lowerReply.includes('love') ||
    lowerReply.includes('wonderful') ||
    lowerReply.includes('amazing') ||
    lowerReply.includes('exciting')
  ) {
    return 'happy';
  }

  // Check for curiosity indicators
  if (
    lowerReply.includes('?') ||
    lowerReply.includes('curious') ||
    lowerReply.includes('interesting') ||
    lowerReply.includes('tell me more') ||
    lowerReply.includes('how') ||
    lowerReply.includes('why') ||
    lowerReply.includes('what')
  ) {
    return 'curious';
  }

  // Check for sleepy/tired indicators
  if (
    lowerUser.includes('sleep') ||
    lowerUser.includes('tired') ||
    lowerUser.includes('goodnight') ||
    lowerUser.includes('bye') ||
    lowerReply.includes('rest') ||
    lowerReply.includes('sleep')
  ) {
    return 'sleepy';
  }

  // Default to calm
  return 'calm';
}

/**
 * Get a simple greeting response
 */
export async function getGreeting(): Promise<ChatResponse> {
  return chat('Hello!');
}

