import { v4 as uuidv4 } from 'uuid';
import { detectQuestion } from './question-detector.js';
import { logger } from '../../utils/logger.js';
import type {
  TranscriptionProvider,
  TranscriptionSession,
  PartialTranscriptEvent,
  FinalTranscriptEvent,
} from './types.js';

// At 16kHz mono 16-bit: 1s = 32 000 bytes
const MIN_BYTES_TO_FLUSH = 32_000;   // 1 second minimum
const SILENCE_RMS_THRESHOLD = 80;
const WHISPER_TIMEOUT_MS = 30_000;

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

/**
 * Call Whisper using native fetch + FormData + Blob.
 * This bypasses the OpenAI SDK's stream handling which has issues in Node 22.
 */
async function transcribeWithFetch(
  apiKey: string,
  pcm: Buffer,
  language: string
): Promise<string> {
  const wav = pcmToWav(pcm);

  // Use File (extends Blob, carries filename) — required for OpenAI multipart upload
  const file = new File([new Uint8Array(wav)], 'audio.wav', { type: 'audio/wav' });
  const form = new FormData();
  form.append('file', file);
  form.append('model', 'whisper-1');
  form.append('language', language);
  form.append('response_format', 'text');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WHISPER_TIMEOUT_MS);

  try {
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    });

    const body = await res.text().catch(() => '');
    if (!res.ok) {
      throw new Error(`Whisper HTTP ${res.status}: ${body}`);
    }

    return body.trim();
  } finally {
    clearTimeout(timer);
  }
}

class OpenAITranscriptionSession implements TranscriptionSession {
  private partialCb?: (e: PartialTranscriptEvent) => void;
  private finalCb?: (e: FinalTranscriptEvent) => void;
  private chunks: Buffer[] = [];
  private flushTimer?: ReturnType<typeof setInterval>;
  private currentId = uuidv4();
  private startedAt = Date.now();
  private closed = false;
  private flushing = false;
  private language: string;

  constructor(
    private readonly apiKey: string,
    opts: { language?: string; sampleRate: number }
  ) {
    this.language = opts.language ?? 'en';
    this.flushTimer = setInterval(() => void this.flush(), 4000);
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
      logger.debug({ bytes: pcm.length }, 'Whisper: not enough audio yet, buffering');
      // Put back so next flush has more
      this.chunks.push(pcm);
      return;
    }

    const level = rms(pcm);
    if (level < SILENCE_RMS_THRESHOLD) {
      logger.debug({ rms: level.toFixed(1) }, 'Whisper: silence, skipping');
      return;
    }

    this.flushing = true;
    const t0 = Date.now();
    logger.debug({ bytes: pcm.length, rms: level.toFixed(1) }, 'Whisper: sending');

    try {
      const text = await transcribeWithFetch(this.apiKey, pcm, this.language);
      const elapsed = Date.now() - t0;

      if (!text) {
        logger.debug({ elapsed }, 'Whisper: empty response');
        return;
      }

      logger.info({ elapsed, text }, 'Whisper transcript ✓');

      const id = this.currentId;
      const startedAt = this.startedAt;
      const endedAt = Date.now();
      this.currentId = uuidv4();
      this.startedAt = endedAt;

      this.partialCb?.({ id, text, startedAt });
      this.finalCb?.({ id, text, startedAt, endedAt, ...detectQuestion(text) });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const elapsed = Date.now() - t0;
      if (errMsg.includes('aborted') || errMsg.includes('abort')) {
        logger.warn({ elapsed }, 'Whisper: request timed out');
      } else {
        logger.error({ elapsed, errMsg }, 'Whisper: error');
      }
    } finally {
      this.flushing = false;
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.flushTimer) clearInterval(this.flushTimer);
    // Final flush with whatever audio remains
    this.flushing = false;
    await this.flush();
    this.chunks = [];
  }
}

export class OpenAITranscriptionProvider implements TranscriptionProvider {
  constructor(private readonly apiKey: string) {}

  async createSession(opts: { language?: string; sampleRate: number }): Promise<TranscriptionSession> {
    return new OpenAITranscriptionSession(this.apiKey, opts);
  }
}
