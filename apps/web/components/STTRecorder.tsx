'use client';

/**
 * STT Recorder Component
 * 
 * Uses the proven working STT code from stt-clean-ui.html
 * Records audio → Sends to /listen → Returns transcript
 */

import { useState, useRef, useCallback } from 'react';

interface STTRecorderProps {
  onTranscript: (transcript: string) => void;
  onError?: (error: string) => void;
  apiUrl?: string;
}

export default function STTRecorder({ 
  onTranscript, 
  onError,
  apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
}: STTRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      console.log('🎤 [STT] Requesting microphone access...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      console.log('✅ [STT] Microphone access granted');
      
      // Determine best audio format (from working test code)
      let mimeType = 'audio/webm';
      const formats = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus'
      ];
      
      for (const format of formats) {
        if (MediaRecorder.isTypeSupported(format)) {
          mimeType = format;
          break;
        }
      }
      
      console.log(`[STT] Using audio format: ${mimeType}`);
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log(`[STT] Audio chunk: ${event.data.size} bytes`);
        }
      };
      
      mediaRecorder.onstop = async () => {
        console.log('[STT] Recording stopped');
        
        // Stop all tracks
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop());
          audioStreamRef.current = null;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const totalSize = audioBlob.size;
        
        console.log(`[STT] Total audio size: ${totalSize} bytes (${(totalSize / 1024).toFixed(2)} KB)`);
        
        if (totalSize < 1000) {
          console.warn('[STT] Audio too short');
          onError?.('Recording too short. Please speak for at least 2 seconds.');
          setIsRecording(false);
          setIsProcessing(false);
          return;
        }
        
        await sendForTranscription(audioBlob, mimeType);
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setIsProcessing(false);
      
      console.log('🎤 [STT] Recording started...');
      
    } catch (error: any) {
      console.error('[STT] Error accessing microphone:', error);
      onError?.(`Microphone error: ${error.message}`);
      setIsRecording(false);
      setIsProcessing(false);
    }
  }, [onError]);

  const stopRecording = useCallback(() => {
    console.log('[STT] Stop button clicked');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log(`[STT] MediaRecorder state: ${mediaRecorderRef.current.state}`);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    } else {
      console.warn('[STT] Cannot stop: MediaRecorder not active');
      // Force cleanup
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
      setIsRecording(false);
      setIsProcessing(false);
    }
  }, []);

  const sendForTranscription = useCallback(async (audioBlob: Blob, mimeType: string) => {
    try {
      setIsProcessing(true);
      console.log('📤 [STT] Sending audio to /listen...');
      
      // Prepare FormData (using working format from test)
      const formData = new FormData();
      const extension = mimeType.includes('webm') ? 'webm' : 
                       mimeType.includes('mp4') ? 'mp4' : 
                       mimeType.includes('ogg') ? 'ogg' : 'wav';
      
      formData.append('file', audioBlob, `recording.${extension}`);
      
      console.log(`[STT] File size: ${audioBlob.size} bytes`);
      console.log(`[STT] Format: ${mimeType}`);
      console.log(`[STT] Extension: ${extension}`);
      
      const startTime = Date.now();
      
      // Send to /listen endpoint (uses ElevenLabs STT)
      const response = await fetch(`${apiUrl}/listen`, {
        method: 'POST',
        body: formData
      });
      
      const duration = Date.now() - startTime;
      console.log(`📥 [STT] Response: ${response.status} ${response.statusText} (${duration}ms)`);
      
      if (!response.ok) {
        let errorData;
        try {
          const text = await response.text();
          console.error('[STT] Error response:', text);
          errorData = JSON.parse(text);
        } catch (parseError) {
          errorData = { error: `Server error: ${response.status} ${response.statusText}` };
        }
        
        const errorMsg = errorData.detail || errorData.error || errorData.message || `Server error: ${response.status}`;
        console.error('[STT] Transcription failed:', errorMsg);
        throw new Error(errorMsg);
      }
      
      // Parse response
      const data = await response.json();
      console.log('[STT] Response data:', data);
      
      const transcript = data.text || data.transcript || '';
      
      if (!transcript || transcript.trim() === '') {
        console.warn('[STT] Empty transcription received');
        throw new Error('Empty transcription from API');
      }
      
      console.log(`✅ [STT] Transcription successful: "${transcript}"`);
      
      // Call the callback with transcript
      onTranscript(transcript.trim());
      
    } catch (error: any) {
      console.error('[STT] Transcription error:', error);
      onError?.(error.message || 'Transcription failed');
    } finally {
      setIsProcessing(false);
    }
  }, [apiUrl, onTranscript, onError]);

  const handleToggleRecording = useCallback(() => {
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return (
    <button
      onClick={handleToggleRecording}
      disabled={isProcessing}
      className={`
        px-6 py-3 rounded-full font-semibold text-lg transition-all
        ${isRecording 
          ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
          : isProcessing
          ? 'bg-yellow-500 text-white opacity-75 cursor-not-allowed'
          : 'bg-blue-500 hover:bg-blue-600 text-white'
        }
      `}
    >
      {isProcessing 
        ? '⏳ Processing...' 
        : isRecording 
        ? '⏹️ Stop Recording' 
        : '🎤 Start Recording'
      }
    </button>
  );
}

