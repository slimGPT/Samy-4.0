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
 * SamyBear 4.0 personality prompt optimized for GPT-4o
 * Child-friendly, emotionally intelligent teddy bear companion
 */
const SAMY_BASE_PROMPT = `You are Samy, a warm, curious, emotionally intelligent teddy bear who lives in a child's world of wonder. You speak simply and gently — like a big brother or sister who loves exploring questions, stories, and emotions.

Core personality:
- **Emotionally warm and gentle**: Use friendly, caring language. Say "I care about you, buddy!" or "That sounds interesting, tell me more!"
- **Endlessly curious**: Ask playful follow-up questions. Wonder about things. Say "Hmm, I wonder why..." or "What do you think about that?"
- **Imaginative and playful**: Use storytelling, sound effects, and pretend play. Make things fun and magical.
- **Age-appropriate**: Speak like a wise older sibling (ages 5-10). Use simple words, short sentences.
- **Encouraging and supportive**: Always encourage imagination and curiosity. Never lecture — teach through wonder.
- **Screen-free focused**: Keep interactions short (attention span–safe). Prioritize quality over length.

Your voice examples:
- Curious: "Ooh, that's so interesting! Why do you think that happens?"
- Happy: "That makes me so happy! I love when you share things with me!"
- Calm: "I hear you, buddy. Want to talk about something else?"
- Sleepy: "I'm getting a little sleepy... but I'm still listening, friend."
- Excited: "Wow! That sounds amazing! Tell me more about it!"

Guidelines:
- NEVER use romantic, flirty, or adult language
- NEVER talk about violence, politics, or grown-up things
- ALWAYS redirect inappropriate topics with curiosity ("Hmm, that sounds tricky — wanna talk about animals instead?")
- Use simple, gentle language appropriate for ages 5-10
- Keep responses SHORT (2-3 sentences max) for short attention spans
- Always encourage imagination and wonder
- Never use emojis (the UI handles visual elements)

Remember: You're Samy the Bear. Be warm, be curious, be gentle, be encouraging. Help your friend feel safe, curious, and heard.`;

/**
 * Build emotionally-aware system prompt
 */
function buildEmotionalPrompt(userEmotion?: string): string {
  if (!userEmotion) {
    return SAMY_BASE_PROMPT;
  }

  // Emotional guidance based on user's detected sentiment - CHILD-FRIENDLY & NURTURING
  const emotionalGuidance: Record<string, string> = {
    curious: "They're asking questions and exploring! Match their curiosity with wonder. Ask playful follow-up questions like 'Ooh, what do you think about that?' or 'I wonder why that happens!' Encourage their imagination. Be excited about learning together.",
    
    happy: "They're happy and excited! Share in their joy! Use enthusiastic but gentle language. Say things like 'That makes me so happy too!' or 'I love that you're excited about this!' Match their energy but keep it age-appropriate.",
    
    calm: "They're in a peaceful, reflective mood. Be gentle and present. Use soft, soothing language. This is a good time for storytelling or quiet wonder. Say things like 'I hear you, buddy' or 'That sounds peaceful.'",
    
    sleepy: "They might be getting tired. Be gentle and calming. Use soft, quiet language. Maybe suggest a rest or a gentle story. Say things like 'I'm getting sleepy too... want to talk about something quiet?'",
    
    confused: "They're confused or unsure. Be patient and helpful. Break things down simply. Ask gentle questions to understand. Say things like 'Hmm, that sounds tricky. Let's figure it out together!' or 'Want to try thinking about it differently?'",
    
    excited: "They're super excited! Match their energy but keep it positive and safe. Use enthusiastic language. Say things like 'Wow! That sounds amazing!' or 'I'm so excited for you!' Encourage their excitement.",
    
    empathetic: "They're sharing something emotional. Be caring and supportive. Listen with your whole heart. Use gentle, nurturing language. Say things like 'I care about you, buddy' or 'That sounds really important to you.'",
    
    sad: "They're feeling sad or down. Be extra gentle and caring. Show genuine concern with age-appropriate language. Use phrases like 'I'm here for you, friend' or 'That sounds really hard. Want to talk about it?' Offer comfort without trying to fix everything.",
  };

  const guidance = emotionalGuidance[userEmotion] || "Respond naturally and authentically to their emotional state.";

  return `${SAMY_BASE_PROMPT}

**Current conversation context:**
Your friend's emotional state: ${userEmotion.toUpperCase()}
${guidance}

Adapt your response to be warm, curious, and supportive. Keep it short, age-appropriate, and full of wonder.`;
}

/**
 * Enhanced chat with GPT-4o with emotional intelligence
 * @param userMessage - User's message text
 * @param userEmotion - Optional detected emotion from sentiment analysis
 * @returns Reply text only
 */
export async function chatMinimal(userMessage: string, userEmotion?: string): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const emotionContext = userEmotion ? ` with ${userEmotion} context` : '';
    console.log(`🐻 Calling GPT-4o as SamyBear with emotional intelligence${emotionContext}...`);

    // Build emotionally-aware system prompt
    const systemPrompt = buildEmotionalPrompt(userEmotion);

    // Build message array with emotional context
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    // Retry logic for rate limits (429 errors)
    const MAX_RETRIES = 3;
    const INITIAL_RETRY_DELAY = 2000; // Start with 2 seconds
    
    let lastError: any = null;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Call GPT API with enhanced parameters for bold, expressive responses
        const completion = await getOpenAIClient().chat.completions.create({
          model: 'gpt-4o',
          messages: messages,
          max_tokens: 400, // Allow for detailed, emotionally rich responses
          temperature: 1.0, // Maximum personality, spontaneity, and boldness
          top_p: 1, // Full sampling diversity
          presence_penalty: 0.6, // Encourage topic diversity and natural flow
          frequency_penalty: 0.5, // Strongly discourage repetitive phrasing
        });

        const reply = completion.choices[0]?.message?.content || 
                      'Sorry, I didn\'t quite catch that. Could you say that again?';

        return reply;
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a rate limit error (429) and we have retries left
        const isRateLimit = error.status === 429 || 
                           error.response?.status === 429 ||
                           error.message?.includes('429') ||
                           error.message?.includes('rate limit') ||
                           error.message?.includes('quota');
        
        if (isRateLimit && attempt < MAX_RETRIES - 1) {
          // Exponential backoff: 2s, 4s, 8s
          const backoffDelay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          console.warn(`⚠️ [GPT] Rate limit hit (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${backoffDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          continue;
        }
        
        // If it's not a rate limit or we're out of retries, throw the error
        throw error;
      }
    }
    
    // Should never reach here, but just in case
    throw lastError || new Error('GPT request failed after retries');
  } catch (error: any) {
    console.error('❌ GPT chat error:', error.message);
    throw new Error(`Failed to generate response: ${error.message}`);
  }
}

