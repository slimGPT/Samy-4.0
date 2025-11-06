'use client';

/**
 * Agent Dashboard Component
 * 
 * Development dashboard showing real-time agent activity
 * Always visible in horizontal layout for development
 */

import { useEffect, useRef } from 'react';
import { LogEntry, Timing, DebugData } from './DebugPanel';

interface AgentDashboardProps {
  logs: LogEntry[];
  timings: Timing[];
  errors: string[];
  data: DebugData;
  emotion?: string;
  phase?: string;
  energy?: number;
  language?: string;
}

export default function AgentDashboard({ 
  logs, 
  timings, 
  errors, 
  data,
  emotion,
  phase,
  energy,
  language
}: AgentDashboardProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

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

  const getTimingColor = (duration: number): string => {
    if (duration < 2000) return 'text-green-400';
    if (duration < 5000) return 'text-yellow-400';
    return 'text-red-400';
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900 border-l border-gray-700">
      {/* Dashboard Header */}
      <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <h2 className="text-lg font-bold text-yellow-300">🧠 Agent Dashboard</h2>
        <p className="text-xs text-gray-400">Real-time monitoring</p>
      </div>

      {/* Avatar Reference - Always Visible */}
      <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-center">
          <img 
            src="/samybear-avatar.jpg" 
            alt="SamyBear Reference" 
            className="w-24 h-24 object-cover rounded-lg shadow-md border border-purple-500/30"
          />
        </div>
        <p className="text-xs text-center text-gray-400 mt-2">Tone & Voice Reference</p>
      </div>

      {/* Dashboard Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Agent State */}
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <h3 className="text-sm font-bold text-gray-300 mb-2">📊 Agent State</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Phase:</span>
                <span className="ml-2 text-blue-400 font-semibold">{phase || 'idle'}</span>
              </div>
              <div>
                <span className="text-gray-500">Emotion:</span>
                <span className="ml-2 text-purple-400 font-semibold">{emotion || 'curious'}</span>
              </div>
              <div>
                <span className="text-gray-500">Energy:</span>
                <span className="ml-2 text-green-400 font-semibold">{energy ? `${Math.round(energy * 100)}%` : '65%'}</span>
              </div>
              <div>
                <span className="text-gray-500">Language:</span>
                <span className="ml-2 text-yellow-400 font-semibold">{language?.toUpperCase() || 'EN'}</span>
              </div>
            </div>
          </div>

          {/* Timings */}
          {timings.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <h3 className="text-sm font-bold text-gray-300 mb-2">⏱️ Timings</h3>
              <div className="space-y-1">
                {timings.map((timing, index) => (
                  <div key={index} className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">{timing.stage}:</span>
                    <span className={`font-mono font-bold ${getTimingColor(timing.duration)}`}>
                      {formatDuration(timing.duration)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-900/20 rounded-lg p-3 border border-red-700">
              <h3 className="text-sm font-bold text-red-400 mb-2">🛑 Errors ({errors.length})</h3>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {errors.map((error, index) => (
                  <div key={index} className="text-xs text-red-300 font-mono">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data Snapshot */}
          {(data.transcript || data.language || data.audioSize) && (
            <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <h3 className="text-sm font-bold text-gray-300 mb-2">📦 Data</h3>
              <div className="space-y-1 text-xs font-mono text-gray-400">
                {data.audioSize && (
                  <div>
                    <span className="text-gray-500">Audio:</span> {(data.audioSize / 1024).toFixed(2)} KB
                  </div>
                )}
                {data.language && (
                  <div>
                    <span className="text-gray-500">Language:</span> <span className="text-blue-400">{data.language}</span>
                  </div>
                )}
                {data.transcript && (
                  <div className="pt-1">
                    <span className="text-gray-500">Transcript:</span>
                    <div className="mt-1 p-2 bg-gray-900 rounded text-gray-300 text-xs">
                      &quot;{data.transcript.substring(0, 80)}{data.transcript.length > 80 ? '...' : ''}&quot;
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Real-time Logs */}
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <h3 className="text-sm font-bold text-gray-300 mb-2">
              🟢 Logs ({logs.length})
            </h3>
            <div className="space-y-0.5 font-mono text-xs max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-gray-500 italic text-xs">No logs yet...</div>
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
                      <span className="text-gray-600">[{formatTimestamp(log.timestamp)}]</span>{' '}
                      <span>{icon}</span> <span>{log.message}</span>
                    </div>
                  );
                })
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

