import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import Anthropic from '@anthropic-ai/sdk';
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

/**
 * POST /api/health/claude
 * Tests an Anthropic API key with a 1-token request.
 * Body: { anthropicApiKey?: string }
 * Returns: { ok, status: 'ok'|'no_credits'|'invalid_key'|'no_key'|'error', error? }
 */
app.post('/api/health/claude', express.json(), async (req, res) => {
  const body = req.body as { anthropicApiKey?: string };
  const key = body.anthropicApiKey || env.ANTHROPIC_API_KEY;

  if (!key) {
    res.json({ ok: false, status: 'no_key', error: 'No Anthropic API key provided and none configured on server.' });
    return;
  }

  try {
    const client = new Anthropic({ apiKey: key });
    await client.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'Hi' }],
    });
    res.json({ ok: true, status: 'ok' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('401') || msg.includes('invalid_api_key') || msg.includes('authentication')) {
      res.json({ ok: false, status: 'invalid_key', error: 'Invalid API key — double-check it at console.anthropic.com.' });
    } else if (msg.includes('credit') || msg.includes('quota') || msg.includes('billing') || msg.includes('402')) {
      res.json({ ok: false, status: 'no_credits', error: 'API key is valid but credits are exhausted. Top up at console.anthropic.com/settings/billing.' });
    } else if (msg.includes('permission') || msg.includes('403')) {
      res.json({ ok: false, status: 'error', error: 'API key lacks permission for this model.' });
    } else {
      res.json({ ok: false, status: 'error', error: `Anthropic error: ${msg.slice(0, 150)}` });
    }
    logger.warn({ err }, 'Claude health check failed');
  }
});

/**
 * POST /api/health/groq
 * Tests the server's Groq API key with a 1-token request.
 * Returns: { ok, status: 'ok'|'no_credits'|'invalid_key'|'no_key'|'error', error? }
 */
app.post('/api/health/groq', express.json(), async (_req, res) => {
  const key = env.GROQ_API_KEY || env.TRANSCRIPTION_API_KEY;

  if (!key) {
    res.json({ ok: false, status: 'no_key', error: 'No Groq API key configured on server (GROQ_API_KEY).' });
    return;
  }

  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b', // lightweight model for health ping
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });
    if (resp.ok) {
      res.json({ ok: true, status: 'ok' });
      return;
    }
    const body = await resp.text();
    if (resp.status === 401) {
      res.json({ ok: false, status: 'invalid_key', error: 'Invalid Groq API key — check console.groq.com.' });
    } else if (resp.status === 429 || body.includes('rate_limit') || body.includes('quota')) {
      res.json({ ok: false, status: 'no_credits', error: 'Groq rate limit or quota exceeded. Check console.groq.com/settings.' });
    } else {
      res.json({ ok: false, status: 'error', error: `Groq error ${resp.status}: ${body.slice(0, 150)}` });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.json({ ok: false, status: 'error', error: `Network error: ${msg.slice(0, 120)}` });
    logger.warn({ err }, 'Groq health check failed');
  }
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
    logger.info(`   AI provider:   ${env.AI_PROVIDER} (Claude ${env.ANTHROPIC_API_KEY ? '✓' : '✗'} / Groq ${env.GROQ_API_KEY || env.TRANSCRIPTION_API_KEY ? '✓' : '✗'})`);
    if (env.AI_PROVIDER === 'claude' && !env.ANTHROPIC_API_KEY) {
      logger.warn('   ⚠️  AI_PROVIDER=claude but ANTHROPIC_API_KEY is not set — answers will use Groq fallback');
    }
  });
}

export { app, httpServer };
