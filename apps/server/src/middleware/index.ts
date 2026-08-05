import { json, type RequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

export const securityMiddleware = (): RequestHandler[] => [
  helmet() as unknown as RequestHandler,
  cors({
    origin: (origin, cb) => {
      // Allow all chrome-extension:// origins (ID differs per install/machine)
      if (!origin || origin.startsWith('chrome-extension://')) {
        cb(null, true);
        return;
      }
      const allowed = ['http://localhost:3000', 'http://localhost:5173'];
      if (allowed.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
  }) as RequestHandler,
  json({ limit: '512kb' }),
];

export const apiRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

export const practiceRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many Practice Mode requests, please wait.' },
});
