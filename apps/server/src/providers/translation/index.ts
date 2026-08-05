import { env } from '../../config/env.js';
import { MockTranslationProvider } from './mock-provider.js';
import { OpenAITranslationProvider } from './openai-provider.js';
import type { TranslationProvider } from './types.js';

export function createTranslationProvider(): TranslationProvider {
  switch (env.TRANSLATION_PROVIDER) {
    case 'openai':
      if (!env.TRANSLATION_API_KEY) throw new Error('TRANSLATION_API_KEY required for openai provider');
      return new OpenAITranslationProvider(env.TRANSLATION_API_KEY);
    case 'mock':
    default:
      return new MockTranslationProvider();
  }
}

export type { TranslationProvider } from './types.js';
