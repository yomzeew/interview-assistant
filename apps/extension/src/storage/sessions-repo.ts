import { getDb } from './db.js';
import type { SessionInfo, TranscriptSegment } from '@ica/shared';

export const sessionsRepo = {
  async save(session: SessionInfo): Promise<void> {
    const db = await getDb();
    await db.put('sessions', session);
  },
  async getAll(): Promise<SessionInfo[]> {
    const db = await getDb();
    return db.getAllFromIndex('sessions', 'by-startTime');
  },
  async delete(sessionId: string): Promise<void> {
    const db = await getDb();
    await db.delete('sessions', sessionId);
  },
};

export const transcriptsRepo = {
  async save(segment: TranscriptSegment & { sessionId: string }): Promise<void> {
    const db = await getDb();
    await db.put('transcripts', segment);
  },
  async getBySession(sessionId: string): Promise<(TranscriptSegment & { sessionId: string })[]> {
    const db = await getDb();
    return db.getAllFromIndex('transcripts', 'by-session', sessionId);
  },
  async deleteBySession(sessionId: string): Promise<void> {
    const db = await getDb();
    const all = await db.getAllKeysFromIndex('transcripts', 'by-session', sessionId);
    await Promise.all(all.map((k) => db.delete('transcripts', k)));
  },
};
