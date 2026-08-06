import type { WebSocket } from 'ws';
import type { Language } from '@ica/shared';

export interface ActiveSession {
  sessionId: string;
  websocketToken: string;
  createdAt: number;
  ws?: WebSocket;
  spokenLanguage: Language;
  targetLanguage: Language;
  paused: boolean;
  userProfile?: string;
  jobDescription?: string;
  jobEssentials?: string;
  skillsRequired?: string;
  cvText?: string;
  interviewData?: string;
  dislikedAnswerPatterns?: string;
  /** Per-session provider override — overrides TRANSCRIPTION_PROVIDER env var */
  transcriptionProvider?: 'groq' | 'assemblyai';
  /** Per-session AI provider override — overrides AI_PROVIDER env var */
  aiProvider?: 'groq' | 'claude';
}
