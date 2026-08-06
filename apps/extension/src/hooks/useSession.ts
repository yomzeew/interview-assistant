import { useState, useCallback, useRef, useEffect } from 'react';
import type { ConnectionState, Language, SessionInfo } from '@ica/shared';
import type { ServerEvent } from '@ica/shared';
import type { TranscriptEntry } from '../types/index.js';
import { settingsRepo } from '../storage/settings-repo.js';
import { sessionsRepo } from '../storage/sessions-repo.js';

const SESSION_STORAGE_KEY = 'ica_transcripts';

function saveTranscriptsToSession(transcripts: TranscriptEntry[]): void {
  void chrome.storage.session.set({ [SESSION_STORAGE_KEY]: transcripts });
}

async function loadTranscriptsFromSession(): Promise<TranscriptEntry[]> {
  const result = await chrome.storage.session.get(SESSION_STORAGE_KEY);
  return (result[SESSION_STORAGE_KEY] as TranscriptEntry[] | undefined) ?? [];
}

export interface SessionState {
  connectionState: ConnectionState;
  sessionId: string | null;
  transcripts: TranscriptEntry[];
  elapsedSeconds: number;
  currentTabId: number | null;
  currentTabTitle: string | null;
  error: string | null;
}

export function useSession() {
  const [state, setState] = useState<SessionState>({
    connectionState: 'idle',
    sessionId: null,
    transcripts: [],
    elapsedSeconds: 0,
    currentTabId: null,
    currentTabTitle: null,
    error: null,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const listenerRef = useRef<((msg: unknown) => void) | null>(null);

  // On mount: load any existing transcripts from session storage (pop-out window support)
  useEffect(() => {
    void loadTranscriptsFromSession().then((transcripts) => {
      if (transcripts.length > 0) {
        setState((s) => ({ ...s, transcripts }));
      }
    });
  }, []);

  // Update transcripts and persist to session storage so pop-out windows stay in sync
  const setTranscripts = useCallback((updater: (prev: TranscriptEntry[]) => TranscriptEntry[]) => {
    setState((s) => {
      const next = updater(s.transcripts);
      saveTranscriptsToSession(next);
      return { ...s, transcripts: next };
    });
  }, []);

  const handleServerEvent = useCallback((raw: string) => {
    let event: ServerEvent;
    try { event = JSON.parse(raw) as ServerEvent; } catch { return; }

    switch (event.type) {
      case 'session.ready':
        setState((s) => ({ ...s, connectionState: 'connected', error: null }));
        break;

      case 'transcript.partial':
        setTranscripts((prev) => {
          const exists = prev.some((t) => t.id === event.id);
          const updated: TranscriptEntry = { id: event.id, text: event.text, startedAt: event.startedAt, isPartial: true, isQuestion: false };
          return exists ? prev.map((t) => t.id === event.id ? { ...t, text: event.text } : t) : [...prev, updated];
        });
        break;

      case 'transcript.final':
        setTranscripts((prev) => {
          const entry: TranscriptEntry = {
            id: event.id, text: event.text, startedAt: event.startedAt,
            endedAt: event.endedAt, isPartial: false, isQuestion: event.isQuestion,
            speakerLabel: 'Meeting audio',
          };
          const exists = prev.some((t) => t.id === event.id);
          return exists ? prev.map((t) => t.id === event.id ? entry : t) : [...prev, entry];
        });
        break;

      case 'translation.final':
        setTranscripts((prev) => prev.map((t) =>
          t.id === event.transcriptId
            ? { ...t, translation: { transcriptId: event.transcriptId, text: event.text, language: event.language, detectedLanguage: event.detectedLanguage } }
            : t
        ));
        break;

      case 'live.answer':
        setTranscripts((prev) => prev.map((t) =>
          t.id === event.transcriptId
            ? { ...t, liveAnswer: { transcriptId: event.transcriptId, question: event.question, answer: event.answer, keyPoints: event.keyPoints } }
            : t
        ));
        break;

      case 'session.error':
        setState((s) => ({ ...s, connectionState: 'error', error: event.message }));
        break;
    }
  }, [setTranscripts]);

  const start = useCallback(async () => {
    setState((s) => ({ ...s, connectionState: 'connecting', error: null, transcripts: [] }));

    try {
      // When running as a pop-out window, the tabId of the meeting tab is passed via URL param
      const paramTabId = new URLSearchParams(window.location.search).get('tabId');
      let tab: chrome.tabs.Tab | undefined;
      if (paramTabId) {
        tab = await chrome.tabs.get(parseInt(paramTabId, 10));
      } else {
        [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      }
      if (!tab?.id) throw new Error('No active tab found');

      const settings = await settingsRepo.get();

      const res = await fetch(`${settings.backendUrl}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spokenLanguage: settings.spokenLanguage,
          targetLanguage: settings.targetLanguage,
          userProfile: settings.userProfile || undefined,
          jobDescription: settings.jobDescription || undefined,
          jobEssentials: settings.jobEssentials || undefined,
          skillsRequired: settings.skillsRequired || undefined,
          cvText: settings.cvText || undefined,
          interviewData: settings.interviewData || undefined,
        }),
      });
      if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);

      const { sessionId, websocketToken, websocketUrl } = await res.json() as {
        sessionId: string; websocketToken: string; websocketUrl: string;
      };

      sessionIdRef.current = sessionId;
      setState((s) => ({ ...s, sessionId, currentTabId: tab.id!, currentTabTitle: tab.title ?? 'Meeting Tab' }));

      const sessionInfo: SessionInfo = {
        sessionId, startTime: Date.now(), sourceTabId: tab.id,
        meetingTitle: tab.title, spokenLanguage: settings.spokenLanguage,
        targetLanguage: settings.targetLanguage, connectionState: 'connecting',
      };
      await sessionsRepo.save(sessionInfo);

      // Register message listener (remove old one first)
      if (listenerRef.current) {
        chrome.runtime.onMessage.removeListener(listenerRef.current);
      }
      const listener = (msg: unknown) => {
        const m = msg as { type: string; data?: string };
        if (m.type === 'bg.serverEvent' && m.data) handleServerEvent(m.data);
      };
      listenerRef.current = listener;
      chrome.runtime.onMessage.addListener(listener);

      const captureResp = await chrome.runtime.sendMessage({
        type: 'bg.startCapture', tabId: tab.id, backendWsUrl: websocketUrl, wsToken: websocketToken,
      }) as { ok?: boolean; error?: string };

      if (captureResp?.error) throw new Error(captureResp.error);

      timerRef.current = setInterval(() => {
        setState((s) => ({ ...s, elapsedSeconds: s.elapsedSeconds + 1 }));
      }, 1000);
    } catch (err) {
      setState((s) => ({ ...s, connectionState: 'error', error: String(err) }));
    }
  }, [handleServerEvent]);

  const pause = useCallback(async () => {
    await chrome.runtime.sendMessage({ type: 'bg.pauseCapture' });
    setState((s) => ({ ...s, connectionState: 'paused' }));
  }, []);

  const resume = useCallback(async () => {
    await chrome.runtime.sendMessage({ type: 'bg.resumeCapture' });
    setState((s) => ({ ...s, connectionState: 'connected' }));
  }, []);

  const stop = useCallback(async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (listenerRef.current) {
      chrome.runtime.onMessage.removeListener(listenerRef.current);
      listenerRef.current = null;
    }
    await chrome.runtime.sendMessage({ type: 'bg.stopCapture' });
    if (sessionIdRef.current) {
      const settings = await settingsRepo.get();
      await fetch(`${settings.backendUrl}/api/sessions/${sessionIdRef.current}`, { method: 'DELETE' }).catch(() => null);
    }
    void chrome.storage.session.remove(SESSION_STORAGE_KEY);
    setState((s) => ({ ...s, connectionState: 'idle', sessionId: null, elapsedSeconds: 0, transcripts: [] }));
    sessionIdRef.current = null;
  }, []);

  const retryAnswer = useCallback(async (transcriptId: string, question: string) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    const settings = await settingsRepo.get();
    try {
      const res = await fetch(`${settings.backendUrl}/api/sessions/${sessionId}/retry-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcriptId, question }),
      });
      if (!res.ok) return;
      const result = await res.json() as { answer: string; keyPoints: string[] };
      setTranscripts((prev) => prev.map((t) =>
        t.id === transcriptId
          ? { ...t, liveAnswer: { transcriptId, question, answer: result.answer, keyPoints: result.keyPoints ?? [] } }
          : t
      ));
    } catch {
      // silently ignore — user can retry again
    }
  }, [setTranscripts]);

  return { state, start, pause, resume, stop, retryAnswer };
}
