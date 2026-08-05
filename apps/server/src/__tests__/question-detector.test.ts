import { describe, it, expect } from 'vitest';
import { detectQuestion } from '../providers/transcription/question-detector.js';

describe('detectQuestion', () => {
  it('detects a question mark', () => {
    expect(detectQuestion('How do you handle errors?')).toBe(true);
  });
  it('detects "tell me about yourself"', () => {
    expect(detectQuestion('Tell me about yourself.')).toBe(true);
  });
  it('detects "explain the difference"', () => {
    expect(detectQuestion('Explain the difference between promises and async/await.')).toBe(true);
  });
  it('detects "describe a difficult"', () => {
    expect(detectQuestion('Describe a difficult technical problem you solved.')).toBe(true);
  });
  it('detects "how would you design"', () => {
    expect(detectQuestion('How would you design a scalable notification system?')).toBe(true);
  });
  it('detects "walk me through"', () => {
    expect(detectQuestion('Walk me through your experience with React.')).toBe(true);
  });
  it('does not flag plain statements', () => {
    expect(detectQuestion('The meeting starts at 3pm.')).toBe(false);
  });
  it('returns false for empty string', () => {
    expect(detectQuestion('')).toBe(false);
  });
  it('detects "why" questions', () => {
    expect(detectQuestion('Why do you want to work here?')).toBe(true);
  });
  it('detects "what is" questions', () => {
    expect(detectQuestion('What is the difference between REST and GraphQL?')).toBe(true);
  });
});
