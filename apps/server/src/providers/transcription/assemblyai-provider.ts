/**
 * AssemblyAI real-time streaming transcription provider.
 *
 * Uses AssemblyAI's WebSocket streaming API which gives us:
 * - Continuous, low-latency transcription (no batching delay)
 * - Native speaker diarization (Speaker A / B / C)
 * - Word-level confidence scores
 *
 * API docs: https://www.assemblyai.com/docs/speech-to-text/streaming
 *
 * Flow:
 *   1. GET /v2/realtime/token → temporary WS token
 *   2. WSS connect with token + speaker_labels=true
 *   3. Send { audio_data: base64(PCM s16le) } for every chunk
 *   4. Receive PartialTranscript and FinalTranscript messages
 *   5. Map speaker letters (A, B, C) → "Speaker 1", "Speaker 2", "Speaker 3"
 */
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { detectQuestion } from './question-detector.js';
import { logger } from '../../utils/logger.js';
import type {
  TranscriptionProvider,
  TranscriptionSession,
  PartialTranscriptEvent,
  FinalTranscriptEvent,
} from './types.js';

const AAI_API_URL = 'https://api.assemblyai.com';
const AAI_WS_URL = 'wss://api.assemblyai.com/v2/realtime/ws';
const WORD_BOOST = [
  'microservices', 'TypeScript', 'React', 'Node.js', 'AWS', 'Kubernetes',
  'architecture', 'leadership', 'agile', 'scrum', 'stakeholders',
  'tell me about yourself', 'describe a time', 'walk me through',
];

interface AAISessionBegins {
  message_type: 'SessionBegins';
  session_id: string;
  expires_at: string;
}

interface AAIWord {
  text: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: string; // "A", "B", "C" …
}

interface AAIPartialTranscript {
  message_type: 'PartialTranscript';
  text: string;
  words: AAIWord[];
  audio_start: number;
  audio_end: number;
}

interface AAIFinalTranscript {
  message_type: 'FinalTranscript';
  text: string;
  words: AAIWord[];
  audio_start: number;
  audio_end: number;
  confidence: number;
}

interface AAIError {
  message_type: 'Error' | 'SessionInformation';
  error?: string;
}

type AAIMessage = AAISessionBegins | AAIPartialTranscript | AAIFinalTranscript | AAIError;

/** Map AAI speaker letter (A/B/C) → human label (Speaker 1/2/3) */
function speakerLabel(letter?: string): string {
  if (!letter) return 'Meeting audio';
  const index = letter.charCodeAt(0) - 'A'.charCodeAt(0);
  return `Speaker ${index + 1}`;
}

/** Pick the most common speaker across the word list (majority vote) */
function dominantSpeaker(words: AAIWord[]): string | undefined {
  const counts = new Map<string, number>();
  for (const w of words) {
    if (w.speaker) counts.set(w.speaker, (counts.get(w.speaker) ?? 0) + 1);
  }
  let best: string | undefined;
  let max = 0;
  for (const [sp, n] of counts) {
    if (n > max) { max = n; best = sp; }
  }
  return best;
}

export class AssemblyAISession implements TranscriptionSession {
  private partialCb?: (e: PartialTranscriptEvent) => void;
  private finalCb?: (e: FinalTranscriptEvent) => void;
  /** Fires when the WS drops unexpectedly (not via our own close() call) */
  disconnectCb?: (reason: string) => void;
  private ws: WebSocket | null = null;
  private closed = false;
  private currentId = uuidv4();
  private startedAt = Date.now();
  private utteranceStart: number | null = null;

  constructor(private readonly apiKey: string, private readonly language: string) {}

  async connect(): Promise<void> {
    // Step 1: get a short-lived token
    const tokenRes = await fetch(`${AAI_API_URL}/v2/realtime/token`, {
      method: 'POST',
      headers: { authorization: this.apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ expires_in: 3600 }),
    });
    if (!tokenRes.ok) {
      throw new Error(`AssemblyAI token error: ${tokenRes.status} ${await tokenRes.text()}`);
    }
    const { token } = await tokenRes.json() as { token: string };

