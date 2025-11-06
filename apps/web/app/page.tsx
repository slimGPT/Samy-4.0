'use client';

/**
 * SamyBear 4.0 - Child-Friendly AI Companion Web Interface
 * Complete experience with emotions, child-friendly styling, and dynamic energy bar
 * 🎤 ElevenLabs STT → 🧠 GPT-4o → 🎭 Emotion Engine → 🗣️ ElevenLabs TTS → 🔥 Firebase
 * 
 * Designed for children ages 5-10 with playful, gentle, and inviting UI
 */

import { useState, useRef } from 'react';
import STTRecorder from '../components/STTRecorder';
import DebugPanel, { LogEntry, Timing, DebugData } from '../components/DebugPanel';
import AgentDashboard from '../components/AgentDashboard';
import { processTranscript, TranscriptData, NonVerbalCue } from '../lib/transcriptUtils';

interface EmotionState {
  emotion: string;
  energy: number;
  phase: 'idle' | 'listening' | 'thinking' | 'speaking';
  language?: 'en' | 'fr' | 'ar';
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [transcriptData, setTranscriptData] = useState<TranscriptData | null>(null);
  const [reply, setReply] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [metrics, setMetrics] = useState<any>(null);
  const [emotionState, setEmotionState] = useState<EmotionState>({
    emotion: 'curious',
    energy: 0.65,
    phase: 'idle',
    language: 'en',
  });
  
  // Debug panel state
  const [debugLogs, setDebugLogs] = useState<LogEntry[]>([]);
  const [debugTimings, setDebugTimings] = useState<Timing[]>([]);
  const [debugErrors, setDebugErrors] = useState<string[]>([]);
  const [debugData, setDebugData] = useState<DebugData>({});
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const streamingAudioRefs = useRef<HTMLAudioElement[]>([]); // Track all streaming audio instances
  const streamReaderRef = useRef<ReadableStreamDefaultReader | null>(null); // Track stream reader
  const isStreamingAbortedRef = useRef<boolean>(false); // Track if streaming was aborted
  const recordingStartTimeRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const MIN_RECORDING_TIME = 800; // milliseconds

  // Helper functions for debug panel
  const addLog = (message: string, type: LogEntry['type'] = 'info', stage?: LogEntry['stage'], data?: any) => {
    const log: LogEntry = {
      timestamp: Date.now(),
      message,
      type,
      stage,
      data,
    };
    setDebugLogs(prev => [...prev, log]);
  };

  const addTiming = (stage: string, duration: number) => {
    const color = duration < 2000 ? 'green' : duration < 5000 ? 'yellow' : 'red';
    setDebugTimings(prev => [...prev, { stage, duration, color }]);
  };

  const clearDebug = () => {
    setDebugLogs([]);
    setDebugTimings([]);
    setDebugErrors([]);
    setDebugData({});
  };

