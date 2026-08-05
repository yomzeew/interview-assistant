import { env } from '../../config/env.js';
import { ClaudeProvider } from './claude-provider.js';
import { GroqLLMProvider } from './groq-llm-provider.js';
import { FallbackProvider } from './fallback-provider.js';
import type { PracticeCoachProvider, LiveAnswerProvider } from './types.js';

type FullProvider = LiveAnswerProvider & PracticeCoachProvider;
let _instance: FullProvider | null = null;

function getInstance(): FullProvider {
  if (_instance) return _instance;

  const groqKey = env.GROQ_API_KEY || env.TRANSCRIPTION_API_KEY;
  const groq = groqKey ? new GroqLLMProvider(groqKey) : null;

  if (env.AI_PROVIDER === 'groq') {
    if (!groq) throw new Error('GROQ_API_KEY is required. Get a free key at https://console.groq.com');
    _instance = groq;
    return _instance;
  }

  // AI_PROVIDER=claude — use Claude with Groq as automatic fallback
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER=claude');
  const claude = new ClaudeProvider();

  if (groq) {
    // Wrap: tries Claude first, falls back to Groq on credit exhaustion
    _instance = new FallbackProvider(claude, groq);
  } else {
    _instance = claude;
  }

  return _instance;
}

export function createLiveAnswerProvider(): LiveAnswerProvider {
  return getInstance();
}

export function createPracticeCoachProvider(): PracticeCoachProvider {
  return getInstance();
}

export type { PracticeCoachProvider, LiveAnswerProvider } from './types.js';
