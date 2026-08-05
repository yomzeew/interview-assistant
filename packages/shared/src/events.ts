import type { Language } from './types.js';

// ─── Server → Client events ───────────────────────────────────────────────────
export type ServerEvent =
  | {
      type: 'transcript.partial';
      id: string;
      text: string;
      startedAt: number;
    }
  | {
      type: 'transcript.final';
      id: string;
      text: string;
      startedAt: number;
      endedAt: number;
      isQuestion: boolean;
    }
  | {
      type: 'translation.final';
      transcriptId: string;
      text: string;
      language: Language;
      detectedLanguage?: Language;
    }
  | {
      type: 'live.answer';
      transcriptId: string;
      question: string;
      answer: string;
      keyPoints: string[];
    }
  | {
      type: 'session.error';
      code: string;
      message: string;
    }
  | {
      type: 'session.ready';
      sessionId: string;
    };

// ─── Client → Server messages ─────────────────────────────────────────────────
export type ClientMessage =
  | { type: 'audio.chunk'; data: string /* base64 */ }
  | { type: 'session.pause' }
  | { type: 'session.resume' }
  | { type: 'session.stop' }
  | { type: 'config.update'; spokenLanguage?: Language; targetLanguage?: Language };
