/**
 * FallbackProvider — wraps Claude with Groq as automatic fallback.
 * When Claude returns a credit/quota error it silently switches to Groq
 * for the rest of the session and logs a single warning.
 */
import { logger } from '../../utils/logger.js';
import type { PracticeCoachProvider, LiveAnswerProvider, SummaryProvider, SessionSummaryInput } from './types.js';
import type {
  GeneratePracticeAnswerInput,
  GeneratePracticeAnswerOutput,
  ReviewPracticeAnswerInput,
  ReviewPracticeAnswerOutput,
  LiveAnswerResult,
} from '@ica/shared';

type FullProvider = LiveAnswerProvider & PracticeCoachProvider & SummaryProvider;

export class FallbackProvider implements FullProvider {
  private usingFallback = false;

  constructor(
    private readonly primary: FullProvider,   // e.g. Claude
    private readonly fallback: FullProvider   // e.g. Groq
  ) {}

  private async tryWithFallback<T>(fn: (p: FullProvider) => Promise<T>): Promise<T> {
    if (this.usingFallback) return fn(this.fallback);
    try {
      return await fn(this.primary);
    } catch (primaryErr) {
      const primaryMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
      logger.warn({ err: primaryMsg }, 'Primary AI provider failed — switching to fallback');
      this.usingFallback = true;
      try {
        return await fn(this.fallback);
      } catch (fallbackErr) {
        // Both failed — rethrow primary error with context
        const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        logger.error({ primaryErr: primaryMsg, fallbackErr: fallbackMsg }, 'Both AI providers failed');
        throw primaryErr;
      }
    }
  }

  answerQuestion(input: Parameters<LiveAnswerProvider['answerQuestion']>[0]) {
    return this.tryWithFallback((p) => p.answerQuestion(input));
  }

  generateAnswer(input: GeneratePracticeAnswerInput): Promise<GeneratePracticeAnswerOutput> {
    return this.tryWithFallback((p) => p.generateAnswer(input));
  }

  reviewAnswer(input: ReviewPracticeAnswerInput): Promise<ReviewPracticeAnswerOutput> {
    return this.tryWithFallback((p) => p.reviewAnswer(input));
  }

  generateFollowUps(input: { question: string; answer: string; role: string }): Promise<string[]> {
    return this.tryWithFallback((p) => p.generateFollowUps(input));
  }

  generateSessionSummary(input: SessionSummaryInput): Promise<string> {
    return this.tryWithFallback((p) => p.generateSessionSummary(input));
  }
}
