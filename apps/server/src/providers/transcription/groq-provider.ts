/**
 * Groq Whisper transcription provider.
 * Free tier available at https://console.groq.com
 * Uses whisper-large-v3-turbo — fast and accurate, no billing required.
 * API format is identical to OpenAI so the fetch code is the same.
 */
import { v4 as uuidv4 } from 'uuid';
import { detectQuestion } from './question-detector.js';
import { logger } from '../../utils/logger.js';
import type {
  TranscriptionProvider,
  TranscriptionSession,
  PartialTranscriptEvent,
  FinalTranscriptEvent,
} from './types.js';

const MIN_BYTES_TO_FLUSH = 12_000;   // ~0.375s at 16kHz mono int16 — catch short questions
const SILENCE_RMS_THRESHOLD = 40;    // lower = pick up quieter speech
const GROQ_TIMEOUT_MS = 30_000;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_MODEL = 'whisper-large-v3'; // full model — more accurate than turbo

// Prompt primes Whisper to recognise interview vocabulary and punctuate questions correctly
const WHISPER_PROMPT =
  'Interview, software engineer, experience, background, team, project, challenge, ' +
  'leadership, architecture, microservices, TypeScript, React, Node.js, AWS, ' +
  'tell me about yourself, walk me through, describe a time, how would you, ' +
  'what is your, why did you, can you explain, what are your strengths.';

function rms(pcm: Buffer): number {
  if (pcm.length < 2) return 0;
  let sum = 0;
  const samples = pcm.length >> 1;
  for (let i = 0; i + 1 < pcm.length; i += 2) {
    const s = pcm.readInt16LE(i);
    sum += s * s;
  }
  return Math.sqrt(sum / samples);
}

function pcmToWav(pcm: Buffer, sampleRate = 16000, channels = 1): Buffer {
  const byteRate = sampleRate * channels * 2;
  const blockAlign = channels * 2;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function transcribeWithGroq(apiKey: string, pcm: Buffer, language: string): Promise<string> {
  const wav = pcmToWav(pcm);
  // Convert Buffer to Uint8Array so it's a valid BlobPart across all TS targets
  const file = new File([new Uint8Array(wav)], 'audio.wav', { type: 'audio/wav' });
  const form = new FormData();
  form.append('file', file);
  form.append('model', GROQ_MODEL);
  form.append('language', language);
  form.append('response_format', 'text');
  form.append('prompt', WHISPER_PROMPT);
  form.append('temperature', '0'); // deterministic — reduces hallucinations

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    });

    const body = await res.text().catch(() => '');
    if (!res.ok) throw new Error(`Groq HTTP ${res.status}: ${body}`);
    return body.trim();
  } finally {
    clearTimeout(timer);
  }
}

class GroqTranscriptionSession implements TranscriptionSession {
  private partialCb?: (e: PartialTranscriptEvent) => void;
  private finalCb?: (e: FinalTranscriptEvent) => void;
  private chunks: Buffer[] = [];
  private flushTimer?: ReturnType<typeof setInterval>;
  private currentId = uuidv4();
  private startedAt = Date.now();
  private closed = false;
  private flushing = false;
  private language: string;

  constructor(private readonly apiKey: string, opts: { language?: string; sampleRate: number }) {
    this.language = opts.language ?? 'en';
    this.flushTimer = setInterval(() => void this.flush(), 2500);
  }

  async sendAudio(chunk: Buffer): Promise<void> {
    if (!this.closed) this.chunks.push(chunk);
  }

  onPartial(cb: (e: PartialTranscriptEvent) => void): void { this.partialCb = cb; }
  onFinal(cb: (e: FinalTranscriptEvent) => void): void { this.finalCb = cb; }

  private async flush(): Promise<void> {
    if (this.closed || this.chunks.length === 0 || this.flushing) return;

    const pcm = Buffer.concat(this.chunks);
    this.chunks = [];

    if (pcm.length < MIN_BYTES_TO_FLUSH) {
      // Buffer until we have at least 1 second
      this.chunks.push(pcm);
      return;
    }

    const level = rms(pcm);
    if (level < SILENCE_RMS_THRESHOLD) {
      logger.debug({ rms: level.toFixed(1) }, 'Groq: silence, skipping');
      return;
    }

    this.flushing = true;
    const t0 = Date.now();
    logger.debug({ bytes: pcm.length, rms: level.toFixed(1) }, 'Groq: sending');

    try {
      const text = await transcribeWithGroq(this.apiKey, pcm, this.language);
      const elapsed = Date.now() - t0;

      if (!text) {
        logger.debug({ elapsed }, 'Groq: empty response (silence)');
        return;
      }

      logger.info({ elapsed, text }, 'Groq transcript ✓');

      const id = this.currentId;
      const startedAt = this.startedAt;
      const endedAt = Date.now();
      this.currentId = uuidv4();
      this.startedAt = endedAt;

      this.partialCb?.({ id, text, startedAt });
      this.finalCb?.({ id, text, startedAt, endedAt, isQuestion: detectQuestion(text) });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const elapsed = Date.now() - t0;
      if (errMsg.includes('aborted')) {
        logger.warn({ elapsed }, 'Groq: request timed out');
      } else {
        logger.error({ elapsed, errMsg }, 'Groq: error');
      }
    } finally {
      this.flushing = false;
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushing = false;
    await this.flush();
    this.chunks = [];
  }
}

export class GroqTranscriptionProvider implements TranscriptionProvider {
  constructor(private readonly apiKey: string) {}

  async createSession(opts: { language?: string; sampleRate: number }): Promise<TranscriptionSession> {
    return new GroqTranscriptionSession(this.apiKey, opts);
  }
}
