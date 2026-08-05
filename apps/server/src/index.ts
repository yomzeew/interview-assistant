import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { securityMiddleware, apiRateLimiter } from './middleware/index.js';
import { sessionsRouter } from './routes/sessions.js';
import { practiceRouter } from './routes/practice.js';
import { parseCvRouter } from './routes/parse-cv.js';
import { handleWebSocketConnection } from './websocket/handler.js';

const app = express();

for (const mw of securityMiddleware()) app.use(mw);
app.use(apiRateLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/sessions', sessionsRouter);
app.use('/api/practice', practiceRouter);
app.use('/api/parse-cv', parseCvRouter);

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
wss.on('connection', (ws, req) => { void handleWebSocketConnection(ws, req); });

if (env.NODE_ENV !== 'test') {
  httpServer.listen(env.PORT, () => {
    logger.info(`🚀 Server on :${env.PORT}`);
    logger.info(`   Transcription: ${env.TRANSCRIPTION_PROVIDER}`);
    logger.info(`   Translation:   ${env.TRANSLATION_PROVIDER}`);
    logger.info(`   Claude:        ${env.ANTHROPIC_API_KEY ? '✓' : '✗ not configured'}`);
  });
}

export { app, httpServer };
