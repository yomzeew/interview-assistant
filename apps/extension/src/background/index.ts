// Background service worker — MV3

const OFFSCREEN_URL = chrome.runtime.getURL('offscreen.html');
let captureActive = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function ensureOffscreen(): Promise<void> {
  if (!(await chrome.offscreen.hasDocument())) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: [chrome.offscreen.Reason.USER_MEDIA],
      justification: 'Capture and process meeting tab audio',
    });
  }
}

async function stopCapture(): Promise<void> {
  captureActive = false;
  try {
    if (await chrome.offscreen.hasDocument()) {
      try {
        await chrome.runtime.sendMessage({ type: 'offscreen.stop' });
      } catch { /* offscreen may not be listening */ }
      // Give the offscreen doc time to stop tracks + release the stream
      await delay(900);
      await chrome.offscreen.closeDocument();
      // Give Chrome time to fully release the tab capture
      await delay(600);
    }
  } catch { /* ignore — offscreen may already be gone */ }
}

/** Wrap getMediaStreamId in a Promise */
function getStreamId(tabId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (id) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else if (!id) reject(new Error('No stream ID returned'));
      else resolve(id);
    });
  });
}

/** Retry getStreamId up to maxAttempts times on "active stream" errors */
async function getStreamIdWithRetry(tabId: number, maxAttempts = 4): Promise<string> {
  let lastErr: Error = new Error('Unknown error');
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await getStreamId(tabId);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      const isActiveStream =
        lastErr.message.includes('active stream') ||
        lastErr.message.includes('stream is being captured') ||
        lastErr.message.includes('Tab already');

      if (isActiveStream && attempt < maxAttempts - 1) {
        // Progressive backoff: 1.5s, 2s, 2.5s
        await delay(1500 + attempt * 500);
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Message handling ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  void (async () => {
    try {
      switch (msg.type) {
        case 'bg.startCapture': {
          const { tabId, backendWsUrl, wsToken } = msg as {
            tabId: number; backendWsUrl: string; wsToken: string;
          };

          // Always tear down any previous capture first.
          // This also handles SW restarts where captureActive was reset to false
          // but the tab stream is still live in Chrome.
          await stopCapture();
          await ensureOffscreen();

          let streamId: string;
          try {
            streamId = await getStreamIdWithRetry(tabId);
          } catch (err) {
            captureActive = false;
            sendResponse({ error: String(err) });
            return;
          }

          captureActive = true;
          void chrome.runtime.sendMessage({
            type: 'offscreen.start',
            streamId,
            backendWsUrl,
            wsToken,
          });
          sendResponse({ ok: true });
          break;
        }

        case 'bg.pauseCapture':
          void chrome.runtime.sendMessage({ type: 'offscreen.pause' });
          sendResponse({ ok: true });
          break;

        case 'bg.resumeCapture':
          void chrome.runtime.sendMessage({ type: 'offscreen.resume' });
          sendResponse({ ok: true });
          break;

        case 'bg.stopCapture':
          await stopCapture();
          sendResponse({ ok: true });
          break;

        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (err) {
      sendResponse({ error: String(err) });
    }
  })();
  return true; // keep channel open for async response
});

// ── Forward WS events from offscreen → side panel ────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  const m = msg as { type: string; data?: string };
  if (m.type === 'offscreen.wsMessage' && m.data) {
    void broadcastToSidePanel(m.data);
  }
  if (m.type === 'offscreen.wsOpen') {
    void broadcastToSidePanel(JSON.stringify({ type: 'session.ready' }));
  }
  if (m.type === 'offscreen.wsError' || m.type === 'offscreen.wsClosed') {
    captureActive = false;
    void broadcastToSidePanel(JSON.stringify({ type: 'session.error', code: 'WS_CLOSED', message: 'Connection lost' }));
  }
});

async function broadcastToSidePanel(data: string): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: 'bg.serverEvent', data });
  } catch { /* side panel may not be open */ }
}

// Open side panel when toolbar icon clicked
chrome.action.onClicked.addListener((tab) => {
  void chrome.sidePanel.open({ tabId: tab.id! });
});