  const startRecording = async () => {
    try {
      console.log('🎤 Starting recording...');
      clearDebug(); // Clear previous debug data
      addLog('Starting recording...', 'info', 'recording');
      setEmotionState(prev => ({ ...prev, phase: 'listening' }));
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Try to use the most compatible format
      let mimeType = 'audio/webm';
      let extension = 'webm';
      
      const preferredFormats = [
        { mime: 'audio/webm;codecs=opus', ext: 'webm' },
        { mime: 'audio/mp4', ext: 'mp4' },
        { mime: 'audio/mpeg', ext: 'mp3' },
        { mime: 'audio/webm', ext: 'webm' },
        { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
      ];
      
      for (const format of preferredFormats) {
        if (MediaRecorder.isTypeSupported(format.mime)) {
          mimeType = format.mime;
          extension = format.ext;
          console.log(`✅ Using format: ${mimeType}`);
          break;
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      const startTime = Date.now();
      recordingStartTimeRef.current = startTime;

      // Update recording duration every 100ms
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((Date.now() - startTime) / 1000);
      }, 100);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const recordingDuration = (Date.now() - startTime) / 1000;
        console.log(`⏹️ Recording duration: ${recordingDuration.toFixed(2)}s`);
        addLog(`Recording stopped (${recordingDuration.toFixed(2)}s)`, 'success', 'recording');

        if (recordingDuration < 1.0) {
          stream.getTracks().forEach(track => track.stop());
          const errorMsg = 'Please record for at least 2 seconds - speak clearly into your mic';
          setError(errorMsg);
          addLog(errorMsg, 'error', 'recording');
          setDebugErrors(prev => [...prev, errorMsg]);
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach(track => track.stop());
        
        console.log(`📦 Audio blob size: ${audioBlob.size} bytes`);
        setDebugData(prev => ({ ...prev, audioSize: audioBlob.size }));
        
        if (audioBlob.size < 2000) {
          const errorMsg = 'Recording too short or no audio captured. Speak for at least 2 seconds.';
          setError(errorMsg);
          addLog(errorMsg, 'error', 'recording');
          setDebugErrors(prev => [...prev, errorMsg]);
          return;
        }

        await processPipeline(audioBlob, extension);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setTranscript('');
      setTranscriptData(null);
      setReply('');
      setError('');
      addLog('Recording started', 'success', 'recording');
    } catch (err: any) {
      console.error('❌ Recording error:', err);
      setError(`Microphone access failed: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log('🛑 Stopping recording...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const normalizeSttErrorResponse = (rawText: string, fallbackMessage: string) => {
    if (!rawText || !rawText.trim()) {
      return {
        userMessage: fallbackMessage,
        parsedPayload: null,
        debugExtras: { rawResponse: '(empty)' }
      };
    }

    try {
      const parsed = JSON.parse(rawText);
      if (parsed && typeof parsed === 'object') {
        const message = parsed.error || parsed.message || parsed.details || fallbackMessage;
        return {
          userMessage: message,
          parsedPayload: parsed,
          debugExtras: { parsed }
        };
      }
      return {
        userMessage: fallbackMessage,
        parsedPayload: null,
        debugExtras: { rawResponse: rawText }
      };
    } catch (err) {
      return {
        userMessage: fallbackMessage,
        parsedPayload: null,
        debugExtras: {
          rawResponse: rawText,
          parseError: (err as Error).message
        }
      };
    }
  };

  const processPipeline = async (audioBlob: Blob, extension: string) => {
    setIsProcessing(true);
    setEmotionState(prev => ({ ...prev, phase: 'thinking' }));
    setError('');

    try {
      const pipelineStartTime = Date.now();

      // Step 1: Transcribe audio (using proven working code from test-STT)
      console.log('\n🎤 [STT] Sending audio for transcription...');
      addLog('Sending audio to STT API...', 'info', 'stt', {
        size: audioBlob.size,
        type: audioBlob.type,
        extension
      });
      const listenStartTime = Date.now();
      
      // Prepare FormData (exact format from working test)
      const formData = new FormData();
      formData.append('file', audioBlob, `recording.${extension}`);
      
      console.log('📡 [STT] Sending to backend:', {
        url: `${API_URL}/listen`,
        blobSize: audioBlob.size,
        blobType: audioBlob.type,
        extension: extension
      });

      const listenRes = await fetch(`${API_URL}/listen`, {
        method: 'POST',
        body: formData,
      });

      // DETAILED ERROR HANDLING - Always log full response details
      if (!listenRes.ok) {
        let rawText = '';
        try {
          rawText = await listenRes.text();
        } catch (textError) {
          console.error('❌ [STT] Failed to read response text:', textError);
        }

        const errorDetails = {
          status: listenRes.status,
          statusText: listenRes.statusText,
          contentType: listenRes.headers.get('content-type'),
          url: `${API_URL}/listen`
        };

        const fallbackMessage = `Backend failed with status ${listenRes.status}`;
        const normalized = normalizeSttErrorResponse(rawText, fallbackMessage);

        const logPayload = {
          ...errorDetails,
          ...normalized.debugExtras,
        };

        const displayMessage = normalized.userMessage || 'Unknown STT failure';

        console.error(`[STT] Error (${listenRes.status}):`, displayMessage);
        console.error('[STT] Error context:', logPayload);

        addLog(`STT API error: ${listenRes.status} ${listenRes.statusText}`, 'error', 'stt', logPayload);

        let userError = displayMessage;

        if (userError.includes('too short') || userError.includes('corrupt') || userError.includes('Recording too short')) {
          userError = '🎤 Recording too short - please speak for at least 2 seconds';
        } else if (userError.includes('API key') || userError.includes('configuration') || userError.includes('not configured')) {
          userError = '⚙️ Voice recognition service needs configuration. Check API keys in backend.';
        } else if (userError.includes('Both') || userError.includes('All') || userError.includes('unavailable')) {
          userError = '🔧 All voice services failed. Check backend logs for API key issues.';
        } else if (userError.includes('rate limit') || userError.includes('quota')) {
          userError = '⏱️ Too many requests. Please wait a moment and try again.';
        } else if (userError.includes('timeout')) {
          userError = '⏱️ Request timed out. Please try with a shorter recording.';
        } else if (userError.includes('No file') || userError.includes('upload')) {
          userError = '📁 Audio file upload failed. Please try again.';
        } else if (listenRes.status === 503) {
          userError = '🔧 Speech recognition service temporarily down. Try again shortly.';
        } else if (listenRes.status >= 500) {
          userError = '🔧 Server error. Check the API server console for detailed logs.';
        } else if (listenRes.status === 404) {
          userError = '🔧 Backend endpoint not found. Is the API server running on port 3001?';
        }

        setError(userError);
        addLog(userError, 'error', 'stt', logPayload);
        setDebugErrors(prev => [...prev, userError]);
        setIsProcessing(false);
        setEmotionState(prev => ({ ...prev, phase: 'idle' }));
        return;
      }

      // Parse successful response (using proven pattern from test-STT)
      const listenData = await listenRes.json().catch((jsonError) => {
        console.error('❌ [STT] Failed to parse response as JSON:', jsonError);
        throw new Error('Server returned invalid JSON');
      });
      
      console.log('[STT] Response data:', listenData);
      
      // Extract transcript (handle multiple possible response formats - from working test)
      const rawTranscript = listenData.text || listenData.transcript || listenData.transcription || '';
      
      if (!rawTranscript || rawTranscript.trim() === '') {
        console.error('❌ [STT] Empty transcription received. Response:', listenData);
        setError('🔧 Transcription failed - no text returned. Check backend logs.');
        setIsProcessing(false);
        setEmotionState(prev => ({ ...prev, phase: 'listening' }));
        return;
      }
      
      const transcriptionDuration = Date.now() - listenStartTime;
      
      // ENGLISH-ONLY MODE: Check environment variable (can be set in .env)
      const ENGLISH_ONLY_MODE = process.env.NEXT_PUBLIC_ENGLISH_ONLY_MODE === 'true';
      
      // Process transcript: clean, detect language, extract cues
      const processed = processTranscript(rawTranscript.trim(), ENGLISH_ONLY_MODE);
      setTranscriptData(processed);
      setTranscript(processed.cleaned); // Display cleaned version
      
      // ENGLISH-ONLY MODE: Show warning if non-English detected
      if (ENGLISH_ONLY_MODE && processed.isNonEnglish) {
        const errorMsg = `⚠️ Only English is supported for now. Please speak in English. (Detected: ${processed.language})`;
        setError(errorMsg);
        addLog(errorMsg, 'warn', 'stt');
        setIsProcessing(false);
        setEmotionState(prev => ({ ...prev, phase: 'listening' }));
        return; // Stop pipeline if non-English detected
      }
      
      console.log(`✅ [STT] Raw transcription: "${processed.raw}"`);
      console.log(`✅ [STT] Cleaned transcription: "${processed.cleaned}"`);
      if (processed.language) {
        console.log(`🌐 [STT] Detected language: ${processed.language}`);
      }
      if (processed.nonVerbalCues.length > 0) {
        console.log(`😊 [STT] Non-verbal cues: ${processed.nonVerbalCues.map(c => c.label).join(', ')}`);
      }
      console.log(`⏱️ [STT] Duration: ${transcriptionDuration}ms`);
      
      addLog(`Transcription successful: "${processed.cleaned}"`, 'success', 'stt');
      if (processed.language) {
        addLog(`Detected language: ${processed.language}`, 'info', 'stt');
      }
      if (processed.nonVerbalCues.length > 0) {
        addLog(`Non-verbal cues detected: ${processed.nonVerbalCues.map(c => c.label).join(', ')}`, 'info', 'stt');
      }
      
      addTiming('STT', transcriptionDuration);
      setDebugData(prev => ({
        ...prev,
        transcript: processed.cleaned,
        rawTranscript: processed.raw,
        language: processed.language,
        nonVerbalCues: processed.nonVerbalCues,
      }));

      // Step 2: Get GPT response (OPTIMIZED: Get reply first, then stream TTS)
      console.log('\n🧠 [GPT] Getting GPT response...');
      const textToSend = processed.cleaned;
      addLog(`Sending to GPT: "${textToSend}"`, 'info', 'gpt');
      const talkStartTime = Date.now();
      
      const talkRes = await fetch(`${API_URL}/talk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSend }),
      });

      if (!talkRes.ok) {
        const errorData = await talkRes.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ [TALK] Failed:', errorData);
        const errorMsg = errorData.error || 'Failed to generate response';
        setError(errorMsg);
        addLog(errorMsg, 'error', 'gpt', errorData);
      setDebugErrors(prev => [...prev, errorMsg]);
      setIsProcessing(false);
      setEmotionState(prev => ({ ...prev, phase: 'idle' }));
      return;
      }

      const talkData = await talkRes.json();
      const talkDuration = Date.now() - talkStartTime;
      
      console.log(`✅ [GPT] Response: "${talkData.reply}"`);
      console.log(`⏱️ [TALK] Duration: ${talkDuration}ms`);
      
      addLog(`GPT response received: "${talkData.reply}"`, 'success', 'gpt');
      
      // Extract individual timings from metrics if available
      if (talkData.metrics) {
        if (talkData.metrics.gpt) {
          addTiming('GPT', talkData.metrics.gpt);
        }
        if (talkData.metrics.tts) {
          addTiming('TTS (generation)', talkData.metrics.tts);
        }
      } else {
        const estimatedGPT = talkDuration * 0.6;
        const estimatedTTS = talkDuration * 0.4;
        addTiming('GPT', estimatedGPT);
        addTiming('TTS (generation)', estimatedTTS);
      }
      
      setDebugData(prev => ({
        ...prev,
        gptPrompt: processed.cleaned,
        voiceModel: 'eleven_monolingual_v1 (English, fastest)',
      }));
      
      // Update emotion and energy from API response
      if (talkData.emotion) {
        console.log(`🎭 [EMOTION] ${talkData.emotion}`);
        const energyMap: Record<string, number> = {
          excited: 0.90,
          happy: 0.80,
          curious: 0.70,
          empathetic: 0.65,
          calm: 0.50,
          confused: 0.40,
          sleepy: 0.30,
          sad: 0.25,
          neutral: 0.50,
        };
        
        // Update language if detected in transcript
        const detectedLanguage = processed.language?.toLowerCase();
        let language: 'en' | 'fr' | 'ar' = emotionState.language || 'en';
        if (detectedLanguage?.includes('french') || detectedLanguage?.includes('fr')) {
          language = 'fr';
        } else if (detectedLanguage?.includes('arabic') || detectedLanguage?.includes('ar')) {
          language = 'ar';
        } else if (detectedLanguage?.includes('english') || detectedLanguage?.includes('en')) {
          language = 'en';
        }
        
        setEmotionState({
          emotion: talkData.emotion,
          energy: energyMap[talkData.emotion] || 0.50,
          phase: 'speaking',
          language: language,
        });
      }
      
      setReply(talkData.reply);

      // Step 3: Stream TTS audio and play immediately (OPTIMIZED)
      console.log('🎵 [STREAMING-TTS] Starting streaming audio playback...');
      const streamingTTSStartTime = Date.now();
      
      try {
        // Use streaming TTS endpoint for immediate playback
        const streamRes = await fetch(`${API_URL}/talk/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: talkData.reply }),
        });

        if (!streamRes.ok) {
          throw new Error(`Streaming TTS failed: ${streamRes.status}`);
        }

        // Read stream chunks and play immediately (simplified approach)
        const reader = streamRes.body?.getReader();
        if (!reader) {
          throw new Error('Stream reader not available');
        }

        // Store reader reference for abort capability
        streamReaderRef.current = reader;
        isStreamingAbortedRef.current = false;
        streamingAudioRefs.current = []; // Reset streaming audio refs

        let chunks: Uint8Array[] = [];
        let firstChunkTime: number | null = null;
        let audioStarted = false;

        // Process stream chunks
        const processChunk = async () => {
          try {
            while (true) {
              // Check if aborted
              if (isStreamingAbortedRef.current) {
                console.log('🛑 [STREAMING-TTS] Stream aborted by user');
                break;
              }
              
              const { done, value } = await reader.read();
              
              if (done) {
                // Check if aborted before playing final audio
                if (isStreamingAbortedRef.current) {
                  console.log('🛑 [STREAMING-TTS] Stream aborted before final playback');
                  break;
                }
                
                // Combine all chunks and play
                const allChunks = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
                let offset = 0;
                for (const chunk of chunks) {
                  allChunks.set(chunk, offset);
                  offset += chunk.length;
                }
                
                const blob = new Blob([allChunks], { type: 'audio/mpeg' });
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                currentAudioRef.current = audio;
                streamingAudioRefs.current.push(audio);
                
                audio.onended = () => {
                  URL.revokeObjectURL(url);
                  currentAudioRef.current = null;
                  streamingAudioRefs.current = streamingAudioRefs.current.filter(a => a !== audio);
                  if (streamingAudioRefs.current.length === 0) {
                    setEmotionState(prev => ({ ...prev, phase: 'idle' }));
                  }
                };
                
                // Check again if aborted before playing
                if (!isStreamingAbortedRef.current && !audioStarted) {
                  await audio.play();
                  audioStarted = true;
                }
                
                const totalStreamTime = Date.now() - streamingTTSStartTime;
                console.log(`✅ [STREAMING-TTS] Playback complete in ${totalStreamTime}ms`);
                addLog('Streaming audio playback finished', 'success', 'tts');
                break;
              }

              if (value) {
                // Check if aborted
                if (isStreamingAbortedRef.current) {
                  console.log('🛑 [STREAMING-TTS] Stream aborted during chunk processing');
                  break;
                }
                
                chunks.push(value);
                
                if (firstChunkTime === null) {
                  firstChunkTime = Date.now();
                  const firstChunkLatency = firstChunkTime - streamingTTSStartTime;
                  console.log(`🚀 [STREAMING-TTS] First chunk received in ${firstChunkLatency}ms`);
                  addTiming('TTS (first chunk)', firstChunkLatency);
                  addLog(`Streaming TTS started (first chunk in ${firstChunkLatency}ms)`, 'success', 'tts');
                  
                  // Start playing first chunk immediately
                  const blob = new Blob([value], { type: 'audio/mpeg' });
                  const url = URL.createObjectURL(blob);
                  const audio = new Audio(url);
                  currentAudioRef.current = audio;
                  streamingAudioRefs.current.push(audio);
                  
                  audio.onended = () => {
                    URL.revokeObjectURL(url);
                    streamingAudioRefs.current = streamingAudioRefs.current.filter(a => a !== audio);
                  };
                  
                  // Check if aborted before playing
                  if (!isStreamingAbortedRef.current) {
                    audio.play().then(() => {
                      if (!isStreamingAbortedRef.current) {
                        audioStarted = true;
                      }
                    }).catch(err => {
                      if (!isStreamingAbortedRef.current) {
                        console.error('Playback error:', err);
                      }
                    });
                  }
                }
              }
            }
          } catch (err: any) {
            if (!isStreamingAbortedRef.current) {
              console.error('❌ [STREAMING-TTS] Error:', err);
              setError('Streaming audio failed');
            }
          } finally {
            // Clean up reader reference
            streamReaderRef.current = null;
          }
        };

        // Start processing chunks (don't await - let it run)
        processChunk().catch(err => {
          if (!isStreamingAbortedRef.current) {
            console.error('❌ [STREAMING-TTS] Error:', err);
            setError('Streaming audio failed');
          }
        });

        // Fallback: Use regular audio if streaming fails
        if (talkData.audioUrl) {
          console.log('🎵 [FALLBACK] Using regular audio playback...');
          const audio = new Audio(talkData.audioUrl);
          currentAudioRef.current = audio;
          
          audio.onended = () => {
            console.log('✅ Audio playback finished');
            addLog('Audio playback finished', 'success', 'tts');
            currentAudioRef.current = null;
            setEmotionState(prev => ({ ...prev, phase: 'idle' }));
          };

          audio.onerror = () => {
            console.error('❌ Audio playback error');
            currentAudioRef.current = null;
          };

          audio.play().catch(err => console.error('Playback error:', err));
        }
      } catch (streamError: any) {
        console.error('❌ [STREAMING-TTS] Failed, using fallback:', streamError);
        // Fallback to regular audio
        if (talkData.audioUrl) {
          const audio = new Audio(talkData.audioUrl);
          currentAudioRef.current = audio;
          audio.play().catch(err => console.error('Playback error:', err));
        }
      }

      // Display metrics
      const totalDuration = Date.now() - pipelineStartTime;
      const metricsData = {
        stt: transcriptionDuration,
        gpt: talkData.metrics?.gpt || 0,
        tts: talkData.metrics?.tts || 0,
        total: totalDuration,
        latency: totalDuration, // Total latency for display
      };
      setMetrics(metricsData);
      addTiming('Total', totalDuration);
      addLog(`Pipeline completed (Total: ${totalDuration}ms)`, 'success');
      
      console.log('\n⏱️ [METRICS] Full Pipeline:');
      console.log(`   - STT: ${metricsData.stt}ms`);
      console.log(`   - GPT: ${metricsData.gpt}ms`);
      console.log(`   - TTS: ${metricsData.tts}ms`);
      console.log(`   - Total: ${metricsData.total}ms`);
      console.log(`   - Target: < 5000ms (${metricsData.total < 5000 ? '✅ PASS' : '❌ FAIL'})\n`);
    } catch (err: any) {
      console.error('❌ Pipeline error:', err);
      console.error('   Full error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      // More specific error messages
      let errorMsg = err.message || 'Unknown error';
      let stage: LogEntry['stage'] = undefined;
      
      if (err.message?.includes('transcribe') || err.message?.includes('STT') || err.message?.includes('recognition')) {
        errorMsg = `🎤 Speech recognition failed: ${err.message}`;
        stage = 'stt';
      } else if (err.message?.includes('JSON') || err.message?.includes('parse')) {
        errorMsg = `🔧 Server response error: ${err.message}`;
        stage = 'gpt';
      } else if (err.message?.includes('network') || err.message?.includes('fetch') || err.message?.includes('Failed to fetch')) {
        errorMsg = `🌐 Network error: Could not reach API server. Check if it's running on port 3001`;
        stage = 'stt';
      } else {
        errorMsg = `Error: ${err.message || 'Unknown error'}`;
      }
      
      setError(errorMsg);
      addLog(errorMsg, 'error', stage, {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      setDebugErrors(prev => [...prev, errorMsg]);
      setEmotionState(prev => ({ ...prev, phase: 'listening' }));
    } finally {
      setIsProcessing(false);
    }
  };

  // Stop audio playback ("Shut up" button)
  const handleStopAudio = () => {
    console.log('🤫 [SHUT-UP] Stopping all audio playback...');
    
    // Stop main audio reference
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    
    // Stop all streaming audio instances
    streamingAudioRefs.current.forEach((audio, index) => {
      if (audio) {
        try {
          audio.pause();
          audio.currentTime = 0;
          console.log(`🤫 [SHUT-UP] Stopped streaming audio instance ${index}`);
        } catch (err) {
          console.warn(`⚠️ [SHUT-UP] Error stopping audio instance ${index}:`, err);
        }
      }
    });
    streamingAudioRefs.current = [];
    
    // Abort stream reader if active
    if (streamReaderRef.current) {
      try {
        streamReaderRef.current.cancel();
        console.log('🤫 [SHUT-UP] Stream reader aborted');
      } catch (err) {
        console.warn('⚠️ [SHUT-UP] Error aborting stream:', err);
      }
      streamReaderRef.current = null;
    }
    
    // Mark streaming as aborted
    isStreamingAbortedRef.current = true;
    
    // Update state
    setEmotionState(prev => ({ ...prev, phase: 'idle' }));
    addLog('Audio playback stopped by user', 'info', 'tts');
    console.log('✅ [SHUT-UP] All audio stopped');
  };

  // Push-to-talk toggle handler
  const handleMicClick = () => {
    if (isProcessing) return;
    
    if (isRecording) {
      // Stop recording and start processing
      stopRecording();
    } else {
      // Start recording
      startRecording();
    }
  };

  // Get status color based on phase (child-friendly)
  const getPhaseColor = () => {
    switch (emotionState.phase) {
      case 'idle': return 'bg-blue-300';
      case 'listening': return 'bg-sky-400';
      case 'thinking': return 'bg-yellow-400 animate-pulse';
      case 'speaking': return 'bg-green-400 animate-pulse';
      default: return 'bg-blue-300';
    }
  };

  // Get phase label (child-friendly)
  const getPhaseLabel = () => {
    switch (emotionState.phase) {
      case 'idle': return 'Waiting patiently…';
      case 'listening': return 'Listening carefully…';
      case 'thinking': return 'Hmmm…';
      case 'speaking': return 'Telling a story…';
      default: return 'Ready to talk!';
    }
  };

  // Get language flag emoji
  const getLanguageFlag = () => {
    switch (emotionState.language) {
      case 'en': return '🇬🇧';
      case 'fr': return '🇫🇷';
      case 'ar': return '🇸🇦';
      default: return '🌐';
    }
  };

  // Get energy label (playful)
  const getEnergyLabel = () => {
    const energy = emotionState.energy;
    if (energy < 0.3) return 'Sleepy snuggles...';
    if (energy < 0.6) return 'Ready to listen.';
    if (energy < 0.85) return 'Bouncing with ideas!';
    return 'Super excited!';
  };

  // Get emotion-specific styling (child-friendly colors: sky blue, warm yellows, gentle greens, soft purples)
  const getEmotionStyle = () => {
    switch (emotionState.emotion) {
      case 'curious':
        return {
          gradient: 'from-sky-400 via-blue-400 to-indigo-400',
          glow: 'shadow-lg shadow-sky-400/50',
          emoji: '🐻',
          bg: 'bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20',
          text: 'text-sky-700 dark:text-sky-300',
          borderColor: 'border-sky-300 dark:border-sky-500',
          pulse: '',
          subtitle: 'Let\'s go explore! 🧐'
        };
      case 'happy':
        return {
          gradient: 'from-yellow-300 via-amber-300 to-orange-300',
          glow: 'shadow-lg shadow-yellow-400/50',
          emoji: '🎉',
          bg: 'bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20',
          text: 'text-yellow-700 dark:text-yellow-300',
          borderColor: 'border-yellow-300 dark:border-yellow-500',
          pulse: 'animate-bounce',
          subtitle: 'Feeling joyful and happy! 🎉'
        };
      case 'calm':
        return {
          gradient: 'from-blue-300 via-cyan-300 to-teal-300',
          glow: 'shadow-lg shadow-blue-400/50',
          emoji: '🌸',
          bg: 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20',
          text: 'text-blue-700 dark:text-blue-300',
          borderColor: 'border-blue-300 dark:border-blue-500',
          pulse: '',
          subtitle: 'Peaceful and calm 🌸'
        };
      case 'sleepy':
        return {
          gradient: 'from-indigo-300 via-purple-300 to-blue-300',
          glow: 'shadow-lg shadow-indigo-400/50',
          emoji: '😴',
          bg: 'bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20',
          text: 'text-indigo-700 dark:text-indigo-300',
          borderColor: 'border-indigo-300 dark:border-indigo-500',
          pulse: '',
          subtitle: 'Getting a little sleepy... 😴'
        };
      case 'confused':
        return {
          gradient: 'from-gray-300 via-slate-300 to-blue-300',
          glow: 'shadow-lg shadow-gray-400/50',
          emoji: '🤔',
          bg: 'bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20',
          text: 'text-gray-700 dark:text-gray-300',
          borderColor: 'border-gray-300 dark:border-gray-500',
          pulse: '',
          subtitle: 'Trying to understand 🤔'
        };
      case 'excited':
        return {
          gradient: 'from-orange-300 via-amber-300 to-yellow-300',
          glow: 'shadow-lg shadow-orange-400/50',
          emoji: '🤩',
          bg: 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20',
          text: 'text-orange-700 dark:text-orange-300',
          borderColor: 'border-orange-300 dark:border-orange-500',
          pulse: 'animate-bounce',
          subtitle: 'Super excited! 🤩'
        };
      case 'empathetic':
        return {
          gradient: 'from-purple-300 via-pink-300 to-rose-300',
          glow: 'shadow-lg shadow-purple-400/50',
          emoji: '💙',
          bg: 'bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20',
          text: 'text-purple-700 dark:text-purple-300',
          borderColor: 'border-purple-300 dark:border-purple-500',
          pulse: '',
          subtitle: 'Caring about you, friend 💙'
        };
      case 'sad':
        return {
          gradient: 'from-blue-300 via-indigo-300 to-purple-300',
          glow: 'shadow-lg shadow-blue-400/50',
          emoji: '💙',
          bg: 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20',
          text: 'text-blue-700 dark:text-blue-300',
          borderColor: 'border-blue-300 dark:border-blue-500',
          pulse: '',
          subtitle: 'Feeling a little down 💙'
        };
      default:
        return {
          gradient: 'from-sky-300 to-blue-300',
          glow: 'shadow-lg shadow-sky-400/50',
          emoji: '🐻',
          bg: 'bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20',
          text: 'text-sky-700 dark:text-sky-300',
          borderColor: 'border-sky-300 dark:border-sky-500',
          pulse: '',
          subtitle: 'Just being Samy ✨'
        };
    }
  };

  const emotionStyle = getEmotionStyle();

  return (
    <div className="h-screen flex overflow-hidden bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-gray-900">
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1 text-sky-700 dark:text-sky-300">🐻 SamyBear</h1>
            <p className="text-sky-600 dark:text-sky-400 text-base">
              Your curious teddy bear friend 🧸
            </p>
          </div>

          {/* Status Indicators */}
          <div className="flex gap-3">
            {/* Connection Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-full border border-green-300 dark:border-green-700">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wide">Connected</span>
            </div>
            
            {/* Language Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-full border border-blue-300 dark:border-blue-700">
              <span className="text-lg">{getLanguageFlag()}</span>
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">{emotionState.language?.toUpperCase() || 'EN'}</span>
            </div>
            
            {/* Phase Status - Child-friendly labels */}
            <div className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30 rounded-full border border-yellow-300 dark:border-yellow-600">
              <div className={`w-3 h-3 rounded-full ${getPhaseColor()} shadow-lg ${emotionState.phase === 'idle' || emotionState.phase === 'listening' ? '' : 'animate-pulse'}`} />
              <span className="text-xs font-bold text-yellow-800 dark:text-yellow-200 uppercase tracking-wide">{getPhaseLabel()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
      {/* Dynamic Emotional State Monitor */}
      <div className={`${emotionStyle.bg} ${emotionStyle.borderColor} border rounded-2xl ${emotionStyle.glow} p-5 transition-all duration-700 ease-in-out`}
           style={{ minHeight: 'fit-content' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-sky-700 dark:text-sky-300">
            <span>💭 How SamyBear Feels</span>
          </h2>
        </div>
        
        {/* Emotion Display - Big and Animated */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-sky-600 dark:text-sky-400 uppercase tracking-wide">Current Emotion</span>
          </div>
          <div className={`flex items-center gap-4 p-4 bg-white/70 dark:bg-black/40 backdrop-blur-sm rounded-xl border ${emotionStyle.borderColor} ${emotionStyle.glow} transition-all duration-500`}>
            <div className={`text-6xl ${emotionStyle.pulse}`}>
              {emotionStyle.emoji}
            </div>
            <div className="flex-1">
              <div className={`text-3xl font-black capitalize ${emotionStyle.text} transition-all duration-500`}>
                {emotionState.emotion}
              </div>
              <div className="text-sm text-sky-600 dark:text-sky-400 mt-1">
                {emotionStyle.subtitle}
              </div>
            </div>
          </div>
        </div>

        {/* Energy Level - Animated Bar with Playful Labels */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-sky-600 dark:text-sky-400 uppercase tracking-wide">Bear Energy</span>
            <span className={`text-2xl font-black ${emotionStyle.text} transition-all duration-500`}>
              {Math.round(emotionState.energy * 100)}%
            </span>
          </div>
          <div className="relative">
            {/* Background bar */}
            <div className="w-full bg-white/70 dark:bg-black/40 rounded-full h-6 overflow-hidden border border-white/30">
              {/* Animated energy bar with glow */}
              <div
                className={`bg-gradient-to-r ${emotionStyle.gradient} h-full transition-all duration-1000 ease-out relative flex items-center justify-center`}
                style={{ width: `${emotionState.energy * 100}%` }}
              >
                {/* Animated stars/sparkles */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-lg animate-pulse">✨</span>
                </div>
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                {/* Pulse glow */}
                <div className={`absolute inset-0 ${emotionStyle.glow} animate-pulse`} />
              </div>
            </div>
            {/* Energy level indicators with playful labels */}
            <div className="flex justify-between mt-2 px-1">
              <span className="text-xs font-medium text-sky-600 dark:text-sky-400">Sleepy snuggles...</span>
              <span className="text-xs font-medium text-sky-600 dark:text-sky-400">Ready to listen.</span>
              <span className="text-xs font-medium text-sky-600 dark:text-sky-400">Bouncing with ideas!</span>
            </div>
            {/* Current energy label */}
            <div className="text-center mt-2">
              <span className="text-sm font-semibold text-sky-700 dark:text-sky-300">{getEnergyLabel()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Talk Interface */}
      <div className="space-y-6">
      <div className="bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 rounded-xl shadow-md p-6 border border-sky-200 dark:border-sky-700">
        <h2 className="text-2xl font-semibold mb-4 text-center text-sky-700 dark:text-sky-300">🐻 Talk to SamyBear</h2>
        
        {/* Push-to-Talk Mic Button (Plush Mic Style) + Stop Button */}
        <div className="flex flex-col items-center gap-4 mb-4">
          <button
            onClick={handleMicClick}
            disabled={isProcessing}
            className={`w-32 h-32 rounded-full font-bold text-3xl transition-all transform shadow-2xl select-none ${
              isRecording
                ? 'bg-red-400 hover:bg-red-500 text-white scale-110 animate-pulse border-4 border-red-300'
                : isProcessing
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed border-4 border-gray-200'
                : 'bg-gradient-to-br from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white hover:scale-105 active:scale-95 border-4 border-sky-300 shadow-lg'
            }`}
            style={{
              boxShadow: isRecording 
                ? '0 0 30px rgba(239, 68, 68, 0.5)' 
                : '0 10px 25px rgba(14, 165, 233, 0.3)'
            }}
          >
            {isRecording ? (
              <>🔴</>
            ) : isProcessing ? (
              <>⏳</>
            ) : (
              <>🎤</>
            )}
          </button>
          
          {/* Stop Button - Shows when SamyBear is speaking */}
          {emotionState.phase === 'speaking' && (currentAudioRef.current || streamingAudioRefs.current.length > 0) && !isRecording && (
            <button
              onClick={handleStopAudio}
              title="Stop SamyBear from talking"
              className="group relative px-6 py-3 bg-gradient-to-r from-orange-400 to-red-400 hover:from-orange-500 hover:to-red-500 text-white font-bold text-base rounded-full shadow-xl transform transition-all hover:scale-105 active:scale-95 border-2 border-white/30"
            >
              <span className="flex items-center gap-2">
                <span className="text-2xl animate-pulse">🤫</span>
                <span>Stop</span>
              </span>
            </button>
          )}
        </div>

        <p className="text-center text-sm text-sky-600 dark:text-sky-400 mb-4 font-medium">
          {isRecording ? (
            <span className="flex items-center justify-center gap-2">
              <span className={recordingDuration < 2 ? "text-orange-500" : "text-green-500"}>
                🔴 Recording... {recordingDuration.toFixed(1)}s
              </span>
              <span className="text-sky-500">
                {recordingDuration < 2 ? "(Keep talking... min 2s)" : "(Click to stop & send)"}
              </span>
            </span>
          ) : isProcessing || emotionState.phase === 'thinking' ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin text-2xl">🧠</span> 
              <span>Hmmm…</span>
            </span>
          ) : emotionState.phase === 'speaking' ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-pulse text-2xl">🗣️</span> 
              <span>Telling a story…</span>
            </span>
          ) : (
            <span>Hold to talk or Speak to SamyBear 🐻</span>
          )}
        </p>

        {/* Transcript Display */}
        {transcriptData && (
          <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm text-gray-600 dark:text-gray-400">You said:</div>
              {/* Hide language label in English-only mode */}
              {process.env.NEXT_PUBLIC_ENGLISH_ONLY_MODE !== 'true' && transcriptData.language && transcriptData.language !== 'English' && (
                <div className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                  🌐 {transcriptData.language}
                </div>
              )}
            </div>
            <div className="text-gray-800 dark:text-gray-200 mb-2">&quot;{transcriptData.cleaned}&quot;</div>
            
            {/* English-only mode warning */}
            {process.env.NEXT_PUBLIC_ENGLISH_ONLY_MODE === 'true' && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                  🇬🇧 English-only mode enabled
                </div>
              </div>
            )}
            
            {/* Non-verbal cues */}
            {transcriptData.nonVerbalCues.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-wrap gap-2">
                  {transcriptData.nonVerbalCues.map((cue, index) => (
                    <div
                      key={index}
                      className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-gray-700 rounded"
                    >
                      <span>{cue.emoji}</span>
                      <span>{cue.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reply Display */}
        {reply && (
          <div className="p-4 bg-sky-100 dark:bg-sky-900/30 rounded-lg border border-sky-300 dark:border-sky-700">
            <div className="text-sm text-sky-600 dark:text-sky-400 mb-1 font-semibold">SamyBear says:</div>
            <div className="text-sky-900 dark:text-sky-200 font-medium text-lg">&quot;{reply}&quot;</div>
          </div>
        )}

        {/* Instructions */}
        {!transcript && !reply && !isRecording && !isProcessing && (
          <div className="text-base text-sky-600 dark:text-sky-400 text-center p-4 font-medium">
            Hold the button and speak to have a voice conversation with SamyBear! 🐻
          </div>
        )}
      </div>

      {/* Performance Metrics - SamyBrain Performance */}
      {metrics && (
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-700">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
            <span>🧠</span> SamyBrain Performance
          </h3>
          
          {/* Detected Latency - Prominent Display */}
          <div className="mb-3 p-3 bg-white dark:bg-gray-800 rounded-lg border-2 border-yellow-300 dark:border-yellow-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🕒</span>
                <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">Response Speed</span>
              </div>
              <div className={`text-2xl font-black ${metrics.total < 5000 ? 'text-green-600' : metrics.total < 10000 ? 'text-yellow-600' : 'text-red-600'}`}>
                {metrics.total}ms {metrics.total < 5000 ? '✅' : '❌'}
              </div>
            </div>
            <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400 font-medium">
              Target: &lt; 5000ms {metrics.total < 5000 ? '✅ PASS' : '❌ FAIL'}
            </div>
          </div>
          
          {/* Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-yellow-200 dark:border-yellow-700">
              <div className="text-yellow-600 dark:text-yellow-400 font-medium">STT</div>
              <div className="font-bold text-blue-600 dark:text-blue-400 text-lg">{metrics.stt}ms</div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-yellow-200 dark:border-yellow-700">
              <div className="text-yellow-600 dark:text-yellow-400 font-medium">GPT</div>
              <div className="font-bold text-purple-600 dark:text-purple-400 text-lg">{metrics.gpt}ms</div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-yellow-200 dark:border-yellow-700">
              <div className="text-yellow-600 dark:text-yellow-400 font-medium">TTS</div>
              <div className="font-bold text-orange-600 dark:text-orange-400 text-lg">{metrics.tts}ms</div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-yellow-200 dark:border-yellow-700">
              <div className="text-yellow-600 dark:text-yellow-400 font-medium">Total</div>
              <div className={`font-bold text-lg ${metrics.total < 5000 ? 'text-green-600' : 'text-red-600'}`}>
                {metrics.total}ms {metrics.total < 5000 ? '✅' : '❌'}
              </div>
            </div>
          </div>
      </div>
      )}
      </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Mode Badge */}
      <div className="text-center text-xs text-sky-600 dark:text-sky-400">
        <span className="px-3 py-1.5 bg-sky-100 dark:bg-sky-900/30 rounded-full border border-sky-300 dark:border-sky-700 font-semibold uppercase tracking-wide">
          🐻 SamyBear 4.0 - Your Curious Teddy Bear Friend 🧸
        </span>
      </div>
      </main>

      {/* Agent Dashboard - Fixed Right Panel */}
      <div className="w-96 flex-shrink-0">
        <AgentDashboard
          logs={debugLogs}
          timings={debugTimings}
          errors={debugErrors}
          data={debugData}
          emotion={emotionState.emotion}
          phase={emotionState.phase}
          energy={emotionState.energy}
          language={emotionState.language}
        />
      </div>
    </div>
  );
}
