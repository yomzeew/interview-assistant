import { openDB, type IDBPDatabase } from 'idb';
import type { SavedQuestion, SessionInfo, TranscriptSegment, AppSettings } from '@ica/shared';

// Stored settings record includes the idb keyPath field
export type SettingsRecord = AppSettings & { key: 'settings' };

export interface AnswerRating {
  id: string;           // uuid
  transcriptId: string;
  sessionId?: string;
  question: string;
  answer: string;
  rating: 'good' | 'bad';
  createdAt: number;
}

export interface AnswerHistoryEntry {
  sessionId: string;
  question: string;
  answer: string;
  keyPoints: string[];
  rating?: 'good' | 'bad';
  createdAt: number;
}

export interface AnswerHistoryRecord {
  /** Normalised question text (lowercase, trimmed) used as primary key */
  questionNorm: string;
  entries: AnswerHistoryEntry[];
}

export interface IcaDB {
  settings: {
    key: 'settings';
    value: SettingsRecord;
  };
  sessions: {
    key: string;
    value: SessionInfo;
    indexes: { 'by-startTime': number };
  };
  transcripts: {
    key: string;
    value: TranscriptSegment & { sessionId: string };
    indexes: { 'by-session': string };
  };
  savedQuestions: {
    key: string;
    value: SavedQuestion;
    indexes: { 'by-createdAt': number };
  };
  answerRatings: {
    key: string;
    value: AnswerRating;
    indexes: { 'by-createdAt': number; 'by-transcriptId': string };
  };
  answerHistory: {
    key: string; // questionNorm
    value: AnswerHistoryRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<IcaDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<IcaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<IcaDB>('ica-db', 2, {
      upgrade(db, oldVersion) {
        // v1 stores (create only if not already present)
        if (oldVersion < 1) {
          const sessStore = db.createObjectStore('sessions', { keyPath: 'sessionId' });
          sessStore.createIndex('by-startTime', 'startTime');

          const txStore = db.createObjectStore('transcripts', { keyPath: 'id' });
          txStore.createIndex('by-session', 'sessionId');

          const qStore = db.createObjectStore('savedQuestions', { keyPath: 'id' });
          qStore.createIndex('by-createdAt', 'createdAt');

          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // v2 stores — answer ratings + answer history
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('answerRatings')) {
            const ratingStore = db.createObjectStore('answerRatings', { keyPath: 'id' });
            ratingStore.createIndex('by-createdAt', 'createdAt');
            ratingStore.createIndex('by-transcriptId', 'transcriptId');
          }
          if (!db.objectStoreNames.contains('answerHistory')) {
            db.createObjectStore('answerHistory', { keyPath: 'questionNorm' });
          }
        }
      },
    });
  }
  return dbPromise;
}
