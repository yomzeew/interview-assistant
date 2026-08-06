import { env } from '../../config/env.js';
import { ClaudeProvider } from './claude-provider.js';
import { GroqLLMProvider } from './groq-llm-provider.js';
import { FallbackProvider } from './fallback-provider.js';
import type { PracticeCoachProvider, LiveAnswerProvider, SummaryProvider } from './types.js';

type FullProvider = LiveAnswerProvider & PracticeCoachProvider & SummaryProvider;

/** Cache for the server-default provider (avoids re-constructing every request) */
let _defaultInstance: FullProvider | null = null;

function buildGroq(): FullProvider {
  const groqKey = env.GROQ_API_KEY || env.TRANSCRIPTION_API_KEY;
  if (!groqKey) throw new Error('GROQ_API_KEY is required. Get a free key at https://console.groq.com');
  return new GroqLLMProvider(groqKey);
}

function buildClaude(): FullProvider {
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER=claude');
  const claude = new ClaudeProvider();
  const groqKey = env.GROQ_API_KEY || env.TRANSCRIPTION_API_KEY;
  if (groqKey) {
    // Wrap: tries Claude first, falls back to Groq on credit exhaustion
    return new FallbackProvider(claude, new GroqLLMProvider(groqKey));
  }
  return claude;
}

/**
 * Return a live-answer / summary / practice provider.
 *
 * @param override  Per-session AI provider chosen in extension Settings.
 *                  When provided, bypasses the server's AI_PROVIDER env var.
 *                  Falls back to server default if the override can't be built.
 */
function getInstance(override?: 'groq' | 'claude'): FullProvider {
  // Per-session override — build fresh (not cached)
  if (override) {
    try {
      return override === 'claude' ? buildClaude() : buildGroq();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[ai] Override "${override}" failed (${msg}), using server default`);
      // Fall through to server default below
    }
  }

  // Server default — cached singleton
  if (_defaultInstance) return _defaultInstance;

  if (env.AI_PROVIDER === 'groq') {
    _defaultInstance = buildGroq();
  } else {
    _defaultInstance = buildClaude();
  }
  return _defaultInstance;
}

export function createLiveAnswerProvider(override?: 'groq' | 'claude'): LiveAnswerProvider {
  return getInstance(override);
}

export function createPracticeCoachProvider(): PracticeCoachProvider {
  return getInstance();
}

export function createSummaryProvider(override?: 'groq' | 'claude'): SummaryProvider {
  return getInstance(override);
}

export type { PracticeCoachProvider, LiveAnswerProvider, SummaryProvider } from './types.js';
