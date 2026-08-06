/**
 * FallbackTranscriptionProvider
 *
 * Wraps a primary provider (AssemblyAI) with a fallback (Groq).
 * Switches automatically in two scenarios:
 *
 *   1. Session creation failure — e.g. AssemblyAI key expired or quota hit.
 *      `createSession()` catches the error and returns a Groq session instead.
 *
 *   2. Mid-session disconnect — e.g. the AAI token expires during a live interview.
 *      `FallbackTranscriptionSession` listens for the primary's `disconnectCb`,
 *      creates a Groq session on the fly, and pipes all future audio to it.
 *      The existing `onPartial`/`onFinal` callbacks continue to work unchanged.
 */
import { logger } from '../../utils/logger.js';
import type {
  TranscriptionProvider,
  TranscriptionSession,
  PartialTranscriptEvent,
  FinalTranscriptEvent,
} from './types.js';
import type { AssemblyAISession } from './assemblyai-provider.js';

// AssemblyAISession exposes `disconnectCb` as a public property we hook into
type AAISessionWithDisconnect = TranscriptionSession & {
  disconnectCb?: (reason: string) => void;
};

class FallbackTranscriptionSession implements TranscriptionSession {
  private partialCb?: (e: PartialTranscriptEvent) => void;
  private finalCb?: (e: FinalTranscriptEvent) => void;
  private current: TranscriptionSession;
  private switched = false;
  /** Audio chunks buffered while the fallback session is being created */
  private pendingChunks: Buffer[] = [];
  private switching = false;

  constructor(
    primary: AAISessionWithDisconnect,
    private readonly createFallback: () => Promise<TranscriptionSession>,
  ) {
    this.current = primary;

    // Hook into the primary's disconnect signal
    primary.disconnectCb = (reason) => {
      logger.warn({ reason }, 'AssemblyAI disconnected — switching to Groq');
      void this.switchToFallback();
    };
  }

  private forwardCallbacks(session: TranscriptionSession): void {
    session.onPartial((e) => this.partialCb?.(e));
    session.onFinal((e) => this.finalCb?.(e));
  }

  private async switchToFallback(): Promise<void> {
    if (this.switched || this.switching) return;
    this.switching = true;

    try {
      const fallback = await this.createFallback();
      this.forwardCallbacks(fallback);
      this.current = fallback;
      this.switched = true;
      logger.info('Switched to Groq transcription (AssemblyAI fallback)');

      // Drain any audio that arrived during the switch
      for (const chunk of this.pendingChunks) {
        await fallback.sendAudio(chunk);
      }
      this.pendingChunks = [];
    } catch (err) {
      logger.error({ err }, 'FallbackTranscriptionProvider: fallback session creation also failed');
    } finally {
      this.switching = false;
    }
  }

  async sendAudio(chunk: Buffer): Promise<void> {
    if (this.switching) {
      // Buffer while switching — prevents audio loss during the handover
      this.pendingChunks.push(chunk);
      return;
    }
    await this.current.sendAudio(chunk);
  }

  onPartial(cb: (e: PartialTranscriptEvent) => void): void {
    this.partialCb = cb;
    // Forward to whichever session is currently active
    this.current.onPartial(cb);
  }

  onFinal(cb: (e: FinalTranscriptEvent) => void): void {
    this.finalCb = cb;
    this.current.onFinal(cb);
  }

  async close(): Promise<void> {
    this.pendingChunks = [];
    await this.current.close();
  }
}

export class FallbackTranscriptionProvider implements TranscriptionProvider {
  constructor(
    private readonly primary: TranscriptionProvider,
    private readonly fallback: TranscriptionProvider,
  ) {}

  async createSession(opts: { language?: string; sampleRate: number }): Promise<TranscriptionSession> {
    // ── Try primary (AssemblyAI) ───────────────────────────────────────────────
    try {
      const primarySession = await this.primary.createSession(opts) as AAISessionWithDisconnect;
      logger.info('Using AssemblyAI transcription (with Groq fallback)');

      return new FallbackTranscriptionSession(
        primarySession,
        () => this.fallback.createSession(opts),
      );
    } catch (err) {
      // ── Session creation failed — fall back immediately ─────────────────────
      logger.warn({ err }, 'AssemblyAI session creation failed — falling back to Groq immediately');
      return this.fallback.createSession(opts);
    }
  }
}
