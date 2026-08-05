import { describe, it, expect } from 'vitest';
import {
  GeneratePracticeAnswerInputSchema,
  ReviewAnswerInputSchema,
  CreateSessionResponseSchema,
  AppSettingsSchema,
} from '@ica/shared';

describe('GeneratePracticeAnswerInputSchema', () => {
  it('accepts a valid payload', () => {
    const result = GeneratePracticeAnswerInputSchema.safeParse({
      question: 'Tell me about yourself.',
      role: 'Software Engineer',
      experienceLevel: 'mid-level',
      answerStyle: 'star',
      technologies: ['TypeScript', 'React'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    const result = GeneratePracticeAnswerInputSchema.safeParse({ question: 'Q?' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid experienceLevel', () => {
    const result = GeneratePracticeAnswerInputSchema.safeParse({
      question: 'Q?', role: 'Dev', experienceLevel: 'intern', answerStyle: 'star', technologies: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('ReviewAnswerInputSchema', () => {
  it('accepts valid payload', () => {
    const result = ReviewAnswerInputSchema.safeParse({
      question: 'Tell me about yourself.',
      answer: 'I have 5 years of experience in frontend development.',
      role: 'Frontend Engineer',
      experienceLevel: 'senior',
    });
    expect(result.success).toBe(true);
  });
});

describe('CreateSessionResponseSchema', () => {
  it('validates a proper response', () => {
    const result = CreateSessionResponseSchema.safeParse({
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      websocketToken: 'tok123',
      websocketUrl: 'wss://example.com/ws',
    });
    expect(result.success).toBe(true);
  });
});
