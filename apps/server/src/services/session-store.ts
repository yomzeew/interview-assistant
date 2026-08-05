import type { ActiveSession } from '../types/index.js';

const sessions = new Map<string, ActiveSession>();

export const sessionStore = {
  create(session: ActiveSession): void {
    sessions.set(session.sessionId, session);
  },

  get(sessionId: string): ActiveSession | undefined {
    return sessions.get(sessionId);
  },

  getByToken(token: string): ActiveSession | undefined {
    for (const session of sessions.values()) {
      if (session.websocketToken === token) return session;
    }
    return undefined;
  },

  update(sessionId: string, patch: Partial<ActiveSession>): boolean {
    const existing = sessions.get(sessionId);
    if (!existing) return false;
    sessions.set(sessionId, { ...existing, ...patch });
    return true;
  },

  delete(sessionId: string): boolean {
    return sessions.delete(sessionId);
  },

  size(): number {
    return sessions.size;
  },
};
