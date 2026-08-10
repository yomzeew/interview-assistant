import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { env } from '../config/env.js';
import { sessionStore } from '../services/session-store.js';
import { createWebSocketToken } from '../utils/token.js';
import { createLiveAnswerProvider, createSummaryProvider } from '../providers/claude/index.js';
import type { SessionSummaryInput } from '../providers/claude/types.js';
import { logger } from '../utils/logger.js';

export const sessionsRouter = Router();

const CreateSessionBody = z.object({
  spokenLanguage: z.string().default('en'),
  targetLanguage: z.string().default('en'),
  userProfile: z.string().optional(),
  jobDescription: z.string().optional(),
  jobEssentials: z.string().optional(),
  skillsRequired: z.string().optional(),
  cvText: z.string().optional(),
  interviewData: z.string().optional(),
  dislikedAnswerPatterns: z.string().optional(),
  transcriptionProvider: z.enum(['groq', 'assemblyai']).optional(),
  aiProvider: z.enum(['groq', 'claude']).optional(),
  projectsContext: z.string().optional(),
});

sessionsRouter.post('/', (req, res) => {
  const result = CreateSessionBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const sessionId = uuidv4();
  const websocketToken = createWebSocketToken(sessionId);

  sessionStore.create({
    sessionId,
    websocketToken,
    createdAt: Date.now(),
    spokenLanguage: (result.data.spokenLanguage as 'en') ?? 'en',
    targetLanguage: (result.data.targetLanguage as 'en') ?? 'en',
    paused: false,
    userProfile: result.data.userProfile,
    jobDescription: result.data.jobDescription,
    jobEssentials: result.data.jobEssentials,
    skillsRequired: result.data.skillsRequired,
    cvText: result.data.cvText,
    interviewData: result.data.interviewData,
    dislikedAnswerPatterns: result.data.dislikedAnswerPatterns,
    transcriptionProvider: result.data.transcriptionProvider,
    aiProvider: result.data.aiProvider,
    projectsContext: result.data.projectsContext,
  });

  logger.info({ sessionId }, 'Session created');

  res.status(201).json({
    sessionId,
    websocketToken,
    websocketUrl: env.PUBLIC_WEBSOCKET_URL,
  });
});

// POST /api/sessions/:sessionId/retry-answer
// Retries an AI answer for a question — called when the initial answer failed
sessionsRouter.post('/:sessionId/retry-answer', async (req, res) => {
  const { sessionId } = req.params;
  const { transcriptId, question } = req.body as { transcriptId?: string; question?: string };

  if (!transcriptId || !question) {
    res.status(400).json({ error: 'transcriptId and question are required' });
    return;
  }

  const sess = sessionStore.get(sessionId ?? '');
  if (!sess) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  try {
    const provider = createLiveAnswerProvider(sess.aiProvider);
    const result = await provider.answerQuestion({
      transcriptId,
      question,
      userProfile: sess.userProfile,
      jobDescription: sess.jobDescription,
      jobEssentials: sess.jobEssentials,
      skillsRequired: sess.skillsRequired,
      cvText: sess.cvText,
      interviewData: sess.interviewData,
      projectsContext: sess.projectsContext,
    });
    logger.info({ transcriptId, sessionId }, 'Retry answer OK');
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'Retry answer failed');
    res.status(500).json({ error: 'AI unavailable' });
  }
});

// POST /api/sessions/:sessionId/summary
// Generates an AI post-interview summary. Call this BEFORE DELETE so the session context is still available.
sessionsRouter.post('/:sessionId/summary', async (req, res) => {
  const { sessionId } = req.params;
  const sess = sessionStore.get(sessionId ?? '');
  if (!sess) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const body = req.body as {
    durationSeconds?: number;
    transcripts?: SessionSummaryInput['transcripts'];
  };

  try {
    const provider = createSummaryProvider(sess.aiProvider);
    const markdown = await provider.generateSessionSummary({
      durationSeconds: body.durationSeconds ?? 0,
      jobDescription: sess.jobDescription,
      userProfile: sess.userProfile,
      transcripts: body.transcripts ?? [],
    });
    logger.info({ sessionId }, 'Session summary generated');
    res.json({ markdown });
  } catch (err) {
    logger.error({ err }, 'Session summary failed');
    res.status(500).json({ error: 'Summary generation failed' });
  }
});

sessionsRouter.delete('/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const deleted = sessionStore.delete(sessionId ?? '');
  if (!deleted) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  logger.info({ sessionId }, 'Session deleted');
  res.status(204).send();
});
