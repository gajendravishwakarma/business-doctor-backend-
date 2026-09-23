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

describe('SECURITY AUDIT: Server-Side Authentication & RBAC Middleware', () => {
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

  const nowSec = Math.floor(Date.now() / 1000);
  const futureSec = nowSec + 3600;

  // Tokens for Tenant A (biz_ayurvedic_01)
  const tokenOwnerTenantA = `test_jwt:usr_founder:gajendravishwakarma738@gmail.com:owner:biz_ayurvedic_01:${futureSec}`;
  const tokenManagerTenantA = `test_jwt:usr_manager_01:manager@ayurvedicremedies.in:manager:biz_ayurvedic_01:${futureSec}`;
  const tokenMarketingTenantA = `test_jwt:usr_marketing_01:marketing@ayurvedicremedies.in:marketing:biz_ayurvedic_01:${futureSec}`;
  const tokenStaffTenantA = `test_jwt:usr_staff_01:staff@ayurvedicremedies.in:staff:biz_ayurvedic_01:${futureSec}`;

  // Token for Tenant B (biz_tenant_b_99)
  const tokenOwnerTenantB = `test_jwt:usr_tenant_b_owner:owner@tenantb.com:owner:biz_tenant_b_99:${futureSec}`;

  // Offline / Demo Token
  const demoToken = 'demo_token_offline_preview_mock';

  // Expired Token
  const expiredToken = `test_jwt:usr_founder:gajendravishwakarma738@gmail.com:owner:biz_ayurvedic_01:${nowSec - 100}`;

  it('BLOCKS unauthenticated requests with 401 UNAUTHENTICATED', async () => {
    const res = await makeRequest(server, '/api/ai/diagnose', {
      method: 'POST',
      body: { business: { id: 'biz_ayurvedic_01' } },
    });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('BLOCKS expired session tokens with 401 INVALID_TOKEN', async () => {
    const res = await makeRequest(server, '/api/ai/diagnose', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${expiredToken}`,
        'x-business-id': 'biz_ayurvedic_01',
      },
      body: { business: { id: 'biz_ayurvedic_01' } },
    });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('BLOCKS offline/demo tokens from hitting production endpoints with 403 DEMO_MODE_RESTRICTED', async () => {
    const res = await makeRequest(server, '/api/ai/diagnose', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${demoToken}`,
        'x-business-id': 'biz_ayurvedic_01',
      },
      body: { business: { id: 'biz_ayurvedic_01' } },
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('DEMO_MODE_RESTRICTED');
  });

  it('REJECTS requests missing target business_id with 400 MISSING_BUSINESS_ID', async () => {
    const res = await makeRequest(server, '/api/ai/diagnose', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOwnerTenantA}`,
      },
      body: {},
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_BUSINESS_ID');
  });

  it('STRICT TENANT ISOLATION: Blocks Tenant B user from accessing Tenant A business (403 Forbidden)', async () => {
    // User B attempts to query Business A
    const res = await makeRequest(server, '/api/ai/diagnose', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOwnerTenantB}`,
        'x-business-id': 'biz_ayurvedic_01',
      },
      body: { business: { id: 'biz_ayurvedic_01' } },
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CROSS_TENANT_ACCESS_DENIED');
  });

  it('RBAC ENFORCEMENT: Blocks STAFF from running AI diagnoses (403 INSUFFICIENT_ROLE_PERMISSIONS)', async () => {
    const res = await makeRequest(server, '/api/ai/diagnose', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenStaffTenantA}`,
        'x-business-id': 'biz_ayurvedic_01',
      },
      body: { business: { id: 'biz_ayurvedic_01' } },
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_ROLE_PERMISSIONS');
  });

  it('RBAC ENFORCEMENT: Blocks STAFF from triggering autonomous agent execution loop (403 Forbidden)', async () => {
    const res = await makeRequest(server, '/api/ai/agent-execution-loop', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenStaffTenantA}`,
        'x-business-id': 'biz_ayurvedic_01',
      },
      body: { business: { id: 'biz_ayurvedic_01' } },
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_ROLE_PERMISSIONS');
  });

  it('RBAC ENFORCEMENT: Allows MARKETING role to generate marketing content', async () => {
    const res = await makeRequest(server, '/api/ai/marketing-content', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenMarketingTenantA}`,
        'x-business-id': 'biz_ayurvedic_01',
      },
      body: {
        business: { id: 'biz_ayurvedic_01', name: 'Ayurvedic Remedies' },
        campaignType: 'whatsapp',
      },
    });

    expect(res.status).toBe(200);
  });

  it('RBAC ENFORCEMENT: Blocks MARKETING role from accessing restricted AI diagnose (403 Forbidden)', async () => {
    const res = await makeRequest(server, '/api/ai/diagnose', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenMarketingTenantA}`,
        'x-business-id': 'biz_ayurvedic_01',
      },
      body: { business: { id: 'biz_ayurvedic_01' } },
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_ROLE_PERMISSIONS');
  });

  it('RBAC ENFORCEMENT: Blocks MANAGER from deleting business organization (403 Forbidden)', async () => {
    const res = await makeRequest(server, '/api/business/biz_ayurvedic_01', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenManagerTenantA}`,
        'x-business-id': 'biz_ayurvedic_01',
      },
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_ROLE_PERMISSIONS');
  });

  it('BLOCKS malformed authorization tokens with 401 INVALID_TOKEN', async () => {
    const res = await makeRequest(server, '/api/ai/diagnose', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer invalid_random_token_string',
        'x-business-id': 'biz_ayurvedic_01',
      },
      body: { business: { id: 'biz_ayurvedic_01' } },
    });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('PROTECTS 5-Day Trial Generator: Blocks unauthorized or cross-tenant access', async () => {
    const resUnauth = await makeRequest(server, '/api/ai/5-day-trial', {
      method: 'POST',
      body: { business: { id: 'biz_ayurvedic_01' }, dayNumber: 1 },
    });
    expect(resUnauth.status).toBe(401);

    const resCross = await makeRequest(server, '/api/ai/5-day-trial', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenOwnerTenantB}`,
        'x-business-id': 'biz_ayurvedic_01',
      },
      body: { business: { id: 'biz_ayurvedic_01' }, dayNumber: 1 },
    });
    expect(resCross.status).toBe(403);
    expect(resCross.body.code).toBe('CROSS_TENANT_ACCESS_DENIED');
  });

  it('PROTECTS Ask Doctor AI Advisor: Blocks unauthenticated callers', async () => {
    const res = await makeRequest(server, '/api/ai/ask-doctor', {
      method: 'POST',
      body: { question: 'How do I improve repeat customer rate?' },
    });
    expect(res.status).toBe(401);
  });

  it('RBAC ENFORCEMENT: Allows OWNER full administrative operations (200 OK)', async () => {
    const res = await makeRequest(server, '/api/business/biz_ayurvedic_01', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenOwnerTenantA}`,
        'x-business-id': 'biz_ayurvedic_01',
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

