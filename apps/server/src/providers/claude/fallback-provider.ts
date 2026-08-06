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

/** Returns true when the error is a billing/credit exhaustion from Anthropic */
function isCreditError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('credit balance') ||
    msg.includes('insufficient_quota') ||
    msg.includes('Your credit') ||
    (msg.includes('400') && msg.includes('billing'))
  );
}

export class FallbackProvider implements FullProvider {
  private usingFallback = false;

  constructor(
    private readonly primary: FullProvider,   // Claude
    private readonly fallback: FullProvider   // Groq
  ) {}

  private active(): FullProvider {
    return this.usingFallback ? this.fallback : this.primary;
  }

  private async tryWithFallback<T>(fn: (p: FullProvider) => Promise<T>): Promise<T> {
    if (this.usingFallback) return fn(this.fallback);
    try {
      return await fn(this.primary);
    } catch (err) {
      if (isCreditError(err)) {
        logger.warn('Claude credits exhausted — switching to Groq LLaMA 3 (free)');
        this.usingFallback = true;
        return fn(this.fallback);
      }
      throw err;
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
