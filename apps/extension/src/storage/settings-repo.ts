import { getDb, type SettingsRecord } from './db.js';
import type { AppSettings } from '@ica/shared';

const DEFAULT_SETTINGS: AppSettings = {
  backendUrl: 'https://interview-caption-assistant.onrender.com',
  spokenLanguage: 'en',
  targetLanguage: 'en',
  autoDetectLanguage: false,
  fontSize: 'medium',
  compactMode: false,
  saveTranscriptsLocally: false,
  audioRetentionDays: 0,
  practiceDisclaimerAcknowledged: false,
  privacyAccepted: false,
  userProfile: '',
  jobDescription: '',
  jobEssentials: '',
  skillsRequired: '',
  cvText: '',
  interviewData: '',
};

export const settingsRepo = {
  async get(): Promise<AppSettings> {
    const db = await getDb();
    const row = await db.get('settings', 'settings');
    if (!row) return { ...DEFAULT_SETTINGS };
    const { key: _key, ...settings } = row;
    // Merge with defaults so any new fields added after first install are always present
    return { ...DEFAULT_SETTINGS, ...settings } as AppSettings;
  },

  async save(settings: AppSettings): Promise<void> {
    const db = await getDb();
    const record: SettingsRecord = { key: 'settings', ...settings };
    await db.put('settings', record);
  },
};
