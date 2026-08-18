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

function buildClaude(apiKey?: string): FullProvider {
  // Claude only — no Groq fallback. If Claude is configured, use it exclusively.
  return new ClaudeProvider(apiKey);
}

/**
 * Return a live-answer / summary / practice provider.
 *
 * @param override     Per-session AI provider chosen in extension Settings.
 * @param anthropicApiKey  Optional user-supplied Anthropic key (takes precedence over env var).
 */
function getInstance(override?: 'groq' | 'claude', anthropicApiKey?: string): FullProvider {
  // Per-session override or user key — always build fresh (not cached)
  if (override || anthropicApiKey) {
    try {
      if (override === 'groq') return buildGroq();
      // claude override OR just a user-supplied key with no provider override
      return buildClaude(anthropicApiKey);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[ai] Override failed (${msg}), using server default`);
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

export function createLiveAnswerProvider(override?: 'groq' | 'claude', anthropicApiKey?: string): LiveAnswerProvider {
  return getInstance(override, anthropicApiKey);
}

export function createPracticeCoachProvider(): PracticeCoachProvider {
  return getInstance();
}

export function createSummaryProvider(override?: 'groq' | 'claude', anthropicApiKey?: string): SummaryProvider {
  return getInstance(override, anthropicApiKey);
}

export type { PracticeCoachProvider, LiveAnswerProvider, SummaryProvider } from './types.js';
