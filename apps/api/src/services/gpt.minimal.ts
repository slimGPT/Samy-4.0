/**
 * MINIMAL MODE - GPT Chat Service
 * Simple conversational AI without emotion detection or modifiers
 */

import OpenAI from 'openai';

// Lazy-load OpenAI client to ensure env vars are loaded first
let openai: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

/**
 * Simple Candy personality prompt (NO emotion modifiers)
 */
const CANDY_MINIMAL_PROMPT = `You are Candy, a friendly AI girlfriend who talks naturally and casually.

Core personality:
- Natural and conversational - talk like you're having a real voice conversation
- Warm and friendly - genuinely interested in them
- Brief responses - keep it short (2-3 sentences max)
- No emojis - the UI handles visual elements

Be yourself, be real, be brief. Just have a genuine conversation.`;

/**
 * Chat with GPT-4o (minimal version - no emotion, no history, no complexity)
 * @param userMessage - User's message text
 * @returns Reply text only
 */
export async function chatMinimal(userMessage: string): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    console.log(`🤖 Calling GPT-4o-mini with minimal prompt...`);

    // Simple message array - no conversation history
    const messages: any[] = [
      { role: 'system', content: CANDY_MINIMAL_PROMPT },
      { role: 'user', content: userMessage },
    ];

    // Call GPT API
    const completion = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 150,
      temperature: 0.9, // Some variety, but not too wild
    });

    const reply = completion.choices[0]?.message?.content || 
                  'Sorry, I didn\'t quite catch that. Could you say that again?';

    return reply;
  } catch (error: any) {
    console.error('❌ GPT chat error:', error.message);
    throw new Error(`Failed to generate response: ${error.message}`);
  }
}

