import { describe, it, expect, beforeEach } from 'vitest';
import { sessionStore } from '../services/session-store.js';

const MOCK_SESSION = {
  sessionId: 'test-id-001',
  websocketToken: 'tok-abc',
  createdAt: Date.now(),
  spokenLanguage: 'en' as const,
  targetLanguage: 'fr' as const,
  paused: false,
};

describe('sessionStore', () => {
  beforeEach(() => {
    sessionStore.delete(MOCK_SESSION.sessionId);
  });

  it('creates and retrieves a session', () => {
    sessionStore.create(MOCK_SESSION);
    expect(sessionStore.get('test-id-001')).toMatchObject({ sessionId: 'test-id-001' });
  });

  it('returns undefined for unknown session', () => {
    expect(sessionStore.get('nonexistent')).toBeUndefined();
  });

  it('finds session by token', () => {
    sessionStore.create(MOCK_SESSION);
    const found = sessionStore.getByToken('tok-abc');
    expect(found?.sessionId).toBe('test-id-001');
  });

  it('updates a session field', () => {
    sessionStore.create(MOCK_SESSION);
    sessionStore.update('test-id-001', { paused: true });
    expect(sessionStore.get('test-id-001')?.paused).toBe(true);
  });

  it('deletes a session', () => {
    sessionStore.create(MOCK_SESSION);
    expect(sessionStore.delete('test-id-001')).toBe(true);
    expect(sessionStore.get('test-id-001')).toBeUndefined();
  });
});
