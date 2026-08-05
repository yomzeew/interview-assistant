import type { Language } from '@ica/shared';

export interface TranslationProvider {
  translate(input: {
    text: string;
    sourceLanguage?: Language;
    targetLanguage: Language;
  }): Promise<{
    text: string;
    detectedLanguage?: Language;
  }>;
}
