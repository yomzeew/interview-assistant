/**
 * Document Picture-in-Picture hook.
 *
 * Opens a floating window that Chrome EXCLUDES from screen capture when the
 * user shares a tab (e.g. in Google Meet, Zoom web, Teams web).
 *
 * API: https://developer.chrome.com/docs/web-platform/document-picture-in-picture
 * Available in Chrome 116+ (all Chromium-based browsers).
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import type { TranscriptEntry } from '../types/index.js';

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(opts: { width: number; height: number }): Promise<Window>;
      window: Window | null;
    };
  }
}

const FONT_SIZE_PX: Record<string, number> = { small: 12, medium: 14, large: 16 };

function buildHtml(transcripts: TranscriptEntry[], fontSize: string): string {
  const fs = FONT_SIZE_PX[fontSize] ?? 14;
  const recent = transcripts.slice(-6); // show last 6 entries

  const items = recent.map((t) => {
    const isQ = t.isQuestion;
    const bg = isQ ? '#eff6ff' : '#fff';
    const border = isQ ? '#3b82f6' : '#e5e7eb';
    const answer = t.liveAnswer
      ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #bfdbfe;font-size:${fs - 1}px;color:#1e40af">
          <b>🤖 Answer:</b> ${escHtml(t.liveAnswer.answer)}
         </div>`
      : (isQ && !t.isPartial
        ? `<div style="margin-top:6px;font-size:${fs - 1}px;color:#3b82f6;font-style:italic">🤖 Thinking…</div>`
        : '');
    return `<div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:10px;margin-bottom:8px;opacity:${t.isPartial ? 0.6 : 1}">
      ${isQ ? '<span style="background:#3b82f6;color:#fff;font-size:10px;padding:1px 6px;border-radius:9999px;margin-bottom:4px;display:inline-block">❓ Question</span><br>' : ''}
      <span style="font-size:${fs}px;font-weight:600;color:#111">${escHtml(t.text)}</span>
      ${answer}
    </div>`;
  }).join('');

  return `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
             background: #f9fafb; padding: 10px; overflow-y: auto; height: 100%; }
      #title { font-size: 10px; color: #9ca3af; margin-bottom: 8px; letter-spacing: .05em; text-transform: uppercase; }
    </style>
  </head><body>
    <div id="title">🎙 Live Captions — hidden from screen share</div>
    <div id="content">${items || '<p style="color:#9ca3af;font-size:13px;text-align:center;margin-top:40px">Waiting for captions…</p>'}</div>
  </body></html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function usePiP() {
  const pipRef = useRef<Window | null>(null);
  const [pipOpen, setPipOpen] = useState(false);

  const isSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  const open = useCallback(async () => {
    if (!isSupported) {
      alert('Document Picture-in-Picture is not supported in this browser.\n\nUse Chrome 116+ and share only your meeting TAB (not your whole screen) to keep this panel hidden.');
      return;
    }
    try {
      const pip = await window.documentPictureInPicture!.requestWindow({ width: 400, height: 560 });
      pipRef.current = pip;
      setPipOpen(true);
      pip.addEventListener('pagehide', () => { pipRef.current = null; setPipOpen(false); });
    } catch (err) {
      console.error('PiP failed:', err);
    }
  }, [isSupported]);

  const close = useCallback(() => {
    pipRef.current?.close();
    pipRef.current = null;
    setPipOpen(false);
  }, []);

  // Update PiP content whenever transcripts or answer state changes
  const update = useCallback((transcripts: TranscriptEntry[], fontSize: string) => {
    const pip = pipRef.current;
    if (!pip || pip.closed) return;
    pip.document.open();
    pip.document.write(buildHtml(transcripts, fontSize));
    pip.document.close();
    // Auto-scroll to bottom
    pip.scrollTo({ top: pip.document.body.scrollHeight, behavior: 'smooth' });
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { pipRef.current?.close(); }, []);

  return { isSupported, pipOpen, open, close, update };
}
