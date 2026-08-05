import { Router } from 'express';
import {
  GeneratePracticeAnswerInputSchema,
  ReviewAnswerInputSchema,
  GenerateFollowUpsInputSchema,
} from '@ica/shared';
import { createPracticeCoachProvider } from '../providers/claude/index.js';
import { practiceRateLimiter } from '../middleware/index.js';
import { logger } from '../utils/logger.js';

export const practiceRouter = Router();
practiceRouter.use(practiceRateLimiter);

practiceRouter.post('/generate-answer', async (req, res) => {
  const result = GeneratePracticeAnswerInputSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }
  try {
    const provider = createPracticeCoachProvider();
    const output = await provider.generateAnswer(result.data);
    res.json(output);
  } catch (err) {
    logger.error({ err }, 'generate-answer failed');
    res.status(500).json({ error: 'Failed to generate answer' });
  }
});

practiceRouter.post('/generate-followups', async (req, res) => {
  const result = GenerateFollowUpsInputSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }
  try {
    const provider = createPracticeCoachProvider();
    const followUps = await provider.generateFollowUps(result.data);
    res.json({ followUpQuestions: followUps });
  } catch (err) {
    logger.error({ err }, 'generate-followups failed');
    res.status(500).json({ error: 'Failed to generate follow-ups' });
  }
});

practiceRouter.post('/review-answer', async (req, res) => {
  const result = ReviewAnswerInputSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }
  try {
    const provider = createPracticeCoachProvider();
    const output = await provider.reviewAnswer(result.data);
    res.json(output);
  } catch (err) {
    logger.error({ err }, 'review-answer failed');
    res.status(500).json({ error: 'Failed to review answer' });
  }
});
