import React, { useEffect, useRef } from 'react';
import TranscriptCard from '../TranscriptCard.js';
import type { TranscriptEntry } from '../../types/index.js';

interface Props {
  transcripts: TranscriptEntry[];
  fontSize: 'small' | 'medium' | 'large';
  onSaveQuestion(entry: TranscriptEntry): void;
  onSendToPractice(question: string): void;
}

export default function CaptionsTab({ transcripts, fontSize, onSaveQuestion, onSendToPractice }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts.length]);

  if (transcripts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm px-4 text-center">
        <div>
          <p className="text-2xl mb-2">🎙️</p>
          <p>Start a session to see live captions.</p>
          <p className="text-xs mt-1">Works with Google Meet, Teams, and Zoom in Chrome.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3">
      {transcripts.map((entry) => (
        <TranscriptCard
          key={entry.id}
          entry={entry}
          fontSize={fontSize}
          onSaveQuestion={onSaveQuestion}
          onSendToPractice={onSendToPractice}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
