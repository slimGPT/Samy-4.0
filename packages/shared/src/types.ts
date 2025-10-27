export type Phase = "idle" | "listening" | "thinking" | "speaking";
export type Emotion = "happy" | "calm" | "curious" | "sleepy";
export type Language = "ar" | "fr" | "en";

export interface SessionState {
  phase: Phase;
  emotion: Emotion;
  energy: number; // 0..1
  lastAudioUrl: string | null;
  lang: Language;
  updatedAt: number;
}

export interface SessionMetrics {
  turns: number;
  whQuestions: number;
  sessionMinutes: number;
  ci: number;
}

export interface SessionDocument {
  state: SessionState;
  metrics: SessionMetrics;
}

