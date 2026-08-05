import type { TranscriptSegment, TranslationResult, LiveAnswerResult } from '@ica/shared';

export interface TranscriptEntry extends TranscriptSegment {
  translation?: TranslationResult;
  liveAnswer?: LiveAnswerResult;
}

export type Tab = 'captions' | 'translation' | 'saved' | 'practice' | 'settings';
