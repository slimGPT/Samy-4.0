/**
 * AssemblyAI Real-Time Streaming STT Service
 * Uses WebSocket for real-time transcription as user speaks
 * Processes audio chunks during recording, not after
 */

import { RealtimeTranscriber } from 'assemblyai';

export interface StreamingSTTResult {
  transcript: string;
  isFinal: boolean;
  confidence?: number;
  duration: number;
  language?: string;
}

export interface StreamingSTTOptions {
  language?: string;
  sampleRate?: number;
}

/**
 * Real-time streaming transcription using AssemblyAI WebSocket
 * Processes audio chunks as they arrive
 */
export class AssemblyAIStreamingSTT {
  private transcriber: RealtimeTranscriber | null = null;
  private transcript: string = '';
  private isFinal: boolean = false;
  private confidence: number = 0;
  private language: string = 'en';
  private startTime: number = 0;

  constructor() {
    if (!process.env.ASSEMBLYAI_API_KEY) {
      throw new Error('ASSEMBLYAI_API_KEY is not configured');
    }
  }

  /**
   * Start real-time transcription session
   */
  async start(options: StreamingSTTOptions = {}): Promise<void> {
    this.startTime = Date.now();
    this.transcript = '';
    this.isFinal = false;
    this.language = options.language || 'en';

    this.transcriber = new RealtimeTranscriber({
      apiKey: process.env.ASSEMBLYAI_API_KEY!,
      sampleRate: options.sampleRate || 16000,
      wordBoost: ['SamyBear', 'Samy', 'hello', 'hi', 'hey'],
    });

    // Handle partial transcripts (real-time updates)
    this.transcriber.on('transcript', (transcript: any) => {
      if (transcript?.text) {
        this.transcript = transcript.text;
      }

      if (typeof transcript?.confidence === 'number') {
        this.confidence = transcript.confidence;
      }

      if (typeof transcript?.languageCode === 'string') {
        this.language = transcript.languageCode;
      } else if (typeof transcript?.language === 'string') {
        this.language = transcript.language;
      }

      if (typeof transcript?.isFinal === 'boolean') {
        this.isFinal = transcript.isFinal;
      } else if (transcript?.message_type) {
        this.isFinal = transcript.message_type === 'FinalTranscript';
      }
    });

    // Handle errors
    this.transcriber.on('error', (error) => {
      console.error('❌ [ASSEMBLYAI-STREAMING] Error:', error);
    });

    // Handle session start
    this.transcriber.on('open', () => {
      console.log('✅ [ASSEMBLYAI-STREAMING] Session started');
    });

    // Handle session end
    this.transcriber.on('close', () => {
      console.log('🔌 [ASSEMBLYAI-STREAMING] Session ended');
    });

    await this.transcriber.connect();
  }

  /**
   * Send audio chunk for transcription
   */
  async sendAudioChunk(audioChunk: Buffer): Promise<void> {
    if (!this.transcriber) {
      throw new Error('Transcriber not started. Call start() first.');
    }
    
    const arrayBuffer = audioChunk.buffer.slice(
      audioChunk.byteOffset,
      audioChunk.byteOffset + audioChunk.byteLength
    );

    await this.transcriber.sendAudio(arrayBuffer);
  }

  /**
   * Get current transcript (may be partial)
   */
  getCurrentTranscript(): StreamingSTTResult {
    const duration = Date.now() - this.startTime;
    
    return {
      transcript: this.transcript,
      isFinal: this.isFinal,
      confidence: this.confidence,
      duration,
      language: this.language,
    };
  }

  /**
   * Wait for final transcript or timeout
   */
  async waitForFinal(maxWaitMs: number = 5000): Promise<StreamingSTTResult> {
    const startWait = Date.now();
    
    while (!this.isFinal && (Date.now() - startWait) < maxWaitMs) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return this.getCurrentTranscript();
  }

  /**
   * Close transcription session
   */
  async close(): Promise<StreamingSTTResult> {
    if (this.transcriber) {
      // Wait a bit for final transcript
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.transcriber.close();
      this.transcriber = null;
    }

    return this.getCurrentTranscript();
  }
}

/**
 * Fast transcription using AssemblyAI streaming (for compatibility)
 */
export async function transcribeWithStreaming(
  audioBuffer: Buffer,
  options: StreamingSTTOptions = {}
): Promise<StreamingSTTResult> {
  const startTime = Date.now();
  
  if (!process.env.ASSEMBLYAI_API_KEY) {
    throw new Error('ASSEMBLYAI_API_KEY is not configured');
  }

  console.log('🎧 [ASSEMBLYAI-STREAMING] Starting real-time transcription...');
  console.log(`   Audio size: ${audioBuffer.length} bytes`);

  const transcriber = new AssemblyAIStreamingSTT();
  
  try {
    await transcriber.start(options);
    
    // Send audio in chunks (simulate streaming)
    const chunkSize = 4096;
    for (let i = 0; i < audioBuffer.length; i += chunkSize) {
      const chunk = audioBuffer.slice(i, i + chunkSize);
      await transcriber.sendAudioChunk(chunk);
    }

    // Wait for final transcript
    const result = await transcriber.waitForFinal(3000);
    await transcriber.close();

    const duration = Date.now() - startTime;
    console.log(`✅ [ASSEMBLYAI-STREAMING] Transcription complete in ${duration}ms`);
    console.log(`   Transcript: "${result.transcript}"`);

    return {
      ...result,
      duration,
    };
  } catch (error: any) {
    await transcriber.close().catch(() => {});
    const duration = Date.now() - startTime;
    console.error('❌ [ASSEMBLYAI-STREAMING] Transcription failed:', error.message);
    throw new Error(`AssemblyAI streaming transcription failed: ${error.message}`);
  }
}

