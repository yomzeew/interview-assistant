import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function createWebSocketToken(sessionId: string): string {
  return jwt.sign({ sessionId }, env.SESSION_TOKEN_SECRET, {
    expiresIn: env.SESSION_TOKEN_TTL_SECONDS,
  });
}

export function verifyWebSocketToken(token: string): { sessionId: string } {
  const payload = jwt.verify(token, env.SESSION_TOKEN_SECRET) as { sessionId: string };
  return { sessionId: payload.sessionId };
}
