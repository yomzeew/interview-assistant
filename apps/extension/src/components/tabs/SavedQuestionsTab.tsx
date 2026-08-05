import React, { useState, useEffect, useCallback } from 'react';
import { questionsRepo } from '../../storage/questions-repo.js';
import type { SavedQuestion } from '@ica/shared';

interface Props { onSendToPractice(q: string): void }

export default function SavedQuestionsTab({ onSendToPractice }: Props) {
  const [questions, setQuestions] = useState<SavedQuestion[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const load = useCallback(async () => {
    setQuestions(await questionsRepo.getAll());
  }, []);

  useEffect(() => { void load(); }, [load]);

  const deleteQ = async (id: string) => {
    await questionsRepo.delete(id);
    await load();
  };

  const saveEdit = async () => {
    if (!editing) return;
    await questionsRepo.update(editing, { text: editText, notes: editNotes });
    setEditing(null);
    await load();
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(questions, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'saved-questions.json'; a.click();
  };

  const exportTxt = () => {
    const text = questions.map((q, i) => `${i + 1}. ${q.text}${q.notes ? `\nNotes: ${q.notes}` : ''}`).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'saved-questions.txt'; a.click();
  };

  if (questions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm px-4 text-center">
        <div>
          <p className="text-2xl mb-2">📝</p>
          <p>No saved questions yet.</p>
          <p className="text-xs mt-1">Save questions from the Live Captions tab.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex gap-2 px-3 py-2 border-b border-gray-100">
        <button onClick={exportJson} className="text-xs text-accent hover:underline">Export JSON</button>
        <button onClick={exportTxt} className="text-xs text-accent hover:underline">Export TXT</button>
        <button onClick={() => {
          const text = questions.map((q) => q.text).join('\n');
          navigator.clipboard.writeText(text);
        }} className="text-xs text-accent hover:underline">Copy All</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {questions.map((q) => (
          <div key={q.id} className="border border-gray-200 rounded-lg p-3 bg-white">
            {editing === q.id ? (
              <div className="space-y-2">
                <textarea value={editText} onChange={(e) => setEditText(e.target.value)}
                  className="w-full text-sm border rounded p-1.5 resize-none" rows={3} />
                <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Notes…" className="w-full text-xs border rounded p-1.5 resize-none" rows={2} />
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="text-xs bg-accent text-white px-2 py-1 rounded">Save</button>
                  <button onClick={() => setEditing(null)} className="text-xs text-gray-500 hover:underline">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-800 mb-1">{q.text}</p>
                {q.notes && <p className="text-xs text-gray-500 italic mb-2">{q.notes}</p>}
                <div className="flex gap-3 flex-wrap">
                  <button onClick={() => { setEditing(q.id); setEditText(q.text); setEditNotes(q.notes); }}
                    className="text-xs text-accent hover:underline">Edit</button>
                  <button onClick={() => onSendToPractice(q.text)}
                    className="text-xs text-accent hover:underline">Practice →</button>
                  <button onClick={() => navigator.clipboard.writeText(q.text)}
                    className="text-xs text-gray-500 hover:underline">Copy</button>
                  <button onClick={() => void deleteQ(q.id)}
                    className="text-xs text-red-500 hover:underline">Delete</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
