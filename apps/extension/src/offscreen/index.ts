// Offscreen document: receives tab audio stream, resamples, sends PCM chunks
// to the background service worker which forwards them to the backend.

interface StartMessage {
  type: 'offscreen.start';
  streamId: string;
  backendWsUrl: string;
  wsToken: string;
}
interface PauseMessage { type: 'offscreen.pause' }
interface ResumeMessage { type: 'offscreen.resume' }
interface StopMessage { type: 'offscreen.stop' }

type OffscreenMessage = StartMessage | PauseMessage | ResumeMessage | StopMessage;

let audioContext: AudioContext | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let workletNode: AudioWorkletNode | null = null;
let stream: MediaStream | null = null;
let ws: WebSocket | null = null;
let paused = false;

async function start(msg: StartMessage): Promise<void> {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: msg.streamId } } as MediaTrackConstraints,
      video: false,
    });

    audioContext = new AudioContext({ sampleRate: 16000 });
    sourceNode = audioContext.createMediaStreamSource(stream);

    // Keep audio audible to the user
    sourceNode.connect(audioContext.destination);

    // PCM processor via AudioWorklet
    await audioContext.audioWorklet.addModule(chrome.runtime.getURL('audio-processor.js'));
    workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');

    workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (paused || !ws || ws.readyState !== WebSocket.OPEN) return;
      const base64 = btoa(String.fromCharCode(...new Uint8Array(e.data)));
      ws.send(JSON.stringify({ type: 'audio.chunk', data: base64 }));
    };

    sourceNode.connect(workletNode);

    // Connect WebSocket
    ws = new WebSocket(`${msg.backendWsUrl}?token=${msg.wsToken}`);
    ws.onopen = () => chrome.runtime.sendMessage({ type: 'offscreen.wsOpen' });
    ws.onmessage = (e) => chrome.runtime.sendMessage({ type: 'offscreen.wsMessage', data: e.data });
    ws.onerror = () => chrome.runtime.sendMessage({ type: 'offscreen.wsError' });
    ws.onclose = () => chrome.runtime.sendMessage({ type: 'offscreen.wsClosed' });
  } catch (err) {
    chrome.runtime.sendMessage({ type: 'offscreen.error', error: String(err) });
  }
}

function pause(): void { paused = true; ws?.send(JSON.stringify({ type: 'session.pause' })); }
function resume(): void { paused = false; ws?.send(JSON.stringify({ type: 'session.resume' })); }

async function stop(): Promise<void> {
  ws?.send(JSON.stringify({ type: 'session.stop' }));
  ws?.close();
  ws = null;
  workletNode?.disconnect();
  sourceNode?.disconnect();
  stream?.getTracks().forEach((t) => t.stop());
  await audioContext?.close();
  audioContext = null;
  sourceNode = null;
  workletNode = null;
  stream = null;
  paused = false;
}

chrome.runtime.onMessage.addListener((msg: OffscreenMessage) => {
  switch (msg.type) {
    case 'offscreen.start': void start(msg); break;
    case 'offscreen.pause': pause(); break;
    case 'offscreen.resume': resume(); break;
    case 'offscreen.stop': void stop(); break;
  }
});
