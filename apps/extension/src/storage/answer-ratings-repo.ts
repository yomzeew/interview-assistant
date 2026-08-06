import { v4 as uuidv4 } from 'uuid';
import { getDb, type AnswerRating, type AnswerHistoryEntry } from './db.js';

export const answerRatingsRepo = {
  async rate(params: {
    transcriptId: string;
    sessionId?: string;
    question: string;
    answer: string;
    rating: 'good' | 'bad';
  }): Promise<void> {
    const db = await getDb();
    const record: AnswerRating = { id: uuidv4(), createdAt: Date.now(), ...params };
    await db.put('answerRatings', record);
  },

  async getRatingForTranscript(transcriptId: string): Promise<'good' | 'bad' | null> {
    const db = await getDb();
    const results = await db.getAllFromIndex('answerRatings', 'by-transcriptId', transcriptId);
    return results[0]?.rating ?? null;
  },

  /** Returns most recent bad answers (for AI prompt injection) */
  async getRecentBadAnswers(limit = 5): Promise<AnswerRating[]> {
    const db = await getDb();
    const all = await db.getAllFromIndex('answerRatings', 'by-createdAt');
    return all.filter((r) => r.rating === 'bad').slice(-limit);
  },
};

export const answerHistoryRepo = {
  normalise(question: string): string {
    return question.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[?!.]+$/, '');
  },

  async record(params: {
    sessionId: string;
    question: string;
    answer: string;
    keyPoints: string[];
    rating?: 'good' | 'bad';
  }): Promise<void> {
    const db = await getDb();
    const questionNorm = this.normalise(params.question);
    const existing = await db.get('answerHistory', questionNorm);
    const entry: AnswerHistoryEntry = {
      sessionId: params.sessionId,
      question: params.question,
      answer: params.answer,
      keyPoints: params.keyPoints,
      createdAt: Date.now(),
      ...(params.rating !== undefined && { rating: params.rating }),
    };
    const updated = existing
      ? { questionNorm, entries: [...existing.entries, entry] }
      : { questionNorm, entries: [entry] };
    await db.put('answerHistory', updated);
  },

  async updateRating(question: string, rating: 'good' | 'bad'): Promise<void> {
    const db = await getDb();
    const questionNorm = this.normalise(question);
    const existing = await db.get('answerHistory', questionNorm);
    if (!existing || existing.entries.length === 0) return;
    // Update the most recent entry's rating
    const entries = [...existing.entries];
    const last = entries[entries.length - 1];
    if (last) entries[entries.length - 1] = { ...last, rating };
    await db.put('answerHistory', { questionNorm, entries });
  },

  async getHistory(question: string): Promise<AnswerHistoryEntry[]> {
    const db = await getDb();
    const questionNorm = this.normalise(question);
    const record = await db.get('answerHistory', questionNorm);
    return record?.entries ?? [];
  },
};
