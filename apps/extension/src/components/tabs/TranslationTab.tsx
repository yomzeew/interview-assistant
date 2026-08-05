import React from 'react';
import type { TranscriptEntry } from '../../types/index.js';
import { LANGUAGE_LABELS } from '@ica/shared';

interface Props { transcripts: TranscriptEntry[]; fontSize: 'small' | 'medium' | 'large' }

export default function TranslationTab({ transcripts, fontSize }: Props) {
  const translated = transcripts.filter((t) => !t.isPartial && t.translation);
  const sizeClass = `font-size-${fontSize}`;

  if (translated.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm px-4 text-center">
        <div>
          <p className="text-2xl mb-2">🌐</p>
          <p>Translations appear here.</p>
          <p className="text-xs mt-1">Set a target language in Settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {translated.map((entry) => (
        <div key={entry.id} className="border border-gray-200 rounded-lg p-3 bg-white">
          <p className={`${sizeClass} text-gray-800 mb-2`}>{entry.text}</p>
          {entry.translation && (
            <div className="bg-blue-50 rounded p-2">
              <p className="text-xs text-gray-400 mb-0.5">{LANGUAGE_LABELS[entry.translation.language] ?? entry.translation.language}</p>
              <p className={`${sizeClass} text-gray-700`}>{entry.translation.text}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
