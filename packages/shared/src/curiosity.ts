/**
 * Curiosity Index (CI) calculation utility
 * Measures engagement based on session metrics
 */

import type { SessionMetrics } from './types';

export function calculateCuriosityIndex(metrics: SessionMetrics): number {
  const { turns, whQuestions, sessionMinutes } = metrics;
  
  if (sessionMinutes === 0) return 0;
  
  const turnsPerMinute = turns / sessionMinutes;
  const questionRatio = turns > 0 ? whQuestions / turns : 0;
  
  // Simple CI formula: weight turn frequency and question ratio
  const ci = (turnsPerMinute * 0.3 + questionRatio * 0.7) * 100;
  
  return Math.min(Math.round(ci * 10) / 10, 100);
}

