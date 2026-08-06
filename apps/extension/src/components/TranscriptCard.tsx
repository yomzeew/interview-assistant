import React, { useState, useEffect, useCallback } from 'react';
import type { TranscriptEntry } from '../types/index.js';

interface Props {
  entry: TranscriptEntry;
  onSaveQuestion(entry: TranscriptEntry): void;
  onSendToPractice(question: string): void;
  onRetryAnswer(transcriptId: string, question: string): Promise<void>;
  fontSize: 'small' | 'medium' | 'large';
}

const FAILED_ANSWER_MARKER = '⚠️ AI answer unavailable';

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Animated "Claude is thinking" dots */
function ThinkingDots() {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d % 3) + 1), 450);
    return () => clearInterval(id);
  }, []);
  return <span className="text-accent font-bold">{'.'.repeat(dots)}</span>;
}

export default function TranscriptCard({ entry, onSaveQuestion, onSendToPractice, onRetryAnswer, fontSize }: Props) {
  const sizeClass = `font-size-${fontSize}`;
  const [retrying, setRetrying] = useState(false);

  const isFailed = entry.liveAnswer?.answer?.startsWith(FAILED_ANSWER_MARKER);
  const awaitingAnswer = entry.isQuestion && !entry.isPartial && !entry.liveAnswer;

  const retry = useCallback(async () => {
    if (retrying) return;
    setRetrying(true);
    await onRetryAnswer(entry.id, entry.text);
    setRetrying(false);
  }, [retrying, entry.id, entry.text, onRetryAnswer]);

  // Auto-retry after 2 seconds if the answer failed
  useEffect(() => {
    if (!isFailed) return;
    const timer = setTimeout(() => void retry(), 2000);
    return () => clearTimeout(timer);
  }, [isFailed]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <article
      className={`border rounded-lg p-3 mb-2 transition-colors ${
        entry.isQuestion ? 'border-accent bg-blue-50' : 'border-gray-200 bg-white'
      } ${entry.isPartial ? 'opacity-60' : ''}`}
      aria-label={entry.isQuestion ? 'Detected question' : 'Transcript segment'}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">
          {formatTimestamp(entry.startedAt)} — {entry.speakerLabel ?? 'Meeting audio'}
        </span>
        <div className="flex items-center gap-1.5">
          {entry.isQuestion && (
            <span className="text-xs bg-accent text-white px-1.5 py-0.5 rounded-full">❓ Question</span>
          )}
          {entry.isPartial && <span className="text-xs text-gray-400 italic">…</span>}
        </div>
      </div>

      {/* Transcript text — rendered word by word as partial updates arrive */}
      <p className={`${sizeClass} text-gray-900 leading-snug font-medium`}>{entry.text}</p>

      {/* Translation */}
      {entry.translation && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-0.5">
            🌐 Translation ({entry.translation.language.toUpperCase()})
          </p>
          <p className={`${sizeClass} text-gray-600 italic`}>{entry.translation.text}</p>
        </div>
      )}

      {/* Claude AI answer — shown automatically, no expand button needed */}
      {awaitingAnswer && (
        <div className="mt-3 pt-2 border-t border-blue-200">
          <div className="flex items-center gap-1.5 text-xs text-accent font-semibold mb-1">
            <span>🤖 Claude is thinking</span>
            <ThinkingDots />
          </div>
        </div>
      )}

      {entry.liveAnswer && isFailed && (
        <div className="mt-3 pt-2 border-t border-orange-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-orange-500">
              {retrying ? '🔄 Retrying…' : '⚠️ Answer failed — retrying in 2s'}
            </span>
            <button
              onClick={() => void retry()}
              disabled={retrying}
              className="text-xs text-accent hover:underline disabled:opacity-50"
            >
              Retry now
            </button>
          </div>
        </div>
      )}

      {entry.liveAnswer && !isFailed && (
        <div className="mt-3 pt-2 border-t border-blue-200">
          <p className="text-xs font-semibold text-accent mb-1.5">🤖 Claude's Answer</p>

          {/* Full answer text */}
          <p className={`${sizeClass} text-gray-800 leading-relaxed mb-2`}>
            {entry.liveAnswer.answer}
          </p>

          {/* STAR key points */}
          {entry.liveAnswer.keyPoints.length > 0 && (
            <div className="mt-2 space-y-1">
              {entry.liveAnswer.keyPoints.map((kp, i) => {
                // Extract label prefix like "S:", "T:", "A:", "R:"
                const match = kp.match(/^([STAR]):\s*/i);
                const label = match?.[1]?.toUpperCase();
                const body = match ? kp.slice(match[0].length) : kp;
                const colors: Record<string, string> = {
                  S: 'bg-purple-100 text-purple-700',
                  T: 'bg-blue-100 text-blue-700',
                  A: 'bg-green-100 text-green-700',
                  R: 'bg-orange-100 text-orange-700',
                };
                const chip = label ? colors[label] ?? 'bg-gray-100 text-gray-600' : 'bg-gray-100 text-gray-600';
                return (
                  <div key={i} className="flex items-start gap-1.5 text-xs">
                    {label
                      ? <span className={`flex-shrink-0 font-bold px-1.5 py-0.5 rounded text-[10px] ${chip}`}>{label}</span>
                      : <span className="text-accent mt-0.5 flex-shrink-0">•</span>
                    }
                    <span className="text-gray-700 leading-snug">{body}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Practice mode link */}
          <button
            onClick={() => onSendToPractice(entry.text)}
            className="mt-2 text-xs text-accent hover:underline font-medium"
          >
            🎯 Practice this question →
          </button>
        </div>
      )}

      {/* Save button */}
      {!entry.isPartial && entry.isQuestion && (
        <div className="mt-2 pt-1">
          <button
            onClick={() => onSaveQuestion(entry)}
            className="text-xs text-gray-500 hover:text-accent hover:underline"
            aria-label="Save question"
          >
            💾 Save question
          </button>
        </div>
      )}
    </article>
  );
}
