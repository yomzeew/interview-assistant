import type { Language } from '@ica/shared';
import type { TranslationProvider } from './types.js';

// ── MOCK ADAPTER ──────────────────────────────────────────────────────────────
// Echoes the source text with a language tag prefix.
// Replace with a real provider (e.g. DeepL, Google Translate, OpenAI) here.
export class MockTranslationProvider implements TranslationProvider {
  async translate(input: {
    text: string;
    sourceLanguage?: Language;
    targetLanguage: Language;
  }): Promise<{ text: string; detectedLanguage?: Language }> {
    if (input.targetLanguage === (input.sourceLanguage ?? 'en')) {
      return { text: input.text };
    }
    return {
      text: `[${input.targetLanguage.toUpperCase()}] ${input.text}`,
      detectedLanguage: input.sourceLanguage ?? 'en',
    };
  }
}
