import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../../server';
import http from 'node:http';

async function makeRequest(
  server: http.Server,
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: any } = {}
): Promise<{ status: number; body: any }> {
  const addr = server.address() as { port: number };
  const headers = { ...(options.headers || {}) };
  const payload = options.body ? JSON.stringify(options.body) : undefined;
  if (payload) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(payload).toString();
  }
  return new Promise((resolve, reject) => {
    const req = http.request(`http://127.0.0.1:${addr.port}${path}`, {
      method: options.method || 'GET',
      headers,
    }, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode || 500, body: rawData ? JSON.parse(rawData) : {} }); }
        catch { resolve({ status: res.statusCode || 500, body: rawData }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('SECURITY AUDIT: Agent Execution Loop & Human-In-The-Loop Safety Gate', () => {
  let server: http.Server;
  beforeAll(async () => {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });
  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const futureSec = Math.floor(Date.now() / 1000) + 3600;
  const ownerToken = `test_jwt:usr_founder:gajendravishwakarma738@gmail.com:owner:biz_ayurvedic_01:${futureSec}`;
  const staffToken = `test_jwt:usr_staff_01:staff@ayurvedicremedies.in:staff:biz_ayurvedic_01:${futureSec}`;
  const ownerHeaders = { Authorization: `Bearer ${ownerToken}`, 'x-business-id': 'biz_ayurvedic_01' };

  it('fails closed when action storage is unavailable; client status cannot authorize execution', async () => {
    const res = await makeRequest(server, '/api/actions/execute', {
      method: 'POST', headers: ownerHeaders,
      body: { actionId: 'act_reorder_9988', status: 'approved', actionType: 'Emergency Stock Reorder', payload: { channel: 'Supplier PO' } },
    });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('ACTION_STORAGE_UNAVAILABLE');
    expect(res.body.status).not.toBe('executed');
  });

  it('does not report approval unless it is persisted in tenant-scoped storage', async () => {
    const res = await makeRequest(server, '/api/actions/approve', {
      method: 'POST', headers: ownerHeaders, body: { actionId: 'act_reorder_9988' },
    });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('ACTION_STORAGE_UNAVAILABLE');
    expect(res.body.success).not.toBe(true);
  });

  it('does not report rejection unless it is persisted in tenant-scoped storage', async () => {
    const res = await makeRequest(server, '/api/actions/reject', {
      method: 'POST', headers: ownerHeaders, body: { actionId: 'act_reorder_9988', reason: 'Not approved' },
    });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('ACTION_STORAGE_UNAVAILABLE');
    expect(res.body.success).not.toBe(true);
  });

  it('RBAC prevents STAFF from approving agent actions', async () => {
    const res = await makeRequest(server, '/api/actions/approve', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}`, 'x-business-id': 'biz_ayurvedic_01' },
      body: { actionId: 'act_reorder_9988' },
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_ROLE_PERMISSIONS');
  });
});
