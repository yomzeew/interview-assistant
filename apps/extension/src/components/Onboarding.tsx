import React from 'react';
import { settingsRepo } from '../storage/settings-repo.js';

interface Props { onAccepted(): void }

export default function Onboarding({ onAccepted }: Props) {
  const accept = async () => {
    const settings = await settingsRepo.get();
    await settingsRepo.save({ ...settings, privacyAccepted: true });
    onAccepted();
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto">
      <div className="bg-primary text-white p-4 text-center">
        <p className="text-2xl mb-1">🎙️</p>
        <h1 className="text-base font-bold">Interview Caption Assistant</h1>
        <p className="text-xs text-blue-200 mt-1">Real-time captions · Translation · Practice Mode</p>
      </div>

      <div className="p-4 space-y-4 flex-1">
        <section>
          <h2 className="font-semibold text-sm text-gray-800 mb-2">How It Works</h2>
          <ul className="space-y-2 text-xs text-gray-700">
            <li className="flex gap-2"><span>🎧</span><span>Audio from your active meeting tab is captured and streamed securely to the backend server you configure.</span></li>
            <li className="flex gap-2"><span>📝</span><span>Speech is converted to text in real time and displayed as captions.</span></li>
            <li className="flex gap-2"><span>🌐</span><span>Captions are translated into your chosen language.</span></li>
            <li className="flex gap-2"><span>💡</span><span>Detected interview questions receive suggested answers from Claude — clearly labelled.</span></li>
            <li className="flex gap-2"><span>🗑️</span><span>Audio is not permanently stored by default.</span></li>
          </ul>
        </section>

        <section className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <h2 className="font-semibold text-sm text-yellow-800 mb-1">⚠️ Practice Mode Notice</h2>
          <p className="text-xs text-yellow-700">
            AI-generated answers are <strong>only available in Practice Mode</strong>, clearly labelled as suggestions for preparation. Live caption answers are brief reference hints — do not present them as your own unaided responses where an employer prohibits assistance.
          </p>
        </section>

        <section className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <h2 className="font-semibold text-sm text-blue-800 mb-1">📋 Consent</h2>
          <p className="text-xs text-blue-700">
            You are responsible for obtaining any legally or contractually required consent from other meeting participants before recording or processing audio. By using this extension you confirm that you will do so.
          </p>
        </section>
      </div>

      <div className="p-4 border-t border-gray-100">
        <button onClick={() => void accept()}
          className="w-full bg-accent text-white font-semibold py-3 rounded-lg hover:bg-blue-400 transition-colors text-sm">
          I Understand — Get Started
        </button>
      </div>
    </div>
  );
}
