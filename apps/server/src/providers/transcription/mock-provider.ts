import { v4 as uuidv4 } from 'uuid';
import { detectQuestion } from './question-detector.js';
import type {
  TranscriptionProvider,
  TranscriptionSession,
  PartialTranscriptEvent,
  FinalTranscriptEvent,
} from './types.js';

const MOCK_PHRASES = [
  'Tell me about yourself and your background.',
  'Can you explain how JavaScript handles asynchronous operations?',
  'Describe a difficult technical problem you solved.',
  'How would you design a scalable notification system?',
  'Why do you want to work here?',
  'What is the difference between promises and async/await?',
  'Walk me through your experience with React.',
  'How do you approach debugging a production issue?',
];

class MockTranscriptionSession implements TranscriptionSession {
  private partialCb?: (e: PartialTranscriptEvent) => void;
  private finalCb?: (e: FinalTranscriptEvent) => void;
  private timer?: ReturnType<typeof setInterval>;
  private buffer: Buffer[] = [];
  private currentId = uuidv4();
  private startedAt = Date.now();
  private phraseIndex = 0;
  private wordIndex = 0;
  private closed = false;

  constructor() {
    // Simulate streaming transcript every 400ms
    this.timer = setInterval(() => {
      if (this.closed) return;
      const phrase = MOCK_PHRASES[this.phraseIndex % MOCK_PHRASES.length] ?? '';
      const words = phrase.split(' ');

      this.wordIndex++;
      const partial = words.slice(0, this.wordIndex).join(' ');

      this.partialCb?.({ id: this.currentId, text: partial, startedAt: this.startedAt });

      if (this.wordIndex >= words.length) {
        this.finalCb?.({
          id: this.currentId,
          text: phrase,
          startedAt: this.startedAt,
          endedAt: Date.now(),
          isQuestion: detectQuestion(phrase),
        });
        this.currentId = uuidv4();
        this.startedAt = Date.now();
        this.wordIndex = 0;
        this.phraseIndex++;
      }
    }, 400);
  }

  async sendAudio(chunk: Buffer): Promise<void> {
    this.buffer.push(chunk);
  }

  onPartial(cb: (e: PartialTranscriptEvent) => void): void {
    this.partialCb = cb;
  }

  onFinal(cb: (e: FinalTranscriptEvent) => void): void {
    this.finalCb = cb;
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.timer) clearInterval(this.timer);
    this.buffer = [];
  }
}

// ── MOCK ADAPTER ──────────────────────────────────────────────────────────────
// To connect a real provider, replace this class with a real implementation.
export class MockTranscriptionProvider implements TranscriptionProvider {
  async createSession(_opts: { language?: string; sampleRate: number }): Promise<TranscriptionSession> {
    return new MockTranscriptionSession();
  }
}
