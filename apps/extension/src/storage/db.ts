import { openDB, type IDBPDatabase } from 'idb';
import type { SavedQuestion, SessionInfo, TranscriptSegment, AppSettings } from '@ica/shared';

// Stored settings record includes the idb keyPath field
export type SettingsRecord = AppSettings & { key: 'settings' };

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
}

let dbPromise: Promise<IDBPDatabase<IcaDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<IcaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<IcaDB>('ica-db', 1, {
      upgrade(db) {
        const sessStore = db.createObjectStore('sessions', { keyPath: 'sessionId' });
        sessStore.createIndex('by-startTime', 'startTime');

        const txStore = db.createObjectStore('transcripts', { keyPath: 'id' });
        txStore.createIndex('by-session', 'sessionId');

        const qStore = db.createObjectStore('savedQuestions', { keyPath: 'id' });
        qStore.createIndex('by-createdAt', 'createdAt');

        // Single-record settings store keyed on 'settings'
        db.createObjectStore('settings', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}
