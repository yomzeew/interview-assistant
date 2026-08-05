import { env } from '../../config/env.js';
import { MockTranscriptionProvider } from './mock-provider.js';
import { OpenAITranscriptionProvider } from './openai-provider.js';
import { GroqTranscriptionProvider } from './groq-provider.js';
import type { TranscriptionProvider } from './types.js';

export function createTranscriptionProvider(): TranscriptionProvider {
  switch (env.TRANSCRIPTION_PROVIDER) {
    case 'openai':
      if (!env.TRANSCRIPTION_API_KEY) throw new Error('TRANSCRIPTION_API_KEY is required for openai provider');
      return new OpenAITranscriptionProvider(env.TRANSCRIPTION_API_KEY);
    case 'groq':
      if (!env.TRANSCRIPTION_API_KEY) throw new Error('TRANSCRIPTION_API_KEY is required for groq provider');
      return new GroqTranscriptionProvider(env.TRANSCRIPTION_API_KEY);
    case 'mock':
    default:
      return new MockTranscriptionProvider();
  }
}

export type { TranscriptionProvider, TranscriptionSession } from './types.js';
