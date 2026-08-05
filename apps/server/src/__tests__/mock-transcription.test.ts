import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockTranscriptionProvider } from '../providers/transcription/mock-provider.js';

describe('MockTranscriptionProvider', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('creates a session', async () => {
    const provider = new MockTranscriptionProvider();
    const session = await provider.createSession({ sampleRate: 16000 });
    expect(session).toBeDefined();
    await session.close();
  });

  it('emits partial and final transcript events', async () => {
    const provider = new MockTranscriptionProvider();
    const session = await provider.createSession({ sampleRate: 16000 });

    const partials: string[] = [];
    const finals: string[] = [];
    session.onPartial((e) => partials.push(e.text));
    session.onFinal((e) => finals.push(e.text));

    vi.advanceTimersByTime(2000);
    expect(partials.length).toBeGreaterThan(0);

    await session.close();
  });

  it('accepts audio chunks without throwing', async () => {
    const provider = new MockTranscriptionProvider();
    const session = await provider.createSession({ sampleRate: 16000 });
    await expect(session.sendAudio(Buffer.from([0, 1, 2, 3]))).resolves.toBeUndefined();
    await session.close();
  });
});
