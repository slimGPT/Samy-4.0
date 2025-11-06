'use client';

/**
 * Debug Panel Component
 * 
 * Shows real-time logs, timings, errors, and data for the STT → GPT → TTS pipeline
 */

import { useState, useEffect, useRef } from 'react';

export interface LogEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'warn';
  stage?: 'recording' | 'stt' | 'gpt' | 'tts';
  data?: any;
}

export interface Timing {
  stage: string;
  duration: number;
  color: 'green' | 'yellow' | 'red';
}

export interface DebugData {
  audioSize?: number;
  transcript?: string;
  rawTranscript?: string;
  language?: string;
  nonVerbalCues?: Array<{ emoji: string; label: string; rawTag: string }>;
  gptPrompt?: string;
  systemMessage?: string;
  voiceModel?: string;
  audioUrl?: string;
}

interface DebugPanelProps {
  logs: LogEntry[];
  timings: Timing[];
  errors: string[];
  data: DebugData;
}

export default function DebugPanel({ logs, timings, errors, data }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isOpen && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 2 
    });
  };

  const getTimingColor = (duration: number): 'green' | 'yellow' | 'red' => {
    if (duration < 2000) return 'green';
    if (duration < 5000) return 'yellow';
    return 'red';
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="mb-6">
      {/* Toggle Button - Bear Tech Toolbox */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg border border-yellow-300 dark:border-yellow-700 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
      >
        <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">
          🔧 Bear Tech Toolbox {errors.length > 0 && `(${errors.length} error${errors.length > 1 ? 's' : ''})`}
        </span>
        <span className="text-xs text-yellow-600 dark:text-yellow-400">
          {isOpen ? '▼ Collapse' : '▶ Expand'}
        </span>
      </button>

      {/* Panel Content */}
      {isOpen && (
        <div className="mt-2 bg-gray-900 rounded-lg border border-gray-700 p-4 max-h-96 overflow-y-auto">
          {/* Timings */}
          {timings.length > 0 && (
            <div className="mb-4 pb-4 border-b border-gray-700">
              <h3 className="text-sm font-bold text-gray-300 mb-2">📊 Timings</h3>
              <div className="grid grid-cols-2 gap-2">
                {timings.map((timing, index) => (
                  <div
                    key={index}
                    className={`px-3 py-2 rounded border ${
                      timing.color === 'green'
                        ? 'bg-green-900/30 border-green-700 text-green-300'
                        : timing.color === 'yellow'
                        ? 'bg-yellow-900/30 border-yellow-700 text-yellow-300'
                        : 'bg-red-900/30 border-red-700 text-red-300'
                    }`}
                  >
                    <div className="text-xs font-medium">{timing.stage}</div>
                    <div className="text-sm font-bold">{formatDuration(timing.duration)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mb-4 pb-4 border-b border-gray-700">
              <h3 className="text-sm font-bold text-red-400 mb-2">🛑 Errors</h3>
              <div className="space-y-2">
                {errors.map((error, index) => (
                  <div
                    key={index}
                    className="px-3 py-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm"
                  >
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data */}
          {(data.audioSize || data.transcript || data.rawTranscript || data.language || data.nonVerbalCues || data.gptPrompt || data.voiceModel || data.audioUrl) && (
            <div className="mb-4 pb-4 border-b border-gray-700">
              <h3 className="text-sm font-bold text-gray-300 mb-2">📦 Data</h3>
              <div className="space-y-1 text-xs font-mono text-gray-400">
                {data.audioSize && (
                  <div>
                    <span className="text-gray-500">Audio Size:</span> {data.audioSize} bytes ({(
                      data.audioSize / 1024
                    ).toFixed(2)} KB)
                  </div>
                )}
                {data.rawTranscript && (
                  <div className="pt-1">
                    <span className="text-gray-500">Raw Transcript:</span>
                    <div className="mt-1 p-2 bg-gray-800 rounded text-gray-300">
                      &quot;{data.rawTranscript}&quot;
                    </div>
                  </div>
                )}
                {data.transcript && (
                  <div className="pt-1">
                    <span className="text-gray-500">Cleaned Transcript:</span>
                    <div className="mt-1 p-2 bg-gray-800 rounded text-gray-300">
                      &quot;{data.transcript}&quot;
                    </div>
                  </div>
                )}
                {data.language && (
                  <div>
                    <span className="text-gray-500">🌐 Detected Language:</span> <span className="text-blue-400">{data.language}</span>
                  </div>
                )}
                {data.nonVerbalCues && data.nonVerbalCues.length > 0 && (
                  <div className="pt-1">
                    <span className="text-gray-500">Non-Verbal Cues:</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {data.nonVerbalCues.map((cue, index) => (
                        <div key={index} className="px-2 py-1 bg-gray-800 rounded text-gray-300">
                          {cue.emoji} {cue.label} <span className="text-gray-500">({cue.rawTag})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data.gptPrompt && (
                  <div className="pt-1">
                    <span className="text-gray-500">GPT Prompt:</span> {data.gptPrompt.substring(0, 100)}
                    {data.gptPrompt.length > 100 ? '...' : ''}
                  </div>
                )}
                {data.systemMessage && (
                  <div>
                    <span className="text-gray-500">System Message:</span> {data.systemMessage.substring(0, 100)}
                    {data.systemMessage.length > 100 ? '...' : ''}
                  </div>
                )}
                {data.voiceModel && (
                  <div>
                    <span className="text-gray-500">Voice Model:</span> {data.voiceModel}
                  </div>
                )}
                {data.audioUrl && (
                  <div>
                    <span className="text-gray-500">Audio URL:</span>{' '}
                    <a href={data.audioUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                      {data.audioUrl}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Logs */}
          <div>
            <h3 className="text-sm font-bold text-gray-300 mb-2">🟢 Logs</h3>
            <div className="space-y-1 font-mono text-xs">
              {logs.length === 0 ? (
                <div className="text-gray-500 italic">No logs yet...</div>
              ) : (
                logs.map((log, index) => {
                  const icon =
                    log.stage === 'recording'
                      ? '🎙️'
                      : log.stage === 'stt'
                      ? '📤'
                      : log.stage === 'gpt'
                      ? '🧠'
                      : log.stage === 'tts'
                      ? '🔊'
                      : '•';
                  
                  const colorClass =
                    log.type === 'success'
                      ? 'text-green-400'
                      : log.type === 'error'
                      ? 'text-red-400'
                      : log.type === 'warn'
                      ? 'text-yellow-400'
                      : 'text-gray-300';

                  return (
                    <div key={index} className={`${colorClass} py-0.5`}>
                      <span className="text-gray-500">[{formatTimestamp(log.timestamp)}]</span>{' '}
                      <span>{icon}</span> {log.message}
                      {log.data && (
                        <pre className="ml-6 mt-1 text-gray-400 text-xs overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

