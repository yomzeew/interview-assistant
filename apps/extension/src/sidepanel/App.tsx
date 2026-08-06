import React, { useState, useEffect, useCallback } from 'react';
import Onboarding from '../components/Onboarding.js';
import Header from '../components/Header.js';
import { usePiP } from '../hooks/usePiP.js';
import CaptionsTab from '../components/tabs/CaptionsTab.js';
import TranslationTab from '../components/tabs/TranslationTab.js';
import SavedQuestionsTab from '../components/tabs/SavedQuestionsTab.js';
import PracticeModeTab from '../components/tabs/PracticeModeTab.js';
import SettingsTab from '../components/tabs/SettingsTab.js';
import { useSession } from '../hooks/useSession.js';
import { settingsRepo } from '../storage/settings-repo.js';
import { questionsRepo } from '../storage/questions-repo.js';
import type { Tab, TranscriptEntry } from '../types/index.js';
import type { AppSettings } from '@ica/shared';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'captions', label: 'Captions', icon: '🎙️' },
  { id: 'translation', label: 'Translation', icon: '🌐' },
  { id: 'saved', label: 'Saved', icon: '📝' },
  { id: 'practice', label: 'Practice', icon: '🎯' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function App() {
  const [privacyAccepted, setPrivacyAccepted] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('captions');
  const [practiceQuestion, setPracticeQuestion] = useState('');
  const [practiceKey, setPracticeKey] = useState(0);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [summaryMarkdown, setSummaryMarkdown] = useState<string | null>(null);
  const { state, start, pause, resume, stop, retryAnswer } = useSession();
  const pip = usePiP();

  // Keep PiP window in sync whenever transcripts or answers change
  useEffect(() => {
    if (pip.pipOpen) pip.update(state.transcripts, settings?.fontSize ?? 'medium');
  }, [state.transcripts, pip.pipOpen, settings?.fontSize]);

  const popOut = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tab?.id ?? '';
    await chrome.windows.create({
      url: chrome.runtime.getURL(`sidepanel.html?tabId=${tabId}`),
      type: 'popup',
      width: 420,
      height: 720,
      focused: true,
    });
  }, []);

  useEffect(() => {
    void (async () => {
      const s = await settingsRepo.get();
      setPrivacyAccepted(s.privacyAccepted);
      setSettings(s);
    })();
  }, []);

  const handleSendToPractice = useCallback((question: string) => {
    setPracticeQuestion(question);
    setPracticeKey((k) => k + 1); // force re-mount with new question
    setActiveTab('practice');
  }, []);

  const handleSaveQuestion = useCallback(async (entry: TranscriptEntry) => {
    await questionsRepo.save({ text: entry.text, notes: '', transcriptId: entry.id });
  }, []);

  const handlePrivacyAccepted = useCallback(async () => {
    const s = await settingsRepo.get();
    setSettings(s);
    setPrivacyAccepted(true);
  }, []);

  if (privacyAccepted === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!privacyAccepted) {
    return <Onboarding onAccepted={() => void handlePrivacyAccepted()} />;
  }

  const fontSize = settings?.fontSize ?? 'medium';

  return (
    <div className={`h-screen flex flex-col bg-background font-size-${fontSize}`}>
      <Header
        connectionState={state.connectionState}
        tabTitle={state.currentTabTitle}
        elapsedSeconds={state.elapsedSeconds}
        onStart={() => void start()}
        onPause={() => void pause()}
        onResume={() => void resume()}
        onStop={async () => {
          const md = await stop();
          if (md) setSummaryMarkdown(md);
        }}
        onPopOut={() => void popOut()}
        onPiP={() => pip.pipOpen ? pip.close() : void pip.open()}
        pipOpen={pip.pipOpen}
      />

      {state.error && (
        <div role="alert" className="bg-red-50 border-b border-red-200 px-3 py-1.5 text-xs text-red-700">
          ⚠️ {state.error}
        </div>
      )}

      <nav className="flex border-b border-gray-200 bg-white flex-shrink-0" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-label={tab.label}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              activeTab === tab.id
                ? 'border-b-2 border-accent text-accent'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="text-base leading-none" aria-hidden>{tab.icon}</span>
            <span className="block text-[10px] mt-0.5">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Session summary modal */}
      {summaryMarkdown && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50 p-3">
          <div className="bg-white rounded-xl w-full shadow-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm text-gray-800">📋 Interview Summary Ready</h2>
              <button onClick={() => setSummaryMarkdown(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>
            <p className="text-xs text-gray-500">Your AI-generated post-interview review is ready to download.</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const blob = new Blob([summaryMarkdown], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `interview-summary-${new Date().toISOString().slice(0,10)}.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex-1 bg-accent text-white text-xs py-2 rounded-lg font-medium hover:opacity-90"
              >
                ⬇️ Download .md
              </button>
              <button
                onClick={() => void navigator.clipboard.writeText(summaryMarkdown).then(() => setSummaryMarkdown(null))}
                className="flex-1 border border-gray-200 text-gray-700 text-xs py-2 rounded-lg font-medium hover:bg-gray-50"
              >
                📋 Copy to clipboard
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden" role="tabpanel">
        {activeTab === 'captions' && (
          <CaptionsTab
            transcripts={state.transcripts}
            fontSize={fontSize}
            onSaveQuestion={(entry) => void handleSaveQuestion(entry)}
            onSendToPractice={handleSendToPractice}
            onRetryAnswer={retryAnswer}
          />
        )}
        {activeTab === 'translation' && (
          <TranslationTab transcripts={state.transcripts} fontSize={fontSize} />
        )}
        {activeTab === 'saved' && (
          <SavedQuestionsTab onSendToPractice={handleSendToPractice} />
        )}
        {activeTab === 'practice' && (
          <PracticeModeTab key={practiceKey} initialQuestion={practiceQuestion} />
        )}
        {activeTab === 'settings' && (
          <SettingsTab />
        )}
      </div>
    </div>
  );
}
