'use client';

/**
 * FULL MODE - Candy AI Web Interface
 * Complete experience with emotions, neon styling, and dynamic energy bar
 * 🎤 ElevenLabs STT → 🧠 GPT-4o → 🎭 Emotion Engine → 🗣️ ElevenLabs TTS → 🔥 Firebase
 */

import { useState, useRef } from 'react';

interface EmotionState {
  emotion: string;
  energy: number;
  phase: 'listening' | 'thinking' | 'speaking';
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [reply, setReply] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [metrics, setMetrics] = useState<any>(null);
  const [emotionState, setEmotionState] = useState<EmotionState>({
    emotion: 'neutral',
    energy: 0.75,
    phase: 'listening',
  });
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const MIN_RECORDING_TIME = 800; // milliseconds

  const startRecording = async () => {
    try {
      console.log('🎤 Starting recording...');
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

        if (recordingDuration < 0.5) {
          stream.getTracks().forEach(track => track.stop());
          setError('Please record for at least 1 second');
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach(track => track.stop());
        
        console.log(`📦 Audio blob size: ${audioBlob.size} bytes`);
        
        if (audioBlob.size < 1000) {
          setError('Recording too short or no audio captured. Please try again.');
          return;
        }

        await processPipeline(audioBlob, extension);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setTranscript('');
      setReply('');
      setError('');
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

  const processPipeline = async (audioBlob: Blob, extension: string) => {
    setIsProcessing(true);
    setEmotionState(prev => ({ ...prev, phase: 'thinking' }));
    setError('');

    try {
      const pipelineStartTime = Date.now();

      // Step 1: Transcribe audio
      console.log('\n🎤 [ELEVENLABS-STT] Sending audio for transcription...');
      const listenStartTime = Date.now();
      
      const formData = new FormData();
      formData.append('audio', audioBlob, `recording.${extension}`);

      const listenRes = await fetch(`${API_URL}/listen`, {
        method: 'POST',
        body: formData,
      });

      if (!listenRes.ok) {
        const errorData = await listenRes.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ [ELEVENLABS-STT] Failed:', errorData);
        setError(errorData.error || 'Failed to transcribe audio');
        setIsProcessing(false);
        setEmotionState(prev => ({ ...prev, phase: 'listening' }));
        return;
      }

      const listenData = await listenRes.json();
      const transcriptionDuration = Date.now() - listenStartTime;
      
      console.log(`✅ [ELEVENLABS-STT] Transcribed: "${listenData.text}"`);
      console.log(`⏱️ [ELEVENLABS-STT] Duration: ${transcriptionDuration}ms`);
      setTranscript(listenData.text);

      // Step 2: Get GPT response and generate speech in one call
      console.log('\n🧠 [GPT] → 🗣️ [ELEVENLABS] Calling /talk endpoint...');
      const talkStartTime = Date.now();
      
      const talkRes = await fetch(`${API_URL}/talk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: listenData.text }),
      });

      if (!talkRes.ok) {
        const errorData = await talkRes.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ [TALK] Failed:', errorData);
        setError(errorData.error || 'Failed to generate response');
        setIsProcessing(false);
        setEmotionState(prev => ({ ...prev, phase: 'listening' }));
        return;
      }

      const talkData = await talkRes.json();
      const talkDuration = Date.now() - talkStartTime;
      
      console.log(`✅ [GPT] Response: "${talkData.reply}"`);
      console.log(`✅ [ELEVENLABS] Voice generated: ${talkData.audioUrl}`);
      console.log(`⏱️ [TALK] Duration: ${talkDuration}ms`);
      
      // Update emotion and energy from API response
      if (talkData.emotion) {
        console.log(`🎭 [EMOTION] ${talkData.emotion}`);
        // Calculate energy based on emotion type (simulate dynamic energy)
        const energyMap: Record<string, number> = {
          flirty: 0.85,
          playful: 0.90,
          excited: 0.95,
          caring: 0.70,
          affectionate: 0.75,
          calm: 0.60,
          sad: 0.40,
          angry: 0.80,
          bitchy: 0.75,
          curious: 0.70,
          neutral: 0.65,
        };
        
        setEmotionState({
          emotion: talkData.emotion,
          energy: energyMap[talkData.emotion] || 0.65,
          phase: 'speaking',
        });
      }
      
      setReply(talkData.reply);

      // Display metrics
      const totalDuration = Date.now() - pipelineStartTime;
      const metricsData = {
        stt: transcriptionDuration,
        gpt: talkData.metrics?.gpt || 0,
        tts: talkData.metrics?.tts || 0,
        total: totalDuration,
      };
      setMetrics(metricsData);
      
      console.log('\n⏱️ [METRICS] Full Pipeline:');
      console.log(`   - ElevenLabs STT: ${metricsData.stt}ms`);
      console.log(`   - GPT: ${metricsData.gpt}ms`);
      console.log(`   - ElevenLabs TTS: ${metricsData.tts}ms`);
      console.log(`   - Total: ${metricsData.total}ms`);
      console.log(`   - Target: < 3000ms (${metricsData.total < 3000 ? '✅ PASS' : '❌ FAIL'})\n`);

      // Step 3: Play the audio
      if (talkData.audioUrl) {
        console.log('🎵 Playing audio...');
        const audio = new Audio(talkData.audioUrl);
        currentAudioRef.current = audio;
        
        audio.onended = () => {
          console.log('✅ Audio playback finished');
          currentAudioRef.current = null;
          setEmotionState(prev => ({ ...prev, phase: 'listening' }));
        };

        audio.onerror = (error) => {
          console.error('❌ Audio playback error:', error);
          setError('Voice playback failed');
          currentAudioRef.current = null;
          setEmotionState(prev => ({ ...prev, phase: 'listening' }));
        };

        await audio.play();
        console.log('✅ Audio playing...');
      }
    } catch (err: any) {
      console.error('❌ Pipeline error:', err);
      setError(`Error: ${err.message || 'Unknown error'}`);
      setEmotionState(prev => ({ ...prev, phase: 'listening' }));
    } finally {
      setIsProcessing(false);
    }
  };

  // Stop audio playback ("Shut up" button)
  const handleStopAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
      setEmotionState(prev => ({ ...prev, phase: 'listening' }));
      console.log('🤫 Audio stopped by user');
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
    switch (emotionState.phase) {
      case 'listening': return 'bg-blue-500';
      case 'thinking': return 'bg-yellow-500 animate-pulse';
      case 'speaking': return 'bg-green-500 animate-pulse';
      default: return 'bg-gray-400';
    }
  };

  // Get emotion-specific styling
  const getEmotionStyle = () => {
    switch (emotionState.emotion) {
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
      case 'caring':
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
      case 'excited':
        return {
          gradient: 'from-orange-400 via-red-400 to-pink-400',
          glow: 'shadow-lg shadow-orange-500/50',
          emoji: '🤩',
          bg: 'bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20',
          text: 'text-orange-700 dark:text-orange-300',
          borderColor: 'border-orange-400 dark:border-orange-600',
          pulse: 'animate-bounce',
          subtitle: 'Super pumped right now! 🤩'
        };
      case 'romantic':
        return {
          gradient: 'from-rose-400 via-pink-500 to-red-500',
          glow: 'shadow-lg shadow-rose-500/50',
          emoji: '💕',
          bg: 'bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20',
          text: 'text-rose-700 dark:text-rose-300',
          borderColor: 'border-rose-400 dark:border-rose-600',
          pulse: 'animate-pulse',
          subtitle: 'Lost in the moment with you 💕'
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
    <main className="min-h-screen p-8 max-w-4xl mx-auto bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-gray-900">
      {/* Header */}
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
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium">Connected</span>
            </div>
            
            {/* Phase Status - BIG AND VISIBLE */}
            <div className="flex items-center gap-3 px-5 py-2 bg-gradient-to-r from-pink-100 to-purple-100 dark:from-pink-900/30 dark:to-purple-900/30 rounded-full border-2 border-pink-400 dark:border-pink-600">
              <div className={`w-4 h-4 rounded-full ${getPhaseColor()} shadow-lg ${emotionState.phase === 'listening' ? '' : 'animate-pulse'}`} />
              <span className="text-base font-bold capitalize text-pink-900 dark:text-pink-200">{emotionState.phase}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Emotional State Monitor */}
      <div className={`${emotionStyle.bg} ${emotionStyle.borderColor} border-2 rounded-2xl ${emotionStyle.glow} p-6 mb-6 transition-all duration-700 ease-in-out`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span>💭 Emotional State</span>
          </h2>
          <div className="flex items-center gap-3 px-4 py-2 bg-white/50 dark:bg-black/30 backdrop-blur-sm rounded-full border border-white/30">
            <div className={`w-4 h-4 rounded-full ${getPhaseColor()} shadow-lg`} />
            <span className="text-sm font-bold capitalize">{emotionState.phase}</span>
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
                {emotionState.emotion}
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
              {Math.round(emotionState.energy * 100)}%
            </span>
          </div>
          <div className="relative">
            {/* Background bar */}
            <div className="w-full bg-white/60 dark:bg-black/40 rounded-full h-6 overflow-hidden border-2 border-white/30">
              {/* Animated energy bar with glow */}
              <div
                className={`bg-gradient-to-r ${emotionStyle.gradient} h-full transition-all duration-1000 ease-out relative`}
                style={{ width: `${emotionState.energy * 100}%` }}
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
          {emotionState.phase === 'speaking' && currentAudioRef.current && !isRecording && (
            <button
              onClick={handleStopAudio}
              title="Stop her from talking"
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
          ) : isProcessing || emotionState.phase === 'thinking' ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">🧠</span> Thinking...
            </span>
          ) : emotionState.phase === 'speaking' ? (
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

      {/* Performance Metrics */}
      {metrics && (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-6 border border-gray-300 dark:border-gray-700">
          <h3 className="text-sm font-bold mb-2">⚡ Performance Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div>
              <div className="text-gray-500">STT</div>
              <div className="font-bold">{metrics.stt}ms</div>
            </div>
            <div>
              <div className="text-gray-500">GPT</div>
              <div className="font-bold">{metrics.gpt}ms</div>
            </div>
            <div>
              <div className="text-gray-500">TTS</div>
              <div className="font-bold">{metrics.tts}ms</div>
            </div>
            <div>
              <div className="text-gray-500">Total</div>
              <div className={`font-bold ${metrics.total < 3000 ? 'text-green-600' : 'text-red-600'}`}>
                {metrics.total}ms {metrics.total < 3000 ? '✅' : '❌'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Mode Badge */}
      <div className="text-center text-xs text-gray-500">
        <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-full border border-purple-300 dark:border-purple-700">
          🔥 Full Mode Active - Firebase + Emotions + AI
        </span>
      </div>
    </main>
  );
}
