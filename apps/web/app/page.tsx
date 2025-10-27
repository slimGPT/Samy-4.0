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
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach(track => track.stop());
        
        console.log(`Audio recorded: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
        await processTalk(audioBlob, extension);
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      // Update Firestore to 'listening' phase
      await patchPhase(sessionId, 'listening');
      
      setTranscript('');
      setReply('');
      setError('');
    } catch (err: any) {
      console.error('Error starting recording:', err);
      setError(`Microphone error: ${err.message}`);
      await patchPhase(sessionId, 'idle');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processTalk = async (audioBlob: Blob, extension: string = 'webm') => {
    setIsProcessing(true);
    
    try {
      // Step 1: Transcribe audio
      const formData = new FormData();
      formData.append('file', audioBlob, `recording.${extension}`);

      const listenRes = await fetch(`${API_URL}/listen`, {
        method: 'POST',
        body: formData,
      });

      if (!listenRes.ok) {
        const errorData = await listenRes.json();
        console.error('Transcription error:', errorData);
        throw new Error(errorData.error || 'Failed to transcribe audio');
      }

      const listenData = await listenRes.json();
      setTranscript(listenData.text);

      // Update to 'thinking' phase
      await patchPhase(sessionId, 'thinking');

      // Step 2: Get GPT response
      const chatRes = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: listenData.text,
        }),
      });

      if (!chatRes.ok) {
        throw new Error('Failed to get response');
      }

      const chatData = await chatRes.json();
      setReply(chatData.reply);

      // Step 3: Generate speech (phase will be updated by server)
      const speakRes = await fetch(`${API_URL}/api/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          text: chatData.reply,
        }),
      });

      if (!speakRes.ok) {
        console.warn('TTS failed, using browser speech synthesis');
        // Use browser speech as fallback
        speakWithBrowser(chatData.reply, sessionId);
        return;
      }

      const speakData = await speakRes.json();

      // Step 4: Play the audio
      if (speakData.audioUrl) {
        const audio = new Audio(speakData.audioUrl);
        audio.play();

        // Return to idle after audio finishes
        audio.onended = async () => {
          await patchPhase(sessionId, 'idle');
        };
      } else {
        await patchPhase(sessionId, 'idle');
      }
    } catch (err: any) {
      console.error('Error in talk process:', err);
      
      // If TTS failed but we have a reply, use browser speech synthesis as fallback
      if (reply && err.message.includes('Failed to generate speech')) {
        console.log('🔊 Using browser speech synthesis fallback');
        speakWithBrowser(reply, sessionId);
      } else {
        setError(`Talk error: ${err.message}`);
        await patchPhase(sessionId, 'idle');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Browser-based speech synthesis fallback
  const speakWithBrowser = async (text: string, sessionId: string) => {
    if ('speechSynthesis' in window) {
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
        await patchPhase(sessionId, 'idle');
      };
      
      utterance.onerror = async (event) => {
        console.error('Speech synthesis error:', event);
        await patchPhase(sessionId, 'idle');
      };
      
      speechSynthesis.speak(utterance);
    } else {
      // No speech synthesis available, just go back to idle
      console.warn('Speech synthesis not supported');
      await patchPhase(sessionId, 'idle');
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
      case 'listening': return 'bg-blue-500 animate-pulse';
      case 'thinking': return 'bg-yellow-500 animate-pulse';
      case 'speaking': return 'bg-green-500 animate-pulse';
      default: return 'bg-gray-400';
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">🐻 Samy</h1>
        <p className="text-gray-600 dark:text-gray-400">
              Your AI companion
        </p>
      </div>

          {/* Live Status Indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>
      </div>

      {/* Current State Display */}
      {state && (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Status</h2>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${getPhaseColor()}`} />
              <span className="text-sm font-medium capitalize">{state.phase}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Emotion</span>
              <div className="text-lg font-bold capitalize">{state.emotion}</div>
            </div>
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Energy</span>
              <div className="text-lg font-bold">{Math.round(state.energy * 100)}%</div>
        </div>
      </div>

          {/* Energy Bar */}
          <div className="mt-4">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-500"
                style={{ width: `${state.energy * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Talk Interface */}
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg shadow-md p-8 mb-6 border-2 border-purple-200 dark:border-purple-700">
        <h2 className="text-2xl font-semibold mb-6 text-center">🎙️ Talk to Samy</h2>
        
        {/* Push-to-Talk Mic Button */}
        <div className="flex justify-center mb-6">
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
                : 'bg-purple-500 hover:bg-purple-600 text-white hover:scale-105 active:scale-95'
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
        </div>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-6">
          {isRecording
            ? 'Recording... Release to send'
            : isProcessing
            ? 'Processing...'
            : 'Hold to talk'}
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
          <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-lg border border-purple-300 dark:border-purple-700">
            <div className="text-sm text-purple-600 dark:text-purple-400 mb-1">Samy says:</div>
            <div className="text-purple-900 dark:text-purple-200 font-medium">&quot;{reply}&quot;</div>
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
