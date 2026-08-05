import { describe, it, expect } from 'vitest';
import { MockTranslationProvider } from '../providers/translation/mock-provider.js';

describe('MockTranslationProvider', () => {
  const provider = new MockTranslationProvider();

  it('echoes text with language prefix when translating', async () => {
    const result = await provider.translate({ text: 'Hello', sourceLanguage: 'en', targetLanguage: 'fr' });
    expect(result.text).toContain('[FR]');
    expect(result.text).toContain('Hello');
  });

  it('returns original text when source === target', async () => {
    const result = await provider.translate({ text: 'Hello', sourceLanguage: 'en', targetLanguage: 'en' });
    expect(result.text).toBe('Hello');
  });
});
