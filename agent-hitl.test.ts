import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../../server';
import http from 'node:http';

async function makeRequest(
  server: http.Server,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
): Promise<{ status: number; body: any }> {
  const addr = server.address() as { port: number };
  const port = addr.port;
  const method = options.method || 'GET';
  const headers = options.headers || {};
  const payload = options.body ? JSON.stringify(options.body) : undefined;

  if (payload) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(payload).toString();
  }

  return new Promise((resolve, reject) => {
    const req = http.request(
      `http://127.0.0.1:${port}${path}`,
      {
        method,
        headers,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = rawData ? JSON.parse(rawData) : {};
            resolve({ status: res.statusCode || 500, body: parsed });
          } catch {
            resolve({ status: res.statusCode || 500, body: rawData });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

describe('SECURITY AUDIT: Agent Execution Loop & Human-In-The-Loop Safety Gate', () => {
  let server: http.Server;

  beforeAll(async () => {
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  const futureSec = Math.floor(Date.now() / 1000) + 3600;
  const ownerToken = `test_jwt:usr_founder:gajendravishwakarma738@gmail.com:owner:biz_ayurvedic_01:${futureSec}`;
  const staffToken = `test_jwt:usr_staff_01:staff@ayurvedicremedies.in:staff:biz_ayurvedic_01:${futureSec}`;

  it('HUMAN-IN-THE-LOOP SAFETY: Blocks execution of unapproved action (403 UNAPPROVED_ACTION_EXECUTION_BLOCKED)', async () => {
    const res = await makeRequest(server, '/api/actions/execute', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'x-business-id': 'biz_ayurvedic_01',
      },
      body: {
        actionId: 'act_reorder_9988',
        status: 'proposed',
        actionType: 'Emergency Stock Reorder',
      },
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('UNAPPROVED_ACTION_EXECUTION_BLOCKED');
  });

  it('HUMAN-IN-THE-LOOP SAFETY: Allows owner/manager to approve proposed action', async () => {
    const res = await makeRequest(server, '/api/actions/approve', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'x-business-id': 'biz_ayurvedic_01',
      },
      body: {
        actionId: 'act_reorder_9988',
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
    expect(res.body.approvedBy).toBe('usr_founder');
    expect(res.body.auditLog).toBeDefined();
    expect(res.body.auditLog.event).toBe('AGENT_ACTION_APPROVED');
  });

  it('HUMAN-IN-THE-LOOP SAFETY: Executes approved action with audit logging', async () => {
    const res = await makeRequest(server, '/api/actions/execute', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'x-business-id': 'biz_ayurvedic_01',
      },
      body: {
        actionId: 'act_reorder_9988',
        status: 'approved',
        actionType: 'Emergency Stock Reorder',
        payload: { channel: 'Supplier PO' },
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('executed');
    expect(res.body.executedBy).toBe('usr_founder');
    expect(res.body.auditLog.event).toBe('AGENT_ACTION_EXECUTED');
  });

  it('RBAC ON ACTIONS: Prevents STAFF from approving agent actions (403 Forbidden)', async () => {
    const res = await makeRequest(server, '/api/actions/approve', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'x-business-id': 'biz_ayurvedic_01',
      },
      body: {
        actionId: 'act_reorder_9988',
      },
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_ROLE_PERMISSIONS');
  });
});
