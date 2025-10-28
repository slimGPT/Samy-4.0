'use client';

import { useState, useEffect, useRef } from 'react';
import { ensureAnonAuth, ensureState, subscribeState, patchPhase } from '@/lib/firebase';
import type { SessionState } from '@packages/shared';

export default function Home() {
  const [sessionId] = useState('demo-session');
  const [state, setState] = useState<SessionState | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [reply, setReply] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  
  const MIN_RECORDING_TIME = 800; // milliseconds

  /**
   * Centralized phase update utility with debug logging
   */
  const updatePhase = async (newPhase: 'listening' | 'thinking' | 'speaking') => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    console.log(`[${timestamp}] 🔄 Phase transition: ${state?.phase || 'unknown'} → ${newPhase}`);
    
    try {
      await patchPhase(sessionId, newPhase);
      console.log(`[${timestamp}] ✅ Phase updated to: ${newPhase}`);
    } catch (error: any) {
      console.error(`[${timestamp}] ❌ Failed to update phase to ${newPhase}:`, error);
    }
  };

  // Auto-initialize on mount
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    async function initialize() {
      try {
        console.log('🔐 Authenticating...');
        await ensureAnonAuth();
        
        console.log('📝 Ensuring session state...');
        await ensureState(sessionId);
        
        console.log('🔔 Subscribing to state updates...');
        unsubscribe = subscribeState(
          sessionId,
          (newState) => {
            setState(newState);
            setIsConnected(true);
      },
      (err) => {
            console.error('Subscription error:', err);
            setError(`Connection error: ${err.message}`);
            setIsConnected(false);
          }
        );
        
        console.log('✅ Initialization complete');
      } catch (err: any) {
        console.error('Initialization error:', err);
        setError(`Failed to initialize: ${err.message}`);
      }
    }

    initialize();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [sessionId]);

  // Recording duration timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (isRecording && recordingStartTimeRef.current) {
      const startTime = recordingStartTimeRef.current;
      
      // Update immediately
      setRecordingDuration((Date.now() - startTime) / 1000);
      
      // Then update every 100ms for smooth animation
      timer = setInterval(() => {
        setRecordingDuration((Date.now() - startTime) / 1000);
      }, 100);
    } else {
      // Reset duration when not recording
      setRecordingDuration(0);
    }

    // Cleanup function - prevents memory leaks
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [isRecording]); // Re-run when recording state changes

  const startRecording = async () => {
    try {
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
          console.log(`Using audio format: ${mimeType}`);
          break;
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      const startTime = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log(`Audio chunk: ${event.data.size} bytes`);
        }
      };

      mediaRecorder.onstop = async () => {
        const recordingDuration = (Date.now() - startTime) / 1000;
        console.log(`Recording duration: ${recordingDuration.toFixed(2)} seconds`);

        if (recordingDuration < 0.5) {
          stream.getTracks().forEach(track => track.stop());
          setError('Please record for at least 1 second');
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach(track => track.stop());
        
        console.log(`Audio recorded: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
        
        if (audioBlob.size < 1000) {
          setError('Recording too short or no audio captured. Please try again and speak louder.');
      return;
    }

        await processTalk(audioBlob, extension);
      };

      // Request data in 100ms chunks
      mediaRecorder.start(100);
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true); // This triggers the useEffect timer
      console.log('🎤 Recording started...');
      
      // Update Firestore to 'listening' phase
      await updatePhase('listening');
      
      setTranscript('');
      setReply('');
      setError('');
    } catch (err: any) {
      console.error('Error starting recording:', err);
      setError(`Microphone error: ${err.message}`);
      await updatePhase('listening');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Check if recording was long enough
      const recordingDuration = Date.now() - (recordingStartTimeRef.current || 0);
      
      if (recordingDuration < MIN_RECORDING_TIME) {
        console.warn(`⚠️ Recording too short: ${recordingDuration}ms`);
        
        // Cancel the recording
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        
        // Stop all tracks
        if (mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        
        setIsRecording(false); // This triggers useEffect cleanup
        recordingStartTimeRef.current = null;
        
        // Show funny error message
        setError('You gotta say *something*, babe 😘');
        
        // Clear error after 3 seconds
        setTimeout(() => setError(''), 3000);
        
        return;
      }
      
      mediaRecorderRef.current.stop();
      setIsRecording(false); // This triggers useEffect cleanup
      recordingStartTimeRef.current = null;
    }
  };

  // Helper: Fetch with timeout
  const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number = 30000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    }
  };

  const processTalk = async (audioBlob: Blob, extension: string = 'webm') => {
    setIsProcessing(true);
    
    try {
      // Validate audio blob before sending
      if (!audioBlob || audioBlob.size === 0) {
        console.error('❌ Empty audio blob - nothing to transcribe');
        setError('No audio recorded. Please try again.');
        setIsProcessing(false);
        await updatePhase('listening');
        return;
      }

      if (audioBlob.size < 1000) {
        console.warn(`⚠️ Audio blob too small: ${audioBlob.size} bytes`);
        setError('Recording too short. Please speak longer.');
        setIsProcessing(false);
        await updatePhase('listening');
        return;
      }

      // Step 1: Transcribe audio (60s timeout - OpenAI can be slow)
      console.log(`🎧 Step 1: Transcribing audio (${audioBlob.size} bytes, ${audioBlob.type})...`);
      console.log(`🌐 API endpoint: ${API_URL}/listen`);
      console.log(`⏱️ Timeout: 60 seconds`);
      const transcriptionStartTime = Date.now();
      
      const formData = new FormData();
      formData.append('file', audioBlob, `recording.${extension}`);

      let listenRes: Response;
      try {
        listenRes = await fetchWithTimeout(`${API_URL}/listen`, {
          method: 'POST',
          body: formData,
        }, 60000); // 60 second timeout - OpenAI Whisper can be slow
        console.log(`⏱️ Transcription request completed in ${Date.now() - transcriptionStartTime}ms`);
      } catch (fetchError: any) {
        console.error('❌ Transcription error:', fetchError.message);
        if (fetchError.message.includes('timeout')) {
          setError('Transcription timed out. Please try again.');
        } else {
          setError(`Can't reach API server. Is it running?`);
        }
        setIsProcessing(false);
        await updatePhase('listening');
        return;
      }

      if (!listenRes.ok) {
        let errorData: any = { error: 'Unknown error' };
        try {
          errorData = await listenRes.json();
        } catch (parseError) {
          console.error('❌ Failed to parse error response');
          errorData = { 
            error: `HTTP ${listenRes.status}: ${listenRes.statusText}`,
            message: 'Server returned non-JSON error response'
          };
        }
        
        console.error('❌ Transcription failed:', {
          status: listenRes.status,
          statusText: listenRes.statusText,
          error: errorData
        });
        
        // Handle 503 Service Unavailable (Whisper down)
        if (listenRes.status === 503) {
          setError('🎙️ Whisper unavailable — please retry.');
          setIsProcessing(false);
          await updatePhase('listening');
          return;
        }
        
        // User-friendly error messages for other errors
        if (errorData.retry) {
          setError(errorData.message || 'Please try again.');
        } else {
          setError(errorData.error || 'Failed to transcribe audio. Please try again.');
        }
        
        setIsProcessing(false);
        await updatePhase('listening');
        return;
      }

      const listenData = await listenRes.json();
      
      // Validate transcription text
      if (!listenData.text || listenData.text.trim() === '') {
        console.warn('⚠️ Empty transcription received');
        setError('Could not understand audio. Please speak clearly and try again.');
        setIsProcessing(false);
        await updatePhase('listening');
        return;
      }

      console.log('✅ Transcription:', listenData.text);
      setTranscript(listenData.text);

      // Update to 'thinking' phase
      await updatePhase('thinking');

      // Step 2: Get GPT response (45s timeout)
      console.log('🤖 Step 2: Getting GPT response...');
      let chatRes: Response;
      try {
        chatRes = await fetchWithTimeout(`${API_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            message: listenData.text,
          }),
        }, 45000); // 45 second timeout for GPT
      } catch (gptError: any) {
        console.error('❌ GPT request failed:', gptError.message);
        if (gptError.message.includes('timeout')) {
          setError('Candy is taking too long to respond. Please try again.');
        } else {
          setError('Failed to get response from Candy.');
        }
        setIsProcessing(false);
        await updatePhase('listening');
        return;
      }

      if (!chatRes.ok) {
        const errorData = await chatRes.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ GPT failed:', errorData);
        setError(`Candy couldn't respond: ${errorData.error || 'Unknown error'}`);
        setIsProcessing(false);
        await updatePhase('listening');
        return;
      }

      const chatData = await chatRes.json();
      console.log('✅ GPT response:', chatData.reply);
      
      if (!chatData.reply) {
        console.error('❌ GPT returned empty response');
        setError('Candy had nothing to say. Please try again.');
        setIsProcessing(false);
        await updatePhase('listening');
        return;
      }
      
      setReply(chatData.reply);

      // Step 3: Generate speech (60s timeout - TTS can be slow)
      console.log('🔊 Step 3: Generating speech (Arabella voice)...');
      let speakRes: Response;
      try {
        speakRes = await fetchWithTimeout(`${API_URL}/api/speak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            text: chatData.reply,
          }),
        }, 60000); // 60 second timeout for TTS
      } catch (ttsError: any) {
        console.error('❌ TTS request failed:', ttsError.message);
        console.warn('⚠️ Using browser speech synthesis as fallback');
        speakWithBrowser(chatData.reply, sessionId);
        return;
      }

      if (!speakRes.ok) {
        const errorData = await speakRes.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ TTS failed:', errorData);
        console.warn('⚠️ Using browser speech synthesis as fallback');
        speakWithBrowser(chatData.reply, sessionId);
        return;
      }

      const speakData = await speakRes.json();
      console.log('✅ TTS generated:', speakData.audioUrl);

      // Step 4: Play the audio
      console.log('🎵 Step 4: Playing audio...');
      if (speakData.audioUrl) {
        const audio = new Audio(speakData.audioUrl);
        currentAudioRef.current = audio;
        
        audio.onended = async () => {
          console.log('✅ Audio playback finished');
          currentAudioRef.current = null;
          await new Promise(resolve => setTimeout(resolve, 350));
          await updatePhase('listening');
        };

        audio.onerror = async (error) => {
          console.error('❌ Audio playback error:', error);
          setError('Voice playback failed');
          setTimeout(() => setError(''), 3000);
          currentAudioRef.current = null;
          await updatePhase('listening');
        };

        try {
          await audio.play();
          console.log('✅ Audio playing...');
        } catch (error) {
          console.error('❌ Failed to start audio:', error);
          setError('Failed to play audio. Check your browser settings.');
          setTimeout(() => setError(''), 3000);
          await updatePhase('listening');
        }
      } else {
        console.warn('⚠️ No audio URL returned');
        await updatePhase('listening');
      }
    } catch (err: any) {
      console.error('❌ Pipeline error:', err);
      
      // Provide specific error messages based on failure point
      let errorMessage = 'Talk error: ';
      if (err.message.includes('transcribe')) {
        errorMessage += 'Speech recognition failed';
      } else if (err.message.includes('GPT')) {
        errorMessage += 'AI response failed';
      } else if (err.message.includes('TTS') || err.message.includes('speech')) {
        errorMessage += 'Voice generation failed';
      } else if (err.message.includes('play')) {
        errorMessage += 'Audio playback failed';
      } else if (err.message.includes('timeout')) {
        errorMessage += 'Request timed out. Please try again.';
      } else {
        errorMessage += err.message || 'Unknown error';
      }
      
      setError(errorMessage);
      
      // If TTS failed but we have a reply, use browser speech synthesis as fallback
      if (reply && (err.message.includes('TTS') || err.message.includes('speech'))) {
        console.log('🔊 Using browser speech synthesis fallback');
        speakWithBrowser(reply, sessionId);
      } else {
        await updatePhase('listening');
      }
      
      // Clear error after 5 seconds
      setTimeout(() => setError(''), 5000);
    } finally {
      // ALWAYS reset processing state - prevents app from getting stuck
      setIsProcessing(false);
      console.log('✅ Processing state reset');
    }
  };

  // Shut up button - stops audio and returns to listening state (without auto-recording)
  const handleShutUp = async () => {
    console.log('🤫 Shut up button pressed!');
    
    // Stop any playing audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    
    // Cancel browser speech synthesis if active
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    // Clear reply and transcript
    setReply('');
    setTranscript('');
    
    // Return to listening state (user will manually start recording when ready)
    await updatePhase('listening');
  };

  // Browser-based speech synthesis fallback
  const speakWithBrowser = async (text: string, sessionId: string) => {
    if ('speechSynthesis' in window) {
      // Update to speaking phase
      await updatePhase('speaking');
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Try to find a nice voice
      const voices = speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => 
        v.name.includes('Google') || 
        v.name.includes('Microsoft') ||
        v.lang.startsWith('en')
      );
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      utterance.onend = async () => {
        // Add a brief delay (350ms) for smoother UX before returning to listening
        await new Promise(resolve => setTimeout(resolve, 350));
        await updatePhase('listening');
      };
      
      utterance.onerror = async (event) => {
        console.error('Speech synthesis error:', event);
        await updatePhase('listening');
      };
      
      speechSynthesis.speak(utterance);
    } else {
      // No speech synthesis available, just go back to listening
      console.warn('Speech synthesis not supported');
      await updatePhase('listening');
    }
  };

  // Push-to-talk handlers
  const handleMouseDown = () => {
    if (!isProcessing && !isRecording) {
      startRecording();
    }
  };

  const handleMouseUp = () => {
    if (isRecording) {
      stopRecording();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!isProcessing && !isRecording) {
      startRecording();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (isRecording) {
      stopRecording();
    }
  };

  // Get status color based on phase
  const getPhaseColor = () => {
    if (!state) return 'bg-gray-400';
    switch (state.phase) {
      case 'listening': return 'bg-blue-500'; // No pulse when listening (calm state)
      case 'thinking': return 'bg-yellow-500 animate-pulse';
      case 'speaking': return 'bg-green-500 animate-pulse';
      default: return 'bg-gray-400';
    }
  };

  // Get emotion-specific styling
  const getEmotionStyle = () => {
    switch (state?.emotion) {
      case 'flirty':
        return {
          gradient: 'from-pink-500 via-rose-500 to-red-500',
          glow: 'shadow-lg shadow-pink-500/50',
          emoji: '💋',
          bg: 'bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20',
          text: 'text-pink-700 dark:text-pink-300',
          borderColor: 'border-pink-400 dark:border-pink-600',
          pulse: 'animate-pulse',
          subtitle: 'Feeling sexy and playful 💋'
        };
      case 'calm':
        return {
          gradient: 'from-blue-400 via-cyan-400 to-teal-400',
          glow: 'shadow-lg shadow-blue-500/50',
          emoji: '🌸',
          bg: 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20',
          text: 'text-blue-700 dark:text-blue-300',
          borderColor: 'border-blue-400 dark:border-blue-600',
          pulse: '',
          subtitle: 'Taking it easy, just vibing 🌸'
        };
      case 'bitchy':
        return {
          gradient: 'from-red-500 via-orange-500 to-amber-500',
          glow: 'shadow-lg shadow-red-500/50',
          emoji: '😤',
          bg: 'bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20',
          text: 'text-red-700 dark:text-red-300',
          borderColor: 'border-red-400 dark:border-red-600',
          pulse: 'animate-bounce',
          subtitle: 'Rolling her eyes at you 😤'
        };
      case 'sad':
        return {
          gradient: 'from-slate-400 via-blue-400 to-cyan-400',
          glow: 'shadow-lg shadow-slate-500/50',
          emoji: '💙',
          bg: 'bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900/20 dark:to-blue-900/20',
          text: 'text-slate-700 dark:text-slate-300',
          borderColor: 'border-slate-400 dark:border-slate-600',
          pulse: '',
          subtitle: 'Feeling a little down 💙'
        };
      case 'playful':
        return {
          gradient: 'from-yellow-400 via-orange-400 to-pink-400',
          glow: 'shadow-lg shadow-yellow-500/50',
          emoji: '🎉',
          bg: 'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20',
          text: 'text-yellow-700 dark:text-yellow-300',
          borderColor: 'border-yellow-400 dark:border-yellow-600',
          pulse: 'animate-bounce',
          subtitle: 'Ready to have some fun! 🎉'
        };
      case 'angry':
        return {
          gradient: 'from-red-600 via-red-500 to-rose-500',
          glow: 'shadow-lg shadow-red-600/50',
          emoji: '💢',
          bg: 'bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/30 dark:to-rose-900/30',
          text: 'text-red-800 dark:text-red-300',
          borderColor: 'border-red-500 dark:border-red-600',
          pulse: 'animate-pulse',
          subtitle: 'Not in the mood for this 💢'
        };
      case 'affectionate':
        return {
          gradient: 'from-purple-400 via-pink-400 to-rose-400',
          glow: 'shadow-lg shadow-purple-500/50',
          emoji: '💞',
          bg: 'bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20',
          text: 'text-purple-700 dark:text-purple-300',
          borderColor: 'border-purple-400 dark:border-purple-600',
          pulse: 'animate-pulse',
          subtitle: 'Falling for you all over again 💞'
        };
      case 'curious':
        return {
          gradient: 'from-indigo-400 via-purple-400 to-pink-400',
          glow: 'shadow-lg shadow-indigo-500/50',
          emoji: '🤔',
          bg: 'bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20',
          text: 'text-indigo-700 dark:text-indigo-300',
          borderColor: 'border-indigo-400 dark:border-indigo-600',
          pulse: '',
          subtitle: 'Genuinely interested in you 🤔'
        };
      default:
        return {
          gradient: 'from-gray-400 to-gray-500',
          glow: 'shadow-lg shadow-gray-500/50',
          emoji: '💭',
          bg: 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20',
          text: 'text-gray-700 dark:text-gray-300',
          borderColor: 'border-gray-400 dark:border-gray-600',
          pulse: '',
          subtitle: 'Just being herself ✨'
        };
    }
  };

  const emotionStyle = getEmotionStyle();

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">🍬 Candy</h1>
        <p className="text-gray-600 dark:text-gray-400">
              Your sweet AI girlfriend
        </p>
      </div>

          {/* Status Indicators */}
          <div className="flex gap-3">
            {/* Connection Status */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-full">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm font-medium">
                {isConnected ? 'Connected' : 'Connecting...'}
              </span>
            </div>
            
            {/* Phase Status - BIG AND VISIBLE */}
            {state && (
              <div className="flex items-center gap-3 px-5 py-2 bg-gradient-to-r from-pink-100 to-purple-100 dark:from-pink-900/30 dark:to-purple-900/30 rounded-full border-2 border-pink-400 dark:border-pink-600">
                <div className={`w-4 h-4 rounded-full ${getPhaseColor()} shadow-lg ${state.phase === 'listening' ? '' : 'animate-pulse'}`} />
                <span className="text-base font-bold capitalize text-pink-900 dark:text-pink-200">{state.phase}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Emotional State Monitor */}
      {state && (
        <div className={`${emotionStyle.bg} ${emotionStyle.borderColor} border-2 rounded-2xl ${emotionStyle.glow} p-6 mb-6 transition-all duration-700 ease-in-out`}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <span>💭 Emotional State</span>
            </h2>
            <div className="flex items-center gap-3 px-4 py-2 bg-white/50 dark:bg-black/30 backdrop-blur-sm rounded-full border border-white/30">
              <div className={`w-4 h-4 rounded-full ${getPhaseColor()} shadow-lg`} />
              <span className="text-sm font-bold capitalize">{state.phase}</span>
            </div>
          </div>
          
          {/* Emotion Display - Big and Animated */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Current Emotion</span>
            </div>
            <div className={`flex items-center gap-4 p-4 bg-white/60 dark:bg-black/40 backdrop-blur-sm rounded-xl border-2 ${emotionStyle.borderColor} ${emotionStyle.glow} transition-all duration-500`}>
              <div className={`text-6xl ${emotionStyle.pulse}`}>
                {emotionStyle.emoji}
              </div>
              <div className="flex-1">
                <div className={`text-3xl font-black capitalize ${emotionStyle.text} transition-all duration-500`}>
                  {state.emotion}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {emotionStyle.subtitle}
                </div>
              </div>
            </div>
          </div>

          {/* Energy Level - Animated Bar */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Energy Level</span>
              <span className={`text-2xl font-black ${emotionStyle.text} transition-all duration-500`}>
                {Math.round(state.energy * 100)}%
              </span>
            </div>
            <div className="relative">
              {/* Background bar */}
              <div className="w-full bg-white/60 dark:bg-black/40 rounded-full h-6 overflow-hidden border-2 border-white/30">
                {/* Animated energy bar with glow */}
                <div
                  className={`bg-gradient-to-r ${emotionStyle.gradient} h-full transition-all duration-1000 ease-out relative`}
                  style={{ width: `${state.energy * 100}%` }}
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                  {/* Pulse glow */}
                  <div className={`absolute inset-0 ${emotionStyle.glow} animate-pulse`} />
                </div>
              </div>
              {/* Energy level indicators */}
              <div className="flex justify-between mt-1 px-1">
                <span className="text-xs text-gray-500">Low</span>
                <span className="text-xs text-gray-500">Medium</span>
                <span className="text-xs text-gray-500">High</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Talk Interface */}
      <div className="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 rounded-lg shadow-md p-8 mb-6 border-2 border-pink-200 dark:border-pink-700">
        <h2 className="text-2xl font-semibold mb-6 text-center">💕 Talk to Candy</h2>
        
        {/* Push-to-Talk Mic Button + Shut Up Button */}
        <div className="flex justify-center items-center gap-4 mb-6">
          <button
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            disabled={isProcessing}
            className={`w-32 h-32 rounded-full font-bold text-2xl transition-all transform shadow-lg select-none ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 text-white scale-110 animate-pulse'
                : isProcessing
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-pink-500 hover:bg-pink-600 text-white hover:scale-105 active:scale-95'
            }`}
            style={{ touchAction: 'none' }}
          >
            {isRecording ? (
              <>🔴</>
            ) : isProcessing ? (
              <>⏳</>
            ) : (
              <>🎤</>
            )}
          </button>
          
          {/* Mute Button - Shows when Candy is speaking */}
          {(state?.phase === 'speaking' || reply) && !isRecording && (
          <button
              onClick={handleShutUp}
              title="Stop her from talking (you can resume when ready)"
              className="group relative px-8 py-4 bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 hover:from-red-600 hover:via-pink-600 hover:to-purple-600 text-white font-bold text-lg rounded-full shadow-xl transform transition-all hover:scale-105 active:scale-95 border-2 border-white/30"
          >
              <span className="flex items-center gap-3">
                <span className="text-3xl animate-pulse">🤫</span>
                <span>Shut up!</span>
              </span>
          </button>
          )}
        </div>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-6">
          {isRecording ? (
            <span className="flex items-center justify-center gap-2">
              🔴 Recording... {recordingDuration.toFixed(1)}s (Release to send)
            </span>
          ) : isProcessing || state?.phase === 'thinking' ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">🧠</span> Thinking...
            </span>
          ) : state?.phase === 'speaking' ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-pulse">🗣️</span> Speaking...
            </span>
          ) : (
            <span>Hold to talk</span>
          )}
        </p>

        {/* Transcript Display */}
        {transcript && (
          <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">You said:</div>
            <div className="text-gray-800 dark:text-gray-200">&quot;{transcript}&quot;</div>
          </div>
        )}

        {/* Reply Display */}
        {reply && (
          <div className="p-4 bg-pink-100 dark:bg-pink-900/30 rounded-lg border border-pink-300 dark:border-pink-700">
            <div className="text-sm text-pink-600 dark:text-pink-400 mb-1">Candy says:</div>
            <div className="text-pink-900 dark:text-pink-200 font-medium">&quot;{reply}&quot;</div>
          </div>
        )}

        {/* Instructions */}
        {!transcript && !reply && !isRecording && !isProcessing && (
          <div className="text-sm text-gray-600 dark:text-gray-400 text-center p-4">
            Hold the button and speak to have a voice conversation with Candy! 🍬
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Optional: Session ID Display (for debugging) */}
      <div className="text-center text-xs text-gray-500">
        Session: {sessionId}
        </div>
    </main>
  );
}
