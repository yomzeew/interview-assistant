import React, { useState } from 'react';
import type { AnswerStyle, ExperienceLevel, GeneratePracticeAnswerOutput, ReviewPracticeAnswerOutput } from '@ica/shared';
import { settingsRepo } from '../../storage/settings-repo.js';

interface Props { initialQuestion?: string }

const ANSWER_STYLES: { value: AnswerStyle; label: string }[] = [
  { value: 'concise', label: 'Concise' }, { value: 'star', label: 'STAR' },
  { value: 'technical', label: 'Technical' }, { value: 'behavioural', label: 'Behavioural' },
  { value: 'leadership', label: 'Leadership' }, { value: 'system-design', label: 'System Design' },
];

const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string }[] = [
  { value: 'junior', label: 'Junior' }, { value: 'mid-level', label: 'Mid-level' },
  { value: 'senior', label: 'Senior' }, { value: 'lead', label: 'Lead' }, { value: 'principal', label: 'Principal' },
];

export default function PracticeModeTab({ initialQuestion = '' }: Props) {
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(false);
  const [question, setQuestion] = useState(initialQuestion);
  const [role, setRole] = useState('');
  const [expLevel, setExpLevel] = useState<ExperienceLevel>('mid-level');
  const [answerStyle, setAnswerStyle] = useState<AnswerStyle>('star');
  const [technologies, setTechnologies] = useState('');
  const [experienceNotes, setExperienceNotes] = useState('');
  const [myAnswer, setMyAnswer] = useState('');
  const [result, setResult] = useState<GeneratePracticeAnswerOutput | null>(null);
  const [review, setReview] = useState<ReviewPracticeAnswerOutput | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!disclaimerAcknowledged) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 max-w-sm">
          <p className="text-2xl mb-3">⚠️</p>
          <h2 className="font-bold text-gray-800 mb-2">Practice Mode</h2>
          <p className="text-sm text-gray-700 mb-4">
            <strong>Practice Mode is intended for mock interviews and preparation only.</strong> Do not use generated answers where an employer requires unaided responses.
          </p>
          <button
            onClick={() => setDisclaimerAcknowledged(true)}
            className="bg-accent text-white text-sm font-semibold py-2 px-6 rounded hover:bg-blue-400 transition-colors"
          >
            I Understand — Enter Practice Mode
          </button>
        </div>
      </div>
    );
  }

  async function getBackendUrl() {
    const s = await settingsRepo.get();
    return s.backendUrl;
  }

  async function generateAnswer() {
    setLoading('Generating answer…'); setError(null); setResult(null);
    try {
      const url = await getBackendUrl();
      const res = await fetch(`${url}/api/practice/generate-answer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question, role, experienceLevel: expLevel, answerStyle,
          technologies: technologies.split(',').map((t) => t.trim()).filter(Boolean),
          experienceNotes: experienceNotes || undefined,
        }),
      });
      if (!res.ok) throw new Error('Generation failed');
      setResult(await res.json() as GeneratePracticeAnswerOutput);
    } catch (e) { setError(String(e)); }
    finally { setLoading(null); }
  }

  async function reviewAnswer() {
    if (!myAnswer.trim()) return;
    setLoading('Reviewing your answer…'); setError(null); setReview(null);
    try {
      const url = await getBackendUrl();
      const res = await fetch(`${url}/api/practice/review-answer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer: myAnswer, role, experienceLevel: expLevel }),
      });
      if (!res.ok) throw new Error('Review failed');
      setReview(await res.json() as ReviewPracticeAnswerOutput);
    } catch (e) { setError(String(e)); }
    finally { setLoading(null); }
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-yellow-800">
        🎯 Practice Mode — AI answers for preparation only
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-700">Question</label>
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded p-2 resize-none" rows={3}
          placeholder="Enter or paste an interview question…" />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
            <input value={role} onChange={(e) => setRole(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded p-1.5"
              placeholder="e.g. Software Engineer" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Experience</label>
            <select value={expLevel} onChange={(e) => setExpLevel(e.target.value as ExperienceLevel)}
              className="w-full text-xs border border-gray-200 rounded p-1.5">
              {EXPERIENCE_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Answer Style</label>
          <div className="flex flex-wrap gap-1">
            {ANSWER_STYLES.map((s) => (
              <button key={s.value} onClick={() => setAnswerStyle(s.value)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${answerStyle === s.value ? 'bg-accent text-white border-accent' : 'border-gray-200 hover:border-accent'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Technologies (comma-separated)</label>
          <input value={technologies} onChange={(e) => setTechnologies(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded p-1.5"
            placeholder="React, Node.js, TypeScript" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Your Experience Notes</label>
          <textarea value={experienceNotes} onChange={(e) => setExperienceNotes(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded p-1.5 resize-none" rows={2}
            placeholder="Brief notes on your relevant experience (Claude will not invent experience you haven't mentioned)" />
        </div>

        <button onClick={() => void generateAnswer()} disabled={!question.trim() || !role.trim() || !!loading}
          className="w-full bg-accent text-white text-sm font-semibold py-2 rounded hover:bg-blue-400 disabled:opacity-50 transition-colors">
          {loading === 'Generating answer…' ? loading : '✨ Generate Answer'}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-2">{error}</div>}

      {result && (
        <div className="space-y-3">
          <div className="border border-gray-200 rounded-lg p-3 bg-white">
            <h3 className="text-xs font-bold text-gray-700 mb-2">Generated Answer</h3>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{result.answer}</p>
          </div>
          {result.keyPoints.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-3 bg-white">
              <h3 className="text-xs font-bold text-gray-700 mb-1">Key Points</h3>
              <ul className="list-disc list-inside text-xs text-gray-700 space-y-0.5">
                {result.keyPoints.map((kp, i) => <li key={i}>{kp}</li>)}
              </ul>
            </div>
          )}
          {result.missingDetails.length > 0 && (
            <div className="border border-yellow-200 rounded-lg p-3 bg-yellow-50">
              <h3 className="text-xs font-bold text-yellow-800 mb-1">💡 Add These Details</h3>
              <ul className="list-disc list-inside text-xs text-yellow-700 space-y-0.5">
                {result.missingDetails.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>
          )}
          {result.followUpQuestions.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-3 bg-white">
              <h3 className="text-xs font-bold text-gray-700 mb-1">Follow-up Questions</h3>
              <ul className="list-disc list-inside text-xs text-gray-600 space-y-0.5">
                {result.followUpQuestions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-gray-100 pt-3">
        <label className="block text-xs font-medium text-gray-700 mb-1">Get Feedback on Your Answer</label>
        <textarea value={myAnswer} onChange={(e) => setMyAnswer(e.target.value)}
          className="w-full text-xs border border-gray-200 rounded p-1.5 resize-none" rows={4}
          placeholder="Type your answer here to get Claude's feedback…" />
        <button onClick={() => void reviewAnswer()} disabled={!myAnswer.trim() || !question.trim() || !!loading}
          className="mt-2 w-full bg-primary text-white text-sm font-semibold py-2 rounded hover:opacity-90 disabled:opacity-50 transition-opacity">
          {loading === 'Reviewing your answer…' ? loading : '📊 Review My Answer'}
        </button>
      </div>

      {review && (
        <div className="border border-gray-200 rounded-lg p-3 bg-white space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-700">Feedback</h3>
            <span className="text-sm font-bold text-accent">{review.score}/10</span>
          </div>
          <p className="text-xs text-gray-700">{review.feedback}</p>
          {review.strengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-700 mb-0.5">✅ Strengths</p>
              <ul className="list-disc list-inside text-xs text-green-700 space-y-0.5">
                {review.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
          {review.improvements.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-orange-700 mb-0.5">🔧 Improvements</p>
              <ul className="list-disc list-inside text-xs text-orange-700 space-y-0.5">
                {review.improvements.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