    // Step 2: open WebSocket with speaker_labels and word_boost
    const params = new URLSearchParams({
      sample_rate: '16000',
      token,
      speaker_labels: 'true',
      word_boost: JSON.stringify(WORD_BOOST),
    });
    const url = `${AAI_WS_URL}?${params.toString()}`;

    await new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        logger.info('AssemblyAI WebSocket connected');
        resolve();
      });

      this.ws.on('error', (err) => {
        logger.error({ err }, 'AssemblyAI WebSocket error');
        if (this.ws?.readyState === WebSocket.CONNECTING) {
          // Still connecting — reject the connect() promise
          reject(err);
        } else {
          // Mid-session error — signal disconnect for fallback handling
          this.disconnectCb?.(err.message);
        }
      });

      this.ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as AAIMessage;
          this.handleMessage(msg);
        } catch (err) {
          logger.warn({ err }, 'AssemblyAI: failed to parse message');
        }
      });

      this.ws.on('close', (code, reason) => {
        const msg = reason.toString() || `code ${code}`;
        logger.info({ code, reason: msg }, 'AssemblyAI WebSocket closed');
        // Fire disconnect callback only for unexpected closure (not our own close())
        if (!this.closed) {
          this.disconnectCb?.(msg);
        }
      });
    });
  }

  private handleMessage(msg: AAIMessage): void {
    switch (msg.message_type) {
      case 'SessionBegins':
        logger.info({ session_id: (msg as AAISessionBegins).session_id }, 'AssemblyAI session started');
        break;

      case 'PartialTranscript': {
        const p = msg as AAIPartialTranscript;
        if (!p.text) break;
        if (this.utteranceStart === null) this.utteranceStart = Date.now() - p.audio_end;
        this.partialCb?.({ id: this.currentId, text: p.text, startedAt: this.utteranceStart });
        break;
      }

      case 'FinalTranscript': {
        const f = msg as AAIFinalTranscript;
        if (!f.text) break;
        const id = this.currentId;
        const startedAt = this.utteranceStart ?? Date.now() - f.audio_end;
        const endedAt = Date.now();
        this.currentId = uuidv4();
        this.utteranceStart = null;
        this.startedAt = endedAt;

        const dominant = dominantSpeaker(f.words);
        const label = speakerLabel(dominant);
        const { isQuestion, confidence } = detectQuestion(f.text);

        this.partialCb?.({ id, text: f.text, startedAt });
        this.finalCb?.({ id, text: f.text, startedAt, endedAt, isQuestion, confidence, speakerLabel: label });
        break;
      }

      case 'Error': {
        const errMsg = (msg as AAIError).error ?? 'unknown AssemblyAI error';
        logger.error({ error: errMsg }, 'AssemblyAI stream error');
        if (!this.closed) this.disconnectCb?.(errMsg);
        break;
      }
    }
  }

  async sendAudio(chunk: Buffer): Promise<void> {
    if (this.closed || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ audio_data: chunk.toString('base64') }));
  }

  onPartial(cb: (e: PartialTranscriptEvent) => void): void { this.partialCb = cb; }
  onFinal(cb: (e: FinalTranscriptEvent) => void): void { this.finalCb = cb; }

  async close(): Promise<void> {
    this.closed = true;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ terminate_session: true }));
      this.ws.close(1000, 'Session ended');
    }
    this.ws = null;
  }
}

export class AssemblyAITranscriptionProvider implements TranscriptionProvider {
  constructor(private readonly apiKey: string) {}

  async createSession(opts: { language?: string; sampleRate: number }): Promise<TranscriptionSession> {
    const session = new AssemblyAISession(this.apiKey, opts.language ?? 'en');
    await session.connect();
    return session;
  }
}
