import React from 'react';
import type { ConnectionState } from '@ica/shared';

interface Props {
  connectionState: ConnectionState;
  tabTitle: string | null;
  elapsedSeconds: number;
  onStart(): void;
  onPause(): void;
  onResume(): void;
  onStop(): void;
  onPopOut(): void;
  onPiP(): void;
  pipOpen: boolean;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

const STATE_COLORS: Record<ConnectionState, string> = {
  idle: 'bg-gray-400',
  connecting: 'bg-yellow-400 animate-pulse',
  connected: 'bg-green-500',
  paused: 'bg-yellow-500',
  error: 'bg-red-500',
  disconnected: 'bg-gray-500',
};

const STATE_LABELS: Record<ConnectionState, string> = {
  idle: 'Idle', connecting: 'Connecting…', connected: 'Live',
  paused: 'Paused', error: 'Error', disconnected: 'Disconnected',
};

export default function Header({ connectionState, tabTitle, elapsedSeconds, onStart, onPause, onResume, onStop, onPopOut, onPiP, pipOpen }: Props) {
  const isIdle = connectionState === 'idle' || connectionState === 'error' || connectionState === 'disconnected';
  const isLive = connectionState === 'connected';
  const isPaused = connectionState === 'paused';

  return (
    <header className="bg-primary text-white px-3 py-2 flex-shrink-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${STATE_COLORS[connectionState]}`} aria-hidden />
          <span className="text-xs font-medium">{STATE_LABELS[connectionState]}</span>
          {(isLive || isPaused) && (
            <span className="text-xs text-blue-200 ml-1">{formatTime(elapsedSeconds)}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {tabTitle && (
            <span className="text-xs text-blue-200 truncate max-w-[100px]" title={tabTitle}>{tabTitle}</span>
          )}
          <button
            onClick={onPiP}
            className={`text-xs transition-colors px-1 py-0.5 rounded hover:bg-white/10 ${pipOpen ? 'text-yellow-300' : 'text-blue-200 hover:text-white'}`}
            title={pipOpen ? 'PiP captions open — hidden from screen share' : 'Open captions in Picture-in-Picture (hidden from screen share)'}
            aria-label="Picture-in-Picture captions"
          >
            {pipOpen ? '🟡' : '🎬'}
          </button>
          <button
            onClick={onPopOut}
            className="text-xs text-blue-200 hover:text-white transition-colors px-1 py-0.5 rounded hover:bg-white/10"
            title="Pop out to a separate window"
            aria-label="Pop out"
          >
            ⧉
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        {isIdle && (
          <button onClick={onStart} className="flex-1 bg-accent hover:bg-blue-400 text-white text-xs font-semibold py-1.5 px-3 rounded transition-colors" aria-label="Start capture">
            ▶ Start
          </button>
        )}
        {isLive && (
          <>
            <button onClick={onPause} className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-white text-xs font-semibold py-1.5 px-3 rounded transition-colors" aria-label="Pause">
              ⏸ Pause
            </button>
            <button onClick={onStop} className="flex-1 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold py-1.5 px-3 rounded transition-colors" aria-label="Stop">
              ■ Stop
            </button>
          </>
        )}
        {isPaused && (
          <>
            <button onClick={onResume} className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold py-1.5 px-3 rounded transition-colors" aria-label="Resume">
              ▶ Resume
            </button>
            <button onClick={onStop} className="flex-1 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold py-1.5 px-3 rounded transition-colors" aria-label="Stop">
              ■ Stop
            </button>
          </>
        )}
        {connectionState === 'connecting' && (
          <div className="flex-1 text-center text-xs text-blue-200 py-1.5">Connecting…</div>
        )}
      </div>
    </header>
  );
}
