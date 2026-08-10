import React, { useState, useEffect, useRef } from 'react';
import { settingsRepo } from '../../storage/settings-repo.js';
import { questionsRepo } from '../../storage/questions-repo.js';
import { sessionsRepo, transcriptsRepo } from '../../storage/sessions-repo.js';
import type { AppSettings, Language, Project } from '@ica/shared';
import { LANGUAGE_LABELS } from '@ica/shared';

const LANGUAGES = Object.entries(LANGUAGE_LABELS) as [Language, string][];

/** Chip-based skill tag input */
function SkillsInput({ value, onChange }: { value: string; onChange(v: string): void }) {
  const [input, setInput] = useState('');
  const skills = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];

  const add = () => {
    const trimmed = input.trim();
    if (!trimmed || skills.includes(trimmed)) { setInput(''); return; }
    onChange([...skills, trimmed].join(', '));
    setInput('');
  };

  const remove = (skill: string) => {
    onChange(skills.filter(s => s !== skill).join(', '));
  };

  return (
    <div className="border border-gray-200 rounded p-2 min-h-[60px] flex flex-wrap gap-1.5">
      {skills.map(skill => (
        <span key={skill} className="inline-flex items-center gap-1 bg-accent/10 text-accent text-xs px-2 py-0.5 rounded-full">
          {skill}
          <button onClick={() => remove(skill)} className="hover:text-red-500 font-bold leading-none">×</button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={skills.length === 0 ? 'Type a skill and press Enter…' : 'Add more…'}
        className="flex-1 min-w-[120px] text-xs outline-none bg-transparent"
      />
    </div>
  );
}

function newProject(): Project {
  return { id: crypto.randomUUID(), name: '', role: '', stack: '', description: '', achievements: '' };
}

/** Inline edit form for a single project */
function ProjectCard({
  project,
  onSave,
  onDelete,
  defaultOpen,
}: {
  project: Project;
  onSave(p: Project): void;
  onDelete(): void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [draft, setDraft] = useState(project);

  const patch = (k: keyof Project, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const save = () => { onSave(draft); setOpen(false); };

  const headerLabel = draft.name || 'Untitled project';
  const stackLabel = draft.stack ? ` · ${draft.stack.split(',').slice(0, 3).join(', ')}` : '';

  return (
    <div className="border border-gray-200 rounded overflow-hidden">
      {/* Header row */}
      <button
        type="button"
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-gray-400 text-xs">{open ? '▾' : '▸'}</span>
        <span className="flex-1 min-w-0">
          <span className="text-xs font-medium text-gray-800 truncate">{headerLabel}</span>
          {stackLabel && (
            <span className="text-[10px] text-gray-400 ml-1">{stackLabel}</span>
          )}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-[10px] text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50"
        >
          Remove
        </button>
      </button>

      {/* Expanded edit form */}
      {open && (
        <div className="border-t border-gray-100 bg-gray-50 p-2.5 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Project name *</label>
              <input
                value={draft.name}
                onChange={(e) => patch('name', e.target.value)}
                placeholder="e.g. E-commerce Platform"
                className="w-full text-xs border border-gray-200 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-accent bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Your role *</label>
              <input
                value={draft.role}
                onChange={(e) => patch('role', e.target.value)}
                placeholder="e.g. Lead Frontend Engineer"
                className="w-full text-xs border border-gray-200 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-accent bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Tech stack</label>
            <input
              value={draft.stack}
              onChange={(e) => patch('stack', e.target.value)}
              placeholder="e.g. React, Node.js, PostgreSQL, AWS"
              className="w-full text-xs border border-gray-200 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-accent bg-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-600 mb-0.5">What the project does</label>
            <textarea
              rows={2}
              value={draft.description}
              onChange={(e) => patch('description', e.target.value)}
              placeholder="e.g. Multi-tenant SaaS platform handling 50k orders/day for 200+ retailers"
              className="w-full text-xs border border-gray-200 rounded p-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-accent bg-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
              Key achievements / impact
              <span className="ml-1 font-normal text-gray-400">(numbers make great STAR Results)</span>
            </label>
            <textarea
              rows={2}
              value={draft.achievements}
              onChange={(e) => patch('achievements', e.target.value)}
              placeholder="e.g. Reduced checkout latency 40%, scaled to 3× traffic, delivered 2 weeks early"
              className="w-full text-xs border border-gray-200 rounded p-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-accent bg-white"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => { setDraft(project); setOpen(false); }}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 bg-white">
              Cancel
            </button>
            <button type="button" onClick={save}
              className="text-xs text-white bg-accent hover:opacity-90 px-3 py-1 rounded">
              Save project
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsTab() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [cvStatus, setCvStatus] = useState<'idle' | 'parsing' | 'done' | 'error'>('idle');
  const [cvError, setCvError] = useState('');
  const [cvFileName, setCvFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const interviewDataRef = useRef<HTMLInputElement>(null);
  const [interviewDataName, setInterviewDataName] = useState('');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => { void settingsRepo.get().then(s => {
    setSettings(s);
    if (s.cvText) setCvStatus('done');
  }); }, []);

  // Auto-save 800ms after any change (skip the very first render)
  useEffect(() => {
    if (!settings) return;
    if (isFirstLoad.current) { isFirstLoad.current = false; return; }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      await settingsRepo.save(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }, 800);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [settings]);

  if (!settings) return <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Loading…</div>;

  const update = (patch: Partial<AppSettings>) => setSettings((s) => s ? { ...s, ...patch } : s);

  // Immediate save (used after file uploads so data isn't lost before debounce fires)
  const saveNow = async (patch: Partial<AppSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    await settingsRepo.save(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const clearHistory = async () => {
    if (!confirm('Delete all transcript history? This cannot be undone.')) return;
    const sessions = await sessionsRepo.getAll();
    await Promise.all(sessions.map(async (s) => {
      await transcriptsRepo.deleteBySession(s.sessionId);
      await sessionsRepo.delete(s.sessionId);
    }));
  };

  const handleCvUpload = async (file: File) => {
    setCvStatus('parsing');
    setCvFileName(file.name);
    setCvError('');
    try {
      const form = new FormData();
      form.append('cv', file);
      let res: Response;
      try {
        res = await fetch(`${settings.backendUrl}/api/parse-cv`, { method: 'POST', body: form });
      } catch (networkErr) {
        throw new Error(`Cannot reach server at ${settings.backendUrl} — is it running?`);
      }
      let json: { text?: string; error?: string } = {};
      try { json = await res.json() as typeof json; } catch { /* ignore */ }
      if (!res.ok || !json.text) throw new Error(json.error ?? `Server returned ${res.status}`);
      await saveNow({ cvText: json.text });
      setCvStatus('done');
    } catch (err) {
      setCvError(err instanceof Error ? err.message : String(err));
      setCvStatus('error');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-4">
      <section>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Connection</h2>
        <label className="block text-xs font-medium text-gray-700 mb-1">Backend URL</label>
        <input value={settings.backendUrl} onChange={(e) => update({ backendUrl: e.target.value })}
          className="w-full text-xs border border-gray-200 rounded p-1.5"
          placeholder="http://localhost:4000" />
        <p className="text-xs text-gray-400 mt-1">HTTPS required in production.</p>
      </section>

      <section>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Language</h2>
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Spoken Language</label>
            <select value={settings.spokenLanguage} onChange={(e) => update({ spokenLanguage: e.target.value as Language })}
              className="w-full text-xs border border-gray-200 rounded p-1.5">
              {LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Translate To</label>
            <select value={settings.targetLanguage} onChange={(e) => update({ targetLanguage: e.target.value as Language })}
              className="w-full text-xs border border-gray-200 rounded p-1.5">
              {LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-700">
            <input type="checkbox" checked={settings.autoDetectLanguage}
              onChange={(e) => update({ autoDetectLanguage: e.target.checked })} />
            Auto-detect spoken language
          </label>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Display</h2>
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Font Size</label>
            <select value={settings.fontSize} onChange={(e) => update({ fontSize: e.target.value as AppSettings['fontSize'] })}
              className="w-full text-xs border border-gray-200 rounded p-1.5">
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-700">
            <input type="checkbox" checked={settings.compactMode}
              onChange={(e) => update({ compactMode: e.target.checked })} />
            Compact mode
          </label>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Privacy & Storage</h2>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-gray-700">
            <input type="checkbox" checked={settings.saveTranscriptsLocally}
              onChange={(e) => update({ saveTranscriptsLocally: e.target.checked })} />
            Save transcripts locally
          </label>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Audio Retention (days, 0 = never store)</label>
            <input type="number" min={0} max={365} value={settings.audioRetentionDays}
              onChange={(e) => update({ audioRetentionDays: parseInt(e.target.value, 10) || 0 })}
              className="w-24 text-xs border border-gray-200 rounded p-1.5" />
          </div>
          <button onClick={() => void clearHistory()}
            className="text-xs text-red-500 hover:underline">
            🗑 Delete all transcript history
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">📁 Past Projects</h2>
        <p className="text-xs text-gray-400 mb-2">
          Add projects you've worked on. The AI picks the most relevant one as the <strong>Action</strong> step in STAR answers — giving concrete, believable examples instead of generics.
        </p>
        <div className="space-y-1.5">
          {(settings.projects ?? []).map((p, idx) => (
            <ProjectCard
              key={p.id}
              project={p}
              onSave={(updated) => {
                const next = (settings.projects ?? []).map((x) => x.id === updated.id ? updated : x);
                update({ projects: next });
              }}
              onDelete={() => {
                update({ projects: (settings.projects ?? []).filter((x) => x.id !== p.id) });
              }}
              defaultOpen={idx === (settings.projects ?? []).length - 1 && p.name === ''}
            />
          ))}
          <button
            type="button"
            onClick={() => update({ projects: [...(settings.projects ?? []), newProject()] })}
            className="w-full text-xs border border-dashed border-gray-300 rounded p-2 text-gray-500 hover:border-accent hover:text-accent transition-colors"
          >
            + Add project
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">🤖 AI Context</h2>
        <p className="text-xs text-gray-400 mb-3">
          Tell the AI about yourself so it tailors answers to your background and the role you're applying for.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Your Background
              <span className="ml-1 font-normal text-gray-400">(experience, skills, stack)</span>
            </label>
            <textarea
              rows={4}
              value={settings.userProfile ?? ''}
              onChange={(e) => update({ userProfile: e.target.value })}
              placeholder="e.g. Software developer with 8 years experience. Specialist in React, Node.js, TypeScript and AWS. Led teams of up to 6 engineers. Previously at Fintech startups."
              className="w-full text-xs border border-gray-200 rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Job Description
              <span className="ml-1 font-normal text-gray-400">(paste the JD you're interviewing for)</span>
            </label>
            <textarea
              rows={5}
              value={settings.jobDescription ?? ''}
              onChange={(e) => update({ jobDescription: e.target.value })}
              placeholder="Paste the job description here. The AI will use it to tailor answers to what the interviewer is likely looking for."
              className="w-full text-xs border border-gray-200 rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Job Essentials
              <span className="ml-1 font-normal text-gray-400">(key requirements for this role)</span>
            </label>
            <textarea
              rows={3}
              value={settings.jobEssentials ?? ''}
              onChange={(e) => update({ jobEssentials: e.target.value })}
              placeholder="e.g. Must have experience with microservices architecture. Strong communication skills. Agile/Scrum experience required."
              className="w-full text-xs border border-gray-200 rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Skills Required
              <span className="ml-1 font-normal text-gray-400">(type and press Enter to add)</span>
            </label>
            <SkillsInput
              value={settings.skillsRequired ?? ''}
              onChange={(v) => update({ skillsRequired: v })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Upload CV / Resume
              <span className="ml-1 font-normal text-gray-400">(.pdf, .docx, .txt)</span>
            </label>
            {settings.cvText ? (
              <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                <span>✓ CV loaded ({settings.cvText.length.toLocaleString()} chars{cvFileName ? ` — ${cvFileName}` : ''})</span>
                <button
                  onClick={() => { void saveNow({ cvText: '' }); setCvStatus('idle'); setCvFileName(''); }}
                  className="ml-auto text-red-400 hover:text-red-600 font-bold"
                >
                  Remove
                </button>
              </div>
            ) : cvStatus === 'parsing' ? (
              <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-600">
                Parsing {cvFileName}…
              </div>
            ) : cvStatus === 'error' ? (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                ⚠️ {cvError || 'Upload failed'}
              </div>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleCvUpload(file);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-1.5 w-full text-xs border border-dashed border-gray-300 rounded p-2 text-gray-500 hover:border-accent hover:text-accent transition-colors"
            >
              {settings.cvText ? '📄 Replace CV' : '📄 Choose CV file'}
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Interview Preparation Data
              <span className="ml-1 font-normal text-gray-400">(.txt — Q&amp;A examples, notes, company info)</span>
            </label>
            <p className="text-xs text-gray-400 mb-1.5">
              The AI will use this file to mirror your style and pull from your prepared answers during the interview.
            </p>
            {settings.interviewData ? (
              <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                <span>✓ Data loaded ({settings.interviewData.length.toLocaleString()} chars{interviewDataName ? ` — ${interviewDataName}` : ''})</span>
                <button
                  onClick={() => { void saveNow({ interviewData: '' }); setInterviewDataName(''); }}
                  className="ml-auto text-red-400 hover:text-red-600 font-bold"
                >
                  Remove
                </button>
              </div>
            ) : null}
            <input
              ref={interviewDataRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setInterviewDataName(file.name);
                const reader = new FileReader();
                reader.onload = () => {
                  void saveNow({ interviewData: (reader.result as string) ?? '' });
                };
                reader.readAsText(file, 'utf-8');
                e.target.value = '';
              }}
            />
            <button
              onClick={() => interviewDataRef.current?.click()}
              className="mt-1.5 w-full text-xs border border-dashed border-gray-300 rounded p-2 text-gray-500 hover:border-accent hover:text-accent transition-colors"
            >
              {settings.interviewData ? '📋 Replace interview data' : '📋 Upload interview data (.txt)'}
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">🤖 AI Provider</h2>
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Provider
              <span className="ml-1 font-normal text-gray-400">(overrides server default)</span>
            </label>
            <select
              value={settings.aiProvider ?? 'server-default'}
              onChange={(e) => update({ aiProvider: e.target.value as AppSettings['aiProvider'] })}
              className="w-full text-xs border border-gray-200 rounded p-1.5"
            >
              <option value="server-default">Server default (use env var)</option>
              <option value="groq">Groq LLaMA 3 — free, fast (requires GROQ_API_KEY on server)</option>
              <option value="claude">Claude — highest quality (requires ANTHROPIC_API_KEY on server)</option>
            </select>
          </div>
          <p className="text-[10px] text-gray-400">
            When set, every answer and summary in this session uses this provider, regardless of server configuration.
            Falls back to server default if the chosen provider isn't configured on the server.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">🎙️ Transcription Provider</h2>
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Provider
              <span className="ml-1 font-normal text-gray-400">(overrides server default)</span>
            </label>
            <select
              value={settings.transcriptionProvider ?? 'server-default'}
              onChange={(e) => update({ transcriptionProvider: e.target.value as AppSettings['transcriptionProvider'] })}
              className="w-full text-xs border border-gray-200 rounded p-1.5"
            >
              <option value="server-default">Server default (use env var)</option>
              <option value="groq">Groq Whisper — fast, free, good accuracy</option>
              <option value="assemblyai">AssemblyAI — real-time, native speaker labels (auto-falls back to Groq)</option>
            </select>
          </div>
          <p className="text-[10px] text-gray-400">
            AssemblyAI requires <code className="bg-gray-100 px-0.5 rounded">ASSEMBLYAI_API_KEY</code> on the server. If it expires mid-session, Groq takes over automatically.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">🎙️ Question Detection</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Confidence threshold —{' '}
              <span className="font-normal text-gray-400">
                only flag a segment as a question when the detector is this confident
              </span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0.55}
                max={0.95}
                step={0.05}
                value={settings.questionConfidenceThreshold ?? 0.65}
                onChange={(e) => update({ questionConfidenceThreshold: parseFloat(e.target.value) })}
                className="flex-1"
              />
              <span className="text-xs font-medium w-10 text-right">
                {Math.round((settings.questionConfidenceThreshold ?? 0.65) * 100)}%
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>More questions</span>
              <span>Fewer, higher confidence</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              65% = captures behavioral &amp; indirect questions. 80% = strong interrogatives only. 95% = question mark required.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Exclude speaker from question detection
              <span className="ml-1 font-normal text-gray-400">(panel interviews — ignore yourself echoing back)</span>
            </label>
            <select
              value={settings.excludedSpeaker ?? ''}
              onChange={(e) => update({ excludedSpeaker: e.target.value })}
              className="w-full text-xs border border-gray-200 rounded p-1.5"
            >
              <option value="">No exclusion (default)</option>
              <option value="Speaker 1">Speaker 1</option>
              <option value="Speaker 2">Speaker 2</option>
              <option value="Speaker 3">Speaker 3</option>
            </select>
            <p className="text-[10px] text-gray-400 mt-1">
              Speaker labels appear on transcript cards during a live session. Set this to whichever label matches your own voice.
            </p>
          </div>
        </div>
      </section>

      <div className={`text-center text-xs py-1 transition-opacity duration-500 ${saved ? 'text-green-600 opacity-100' : 'opacity-0'}`}>
        ✓ Settings saved
      </div>
    </div>
  );
}
