import OpenAI from 'openai';
import { LANGUAGE_LABELS } from '@ica/shared';
import type { Language } from '@ica/shared';
import { logger } from '../../utils/logger.js';
import type { TranslationProvider } from './types.js';

// ── REAL ADAPTER ──────────────────────────────────────────────────────────────
// Uses GPT to translate. For production, consider DeepL or Google Translate
// for better language coverage and lower latency.
export class OpenAITranslationProvider implements TranslationProvider {
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async translate(input: {
    text: string;
    sourceLanguage?: Language;
    targetLanguage: Language;
  }): Promise<{ text: string; detectedLanguage?: Language }> {
    const targetName = LANGUAGE_LABELS[input.targetLanguage] ?? input.targetLanguage;
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the user's text to ${targetName}. Return only the translated text with no preamble.`,
          },
          { role: 'user', content: input.text },
        ],
        max_tokens: 1024,
      });
      const text = response.choices[0]?.message.content?.trim() ?? input.text;
      return { text, detectedLanguage: input.sourceLanguage };
    } catch (err) {
      logger.error({ err }, 'Translation error');
      return { text: input.text };
    }
  }
}
