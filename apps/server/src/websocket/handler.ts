import type { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { verifyWebSocketToken } from '../utils/token.js';
import { sessionStore } from '../services/session-store.js';
import { createTranscriptionProvider } from '../providers/transcription/index.js';
import { createTranslationProvider } from '../providers/translation/index.js';
import { createLiveAnswerProvider } from '../providers/claude/index.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { ServerEvent, ClientMessage, Language } from '@ica/shared';
import type { TranscriptionSession } from '../providers/transcription/types.js';

function send(ws: WebSocket, event: ServerEvent): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

export async function handleWebSocketConnection(
  ws: WebSocket,
  req: IncomingMessage
): Promise<void> {
  const url = new URL(req.url ?? '/', `http://localhost`);
  const token = url.searchParams.get('token') ?? '';

  let sessionId: string;
  try {
    ({ sessionId } = verifyWebSocketToken(token));
  } catch {
    send(ws, { type: 'session.error', code: 'AUTH_FAILED', message: 'Invalid or expired token' });
    ws.close(1008, 'Unauthorized');
    return;
  }

  const session = sessionStore.get(sessionId);
  if (!session) {
    send(ws, { type: 'session.error', code: 'SESSION_NOT_FOUND', message: 'Session not found' });
    ws.close(1008, 'Session not found');
    return;
  }

  sessionStore.update(sessionId, { ws });
  send(ws, { type: 'session.ready', sessionId });

  const transcriptionProvider = createTranscriptionProvider();
  const translationProvider = createTranslationProvider();

  let liveAnswerProvider: ReturnType<typeof createLiveAnswerProvider> | null = null;
  try {
    liveAnswerProvider = createLiveAnswerProvider();
  } catch {
    logger.warn('Live answer provider unavailable (no ANTHROPIC_API_KEY)');
  }

  let transcriptionSession: TranscriptionSession | null = null;

  async function startTranscription(): Promise<void> {
    const sess = sessionStore.get(sessionId);
    transcriptionSession = await transcriptionProvider.createSession({
      language: sess?.spokenLanguage,
      sampleRate: 16000,
    });

    transcriptionSession.onPartial((event) => {
      send(ws, { type: 'transcript.partial', ...event });
    });

    transcriptionSession.onFinal(async (event) => {
      const currentSession = sessionStore.get(sessionId);
      send(ws, { type: 'transcript.final', ...event });

      // Translation
      const targetLang = currentSession?.targetLanguage ?? 'en';
      const sourceLang = currentSession?.spokenLanguage ?? 'en';
      if (targetLang !== sourceLang) {
        try {
          const translation = await translationProvider.translate({
            text: event.text,
            sourceLanguage: sourceLang as Language,
            targetLanguage: targetLang as Language,
          });
          send(ws, {
            type: 'translation.final',
            transcriptId: event.id,
            text: translation.text,
            language: targetLang as Language,
            detectedLanguage: translation.detectedLanguage,
          });
        } catch (err) {
          logger.error({ err }, 'Translation failed');
        }
      }

      // Live answer for high-confidence questions (≥0.65 threshold)
      if (event.isQuestion && event.confidence >= 0.65 && liveAnswerProvider) {
        try {
          const sess = sessionStore.get(sessionId);
          const result = await liveAnswerProvider.answerQuestion({
            transcriptId: event.id,
            question: event.text,
            userProfile: sess?.userProfile,
            jobDescription: sess?.jobDescription,
            jobEssentials: sess?.jobEssentials,
            skillsRequired: sess?.skillsRequired,
            cvText: sess?.cvText,
            interviewData: sess?.interviewData,
          });
          send(ws, {
            type: 'live.answer',
            transcriptId: result.transcriptId,
            question: result.question,
            answer: result.answer,
            keyPoints: result.keyPoints,
          });
        } catch (err) {
          logger.error({ err }, 'Live answer generation failed');
        }
      }
    });
  }

  await startTranscription();

  ws.on('message', async (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      return;
    }

    const currentSession = sessionStore.get(sessionId);
    if (!currentSession) return;

    switch (msg.type) {
      case 'audio.chunk': {
        if (currentSession.paused || !transcriptionSession) break;
        const buf = Buffer.from(msg.data, 'base64');
        await transcriptionSession.sendAudio(buf);
        break;
      }
      case 'session.pause':
        sessionStore.update(sessionId, { paused: true });
        break;
      case 'session.resume':
        sessionStore.update(sessionId, { paused: false });
        break;
      case 'session.stop':
        await transcriptionSession?.close();
        transcriptionSession = null;
        ws.close(1000, 'Session stopped');
        break;
      case 'config.update':
        sessionStore.update(sessionId, {
          ...(msg.spokenLanguage && { spokenLanguage: msg.spokenLanguage }),
          ...(msg.targetLanguage && { targetLanguage: msg.targetLanguage }),
        });
        break;
    }
  });

  ws.on('close', async () => {
    await transcriptionSession?.close();
    sessionStore.update(sessionId, { ws: undefined });
    logger.info({ sessionId }, 'WebSocket closed');
  });

  ws.on('error', (err) => {
    logger.error({ err, sessionId }, 'WebSocket error');
  });
}
