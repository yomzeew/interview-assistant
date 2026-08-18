import React, { useState, useEffect, useCallback } from 'react';
import type { TranscriptEntry } from '../types/index.js';
import { answerRatingsRepo, answerHistoryRepo } from '../storage/answer-ratings-repo.js';
import type { AnswerHistoryEntry } from '../storage/db.js';

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
  const [rating, setRating] = useState<'good' | 'bad' | null>(null);
  const [history, setHistory] = useState<AnswerHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load existing rating and history for this question
  useEffect(() => {
    if (!entry.liveAnswer) return;
    void answerRatingsRepo.getRatingForTranscript(entry.id).then(setRating);
    void answerHistoryRepo.getHistory(entry.text).then((h) => {
      // Exclude the current session's answer (last entry) from "past" history display
      setHistory(h.slice(0, -1));
    });
  }, [entry.id, entry.text, entry.liveAnswer]);

  const rateAnswer = useCallback(async (r: 'good' | 'bad') => {
    if (!entry.liveAnswer) return;
    setRating(r);
    await answerRatingsRepo.rate({
      transcriptId: entry.id,
      question: entry.text,
      answer: entry.liveAnswer.answer,
      rating: r,
    });
    await answerHistoryRepo.updateRating(entry.text, r);
  }, [entry.id, entry.text, entry.liveAnswer]);

  const isFailed = entry.liveAnswer?.answer?.startsWith(FAILED_ANSWER_MARKER);
  const awaitingAnswer = entry.isQuestion && !entry.isPartial && !entry.liveAnswer;

  // Track whether the one automatic retry has already fired
  const [autoRetried, setAutoRetried] = useState(false);
  // Show a timeout error if no answer arrives within 12 seconds
  const [timedOut, setTimedOut] = useState(false);

  const retry = useCallback(async () => {
    if (retrying) return;
    setRetrying(true);
    setTimedOut(false);
    await onRetryAnswer(entry.id, entry.text);
    setRetrying(false);
  }, [retrying, entry.id, entry.text, onRetryAnswer]);

  // Auto-retry once (after 2s) on first failure only
  useEffect(() => {
    if (!isFailed || autoRetried) return;
    const timer = setTimeout(() => {
      setAutoRetried(true);
      void retry();
    }, 2000);
    return () => clearTimeout(timer);
  }, [isFailed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Timeout: if still awaiting after 12s, show a manual retry prompt
  useEffect(() => {
    if (!awaitingAnswer) return;
    const timer = setTimeout(() => setTimedOut(true), 12_000);
    return () => clearTimeout(timer);
  }, [awaitingAnswer]);

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
          {formatTimestamp(entry.startedAt)}
          {entry.speakerLabel && entry.speakerLabel !== 'Meeting audio'
            ? <span className="ml-1 text-purple-500 font-medium">{entry.speakerLabel}</span>
            : <span className="ml-1">— Meeting audio</span>}
        </span>
        <div className="flex items-center gap-1.5">
          {entry.isQuestion && (
            <span className="text-xs bg-accent text-white px-1.5 py-0.5 rounded-full">❓ Question</span>
          )}
          {entry.isPartial && <span className="text-xs text-gray-400 italic">…</span>}
        </div>
      </div>

      {/* Confidence meter — shown only on finalised questions */}
      {entry.isQuestion && !entry.isPartial && entry.confidence !== undefined && (
        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                entry.confidence >= 0.85 ? 'bg-green-400' :
                entry.confidence >= 0.70 ? 'bg-yellow-400' : 'bg-orange-400'
              }`}
              style={{ width: `${Math.round(entry.confidence * 100)}%` }}
            />
          </div>
          <span className={`text-[10px] font-medium tabular-nums ${
            entry.confidence >= 0.85 ? 'text-green-600' :
            entry.confidence >= 0.70 ? 'text-yellow-600' : 'text-orange-500'
          }`}>
            {Math.round(entry.confidence * 100)}%
          </span>
        </div>
      )}

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

      {/* Awaiting AI answer */}
      {awaitingAnswer && !timedOut && (
        <div className="mt-3 pt-2 border-t border-blue-200">
          <div className="flex items-center gap-1.5 text-xs text-accent font-semibold mb-1">
            <span>🤖 AI is thinking</span>
            <ThinkingDots />
          </div>
        </div>
      )}

      {/* Timed out — no answer arrived (likely AI not configured) */}
      {awaitingAnswer && timedOut && (
        <div className="mt-3 pt-2 border-t border-orange-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-orange-500">⚠️ No answer — check AI provider in Settings</span>
            <button onClick={() => void retry()} disabled={retrying}
              className="text-xs text-accent hover:underline disabled:opacity-50">
              {retrying ? 'Retrying…' : 'Retry now'}
            </button>
          </div>
        </div>
      )}

      {/* Answer failed (provider returned error marker) */}
      {entry.liveAnswer && isFailed && (
        <div className="mt-3 pt-2 border-t border-orange-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-orange-500">
              {retrying
                ? '🔄 Retrying…'
                : autoRetried
                ? '⚠️ Answer failed — AI may be unavailable'
                : '⚠️ Answer failed — retrying in 2s'}
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

          {/* Rating + history row */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-gray-400">Was this helpful?</span>
            <button
              onClick={() => void rateAnswer('good')}
              className={`text-sm transition-transform hover:scale-110 ${rating === 'good' ? 'opacity-100' : 'opacity-40 hover:opacity-80'}`}
              aria-label="Good answer"
            >👍</button>
            <button
              onClick={() => void rateAnswer('bad')}
              className={`text-sm transition-transform hover:scale-110 ${rating === 'bad' ? 'opacity-100' : 'opacity-40 hover:opacity-80'}`}
              aria-label="Bad answer"
            >👎</button>

            {history.length > 0 && (
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="ml-auto text-[10px] text-gray-400 hover:text-accent underline"
              >
                {showHistory ? 'Hide' : `📚 ${history.length} past answer${history.length > 1 ? 's' : ''}`}
              </button>
            )}
          </div>

          {/* Past answers panel */}
          {showHistory && history.length > 0 && (
            <div className="mt-2 border-t border-gray-100 pt-2 space-y-2">
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Past answers for this question</p>
              {history.map((h, i) => (
                <div key={i} className="bg-gray-50 rounded p-2 text-xs text-gray-600">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-gray-400">{new Date(h.createdAt).toLocaleDateString()}</span>
                    {h.rating && <span>{h.rating === 'good' ? '👍' : '👎'}</span>}
                  </div>
                  <p className="leading-snug">{h.answer}</p>
                </div>
              ))}
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
