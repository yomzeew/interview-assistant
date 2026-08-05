import { describe, it, expect } from 'vitest';

// Inline detector for extension-side tests (matches server implementation)
function detectQuestion(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  const PATTERNS = [
    /\?$/,
    /^(tell me|walk me through|explain|describe|what|how|why|can you|could you|would you|have you)/i,
    /difference between/i, /how would you/i, /what (is|are|was|were|would)/i, /why (did|do|would|should)/i,
  ];
  if (PATTERNS.some((p) => p.test(normalized))) return true;
  const INTERROGATIVE = ['who','what','when','where','why','how','which','tell','explain','describe','walk'];
  const firstWord = normalized.split(/\s+/)[0]?.toLowerCase() ?? '';
  return INTERROGATIVE.includes(firstWord);
}

describe('Question detection (extension side)', () => {
  it('detects question marks', () => expect(detectQuestion('Can you explain closures?')).toBe(true));
  it('detects "tell me"', () => expect(detectQuestion('Tell me about yourself.')).toBe(true));
  it('does not flag a statement', () => expect(detectQuestion('I have five years of experience.')).toBe(false));
});
