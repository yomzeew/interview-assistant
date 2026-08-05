import { getDb } from './db.js';
import type { SavedQuestion } from '@ica/shared';
import { v4 as uuidv4 } from 'uuid';

export const questionsRepo = {
  async getAll(): Promise<SavedQuestion[]> {
    const db = await getDb();
    return db.getAllFromIndex('savedQuestions', 'by-createdAt');
  },
  async save(q: Omit<SavedQuestion, 'id' | 'createdAt' | 'updatedAt'>): Promise<SavedQuestion> {
    const db = await getDb();
    const now = Date.now();
    const record: SavedQuestion = { id: uuidv4(), createdAt: now, updatedAt: now, ...q };
    await db.put('savedQuestions', record);
    return record;
  },
  async update(id: string, patch: Partial<Pick<SavedQuestion, 'text' | 'notes'>>): Promise<void> {
    const db = await getDb();
    const existing = await db.get('savedQuestions', id);
    if (!existing) throw new Error('Question not found');
    await db.put('savedQuestions', { ...existing, ...patch, updatedAt: Date.now() });
  },
  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('savedQuestions', id);
  },
};
