import { env } from '../../config/env.js';
import { MockTranscriptionProvider } from './mock-provider.js';
import { OpenAITranscriptionProvider } from './openai-provider.js';
import { GroqTranscriptionProvider } from './groq-provider.js';
import { AssemblyAITranscriptionProvider } from './assemblyai-provider.js';
import { FallbackTranscriptionProvider } from './fallback-transcription-provider.js';
import type { TranscriptionProvider } from './types.js';

type ProviderName = 'groq' | 'assemblyai' | 'openai' | 'mock';

function buildGroq(): TranscriptionProvider {
  if (!env.TRANSCRIPTION_API_KEY) throw new Error('TRANSCRIPTION_API_KEY (Groq) is required');
  return new GroqTranscriptionProvider(env.TRANSCRIPTION_API_KEY);
}

function buildAssemblyAI(): TranscriptionProvider {
  const aaiKey = env.ASSEMBLYAI_API_KEY || env.TRANSCRIPTION_API_KEY;
  if (!aaiKey) throw new Error('ASSEMBLYAI_API_KEY is required for AssemblyAI provider');
  const assemblyai = new AssemblyAITranscriptionProvider(aaiKey);

  // Wrap with Groq fallback when Groq key is also available
  const groqKey = env.TRANSCRIPTION_API_KEY;
  if (groqKey && groqKey !== aaiKey) {
    const groq = new GroqTranscriptionProvider(groqKey);
    return new FallbackTranscriptionProvider(assemblyai, groq);
  }
  return assemblyai;
}

/**
 * Create a transcription provider.
 *
 * @param override  Per-session provider chosen in the extension Settings.
 *                  When provided it takes priority over the server's env var.
 *                  Falls back to the env-configured provider if the override
 *                  can't be satisfied (e.g. missing key).
 */
export function createTranscriptionProvider(override?: 'groq' | 'assemblyai'): TranscriptionProvider {
  const chosen: ProviderName = override ?? (env.TRANSCRIPTION_PROVIDER as ProviderName);

  try {
    switch (chosen) {
      case 'openai':
        if (!env.TRANSCRIPTION_API_KEY) throw new Error('TRANSCRIPTION_API_KEY is required for openai provider');
        return new OpenAITranscriptionProvider(env.TRANSCRIPTION_API_KEY);
      case 'groq':
        return buildGroq();
      case 'assemblyai':
        return buildAssemblyAI();
      case 'mock':
      default:
        return new MockTranscriptionProvider();
    }
  } catch (err) {
    if (override) {
      // Override failed (e.g. missing key) — warn and fall back to server default
      const serverDefault = env.TRANSCRIPTION_PROVIDER as ProviderName;
      if (serverDefault !== override) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[transcription] Override "${override}" failed (${errMsg}), using server default "${serverDefault}"`);
        return createTranscriptionProvider(); // recurse without override
      }
    }
    throw err;
  }
}

export type { TranscriptionProvider, TranscriptionSession } from './types.js';
