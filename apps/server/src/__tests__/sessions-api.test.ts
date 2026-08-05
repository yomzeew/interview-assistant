import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

// Must set test env before importing index (prevents auto-listen)
process.env['NODE_ENV'] = 'test';

const { app } = await import('../index.js');

describe('Sessions API', () => {
  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('POST /api/sessions creates a session', async () => {
    const res = await request(app).post('/api/sessions').send({});
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('sessionId');
    expect(res.body).toHaveProperty('websocketToken');
    expect(res.body).toHaveProperty('websocketUrl');
  });

  it('DELETE /api/sessions/:id removes the session', async () => {
    const create = await request(app).post('/api/sessions').send({});
    const { sessionId } = create.body as { sessionId: string };
    const del = await request(app).delete(`/api/sessions/${sessionId}`);
    expect(del.status).toBe(204);
  });

  it('DELETE unknown session returns 404', async () => {
    const res = await request(app).delete('/api/sessions/nonexistent-id');
    expect(res.status).toBe(404);
  });
});
