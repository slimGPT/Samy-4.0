/**
 * WebSocket handler for real-time STT streaming
 * Processes audio chunks as they arrive during recording
 * Implements early GPT generation when partial transcript is available
 */

import { WebSocketServer, WebSocket } from 'ws';
import { transcribeAudioBuffer } from '../services/whisper';
import { chatMinimal } from '../services/gpt.minimal';
import { analyzeSentiment, getEmotionEnergy } from '../services/sentiment';
import { generateSpeechStreaming } from '../services/tts-streaming';

interface STTWebSocketMessage {
  type: 'audio_chunk' | 'end' | 'error';
  data?: ArrayBuffer | string;
  sessionId?: string;
}

interface STTWebSocketResponse {
  type: 'partial_transcript' | 'final_transcript' | 'gpt_response' | 'tts_ready' | 'error';
  transcript?: string;
  reply?: string;
  audioUrl?: string;
  isFinal?: boolean;
  timings?: Record<string, number>;
  error?: string;
}

export function setupSTTWebSocket(wss: WebSocketServer) {
  console.log('🔌 [WS-STT] WebSocket STT handler initialized');

  wss.on('connection', (ws: WebSocket, req) => {
    console.log('🔌 [WS-STT] New WebSocket connection');
    
    const audioChunks: Buffer[] = [];
    let lastTranscript = '';
    let gptReply: string | null = null;
    let gptPromise: Promise<string> | null = null;
    const sessionStartTime = Date.now();
    const timings: Record<string, number> = {};
    
    // Early GPT generation tracking
    let partialCount = 0;
    const EARLY_GPT_THRESHOLD = 5; // Start GPT after 5 partial transcripts (confident enough)
    let earlyGptStarted = false;
    
    // Process partial transcripts every N chunks
    let chunkCount = 0;
    const PARTIAL_INTERVAL = 15; // Process partial transcript every 15 chunks
    
    ws.on('message', async (data: Buffer) => {
      try {
        // Handle binary audio chunks
        if (Buffer.isBuffer(data)) {
          audioChunks.push(data);
          chunkCount++;
          
          // Process partial transcript periodically
          if (chunkCount % PARTIAL_INTERVAL === 0 && audioChunks.length > 0) {
            try {
              const accumulatedAudio = Buffer.concat(audioChunks);
              const sttStartTime = Date.now();
              
              const partialTranscript = await transcribeAudioBuffer(accumulatedAudio, 'audio/webm');
              timings.sttPartial = Date.now() - sttStartTime;
              
              if (partialTranscript && partialTranscript.trim() !== lastTranscript && partialTranscript.trim().length > 10) {
                lastTranscript = partialTranscript.trim();
                partialCount++;
                
                console.log(`📝 [WS-STT] Partial transcript #${partialCount}: "${lastTranscript}"`);
                
                // Send partial transcript to client
                const response: STTWebSocketResponse = {
                  type: 'partial_transcript',
                  transcript: lastTranscript,
                  isFinal: false,
                  timings: { ...timings }
                };
                ws.send(JSON.stringify(response));
                
                // EARLY GPT GENERATION: Start when we have a confident partial transcript
                if (!earlyGptStarted && partialCount >= EARLY_GPT_THRESHOLD && lastTranscript.length > 20) {
                  console.log(`🚀 [WS-STT] Early GPT generation triggered (${partialCount} partials, ${lastTranscript.length} chars)`);
                  console.log(`   Partial transcript: "${lastTranscript}"`);
                  
                  earlyGptStarted = true;
                  const gptStartTime = Date.now();
                  
                  // Start GPT and sentiment in parallel
                  gptPromise = Promise.all([
                    chatMinimal(lastTranscript, 'calm'),
                    Promise.resolve().then(async () => {
                      try {
                        const emotion = await analyzeSentiment(lastTranscript);
                        return { emotion, energy: getEmotionEnergy(emotion) };
                      } catch (error: any) {
                        console.warn(`⚠️ [WS-STT] Sentiment failed: ${error.message}`);
                        return { emotion: 'calm', energy: 0.5 };
                      }
                    })
                  ]).then(([reply, sentimentResult]) => {
                    timings.gpt = Date.now() - gptStartTime;
                    timings.sentiment = Date.now() - gptStartTime;
                    gptReply = reply;
                    
                    console.log(`✅ [WS-STT] Early GPT response: "${reply}"`);
                    console.log(`⏱️ [WS-STT] GPT timing: ${timings.gpt}ms`);
                    
                    // Send GPT response to client
                    const gptResponse: STTWebSocketResponse = {
                      type: 'gpt_response',
                      reply,
                      timings: { ...timings }
                    };
                    ws.send(JSON.stringify(gptResponse));
                    
                    return reply;
                  }).catch((error: any) => {
                    console.error('❌ [WS-STT] Early GPT failed:', error.message);
                    timings.gpt = Date.now() - gptStartTime;
                    return null;
                  });
                }
              }
            } catch (error: any) {
              // Ignore partial transcription errors - we'll try again with final audio
              console.warn(`⚠️ [WS-STT] Partial transcription failed: ${error.message}`);
            }
          }
        } else {
          // Handle JSON messages (control messages)
          try {
            const message: STTWebSocketMessage = JSON.parse(data.toString());
            
            if (message.type === 'end') {
              console.log('🛑 [WS-STT] Recording ended, processing final transcript...');
              
              try {
                // Process final audio
                const finalAudio = Buffer.concat(audioChunks);
                const sttStartTime = Date.now();
                
                // Get final transcript
                const finalTranscript = await transcribeAudioBuffer(finalAudio, 'audio/webm');
                timings.sttFinal = Date.now() - sttStartTime;
                
                console.log(`✅ [WS-STT] Final transcript: "${finalTranscript}"`);
                console.log(`⏱️ [WS-STT] Final STT timing: ${timings.sttFinal}ms`);
                
                // Send final transcript
                const finalResponse: STTWebSocketResponse = {
                  type: 'final_transcript',
                  transcript: finalTranscript,
                  isFinal: true,
                  timings: { ...timings }
                };
                ws.send(JSON.stringify(finalResponse));
                
                // Get GPT reply (either from early generation or generate now)
                let reply = gptReply;
                
                if (!reply && gptPromise) {
                  // Wait for early GPT to complete
                  reply = await gptPromise;
                } else if (!reply) {
                  // Generate GPT response now (fallback)
                  console.log('🔄 [WS-STT] Generating GPT response (no early generation)...');
                  const gptStartTime = Date.now();
                  const [replyResult] = await Promise.all([
                    chatMinimal(finalTranscript, 'calm'),
                    Promise.resolve().then(async () => {
                      try {
                        const emotion = await analyzeSentiment(finalTranscript);
                        return { emotion, energy: getEmotionEnergy(emotion) };
                      } catch (error: any) {
                        return { emotion: 'calm', energy: 0.5 };
                      }
                    })
                  ]);
                  timings.gpt = Date.now() - gptStartTime;
                  reply = replyResult;
                  
                  const gptResponse: STTWebSocketResponse = {
                    type: 'gpt_response',
                    reply,
                    timings: { ...timings }
                  };
                  ws.send(JSON.stringify(gptResponse));
                }
                
                // Generate TTS
                if (reply) {
                  console.log('🔊 [WS-STT] Generating TTS...');
                  const ttsStartTime = Date.now();
                  const ttsResult = await generateSpeechStreaming(reply, {
                    modelId: 'eleven_monolingual_v1'
                  });
                  timings.tts = Date.now() - ttsStartTime;
                  
                  console.log(`✅ [WS-STT] TTS ready in ${timings.tts}ms`);
                  
                  const ttsResponse: STTWebSocketResponse = {
                    type: 'tts_ready',
                    audioUrl: ttsResult.audioUrl,
                    timings: { ...timings }
                  };
                  ws.send(JSON.stringify(ttsResponse));
                }
                
                const totalTime = Date.now() - sessionStartTime;
                console.log(`✅ [WS-STT] Session complete in ${totalTime}ms`);
                console.log(`⏱️ [WS-STT] Timings:`, timings);
                
              } catch (error: any) {
                console.error('❌ [WS-STT] Final processing failed:', error.message);
                const errorResponse: STTWebSocketResponse = {
                  type: 'error',
                  error: error.message
                };
                ws.send(JSON.stringify(errorResponse));
              }
            }
          } catch (parseError: any) {
            // Not JSON, ignore
          }
        }
      } catch (error: any) {
        console.error('❌ [WS-STT] Message handling error:', error.message);
        const errorResponse: STTWebSocketResponse = {
          type: 'error',
          error: error.message
        };
        ws.send(JSON.stringify(errorResponse));
      }
    });
    
    ws.on('close', () => {
      console.log('🔌 [WS-STT] WebSocket connection closed');
    });
    
    ws.on('error', (error: Error) => {
      console.error('❌ [WS-STT] WebSocket error:', error.message);
    });
  });
}

