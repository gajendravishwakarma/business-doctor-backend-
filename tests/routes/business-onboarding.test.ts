import express from 'express';
import http from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../../server/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/auth')>();
  return {
    ...actual,
    getServerSupabaseClient: () => ({ rpc: mocks.rpc }),
  };
});

import { businessOnboardingRouter } from '../../server/routes/business-onboarding';

const BUSINESS_ID = 'a1111111-1111-4111-8111-111111111111';
const TEST_USER_ID = 'b2222222-2222-4222-8222-222222222222';

async function makeRequest(
  server: http.Server,
  options: { token?: string; body?: Record<string, unknown> } = {},
): Promise<{ status: number; body: any }> {
  const address = server.address() as { port: number };
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (payload) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = String(Buffer.byteLength(payload));
  }

  return new Promise((resolve, reject) => {
    const req = http.request(
      `http://127.0.0.1:${address.port}/api/business/onboard`,
      { method: 'POST', headers },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 500, body: raw ? JSON.parse(raw) : {} });
          } catch {
            resolve({ status: res.statusCode || 500, body: raw });
          }
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('Business onboarding API integration', () => {
  let server: http.Server;
  const validToken = () =>
    `test_jwt:${TEST_USER_ID}:owner@example.com:owner:no_business:${Math.floor(Date.now() / 1000) + 3600}`;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/business', businessOnboardingRouter);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({
      data: { business_id: BUSINESS_ID, name: 'Test Studio', role: 'owner', status: 'created' },
      error: null,
    });
  });

  it('rejects unauthenticated onboarding before calling the database', async () => {
    const response = await makeRequest(server, { body: { name: 'Test Studio' } });
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHENTICATED');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('creates the business atomically for the verified owner and maps all onboarding fields', async () => {
    const response = await makeRequest(server, {
      token: validToken(),
      body: {
        name: 'Test Studio',
        businessType: 'retail',
        dataMaturity: 'existing_partial',
        businessStage: 'growing',
        industry: 'Fashion',
        location: 'Indore',
        country: 'India',
        currency: 'INR',
        currencySymbol: '₹',
        timezone: 'Asia/Kolkata',
        targetCustomers: 'Young adults',
        websiteUrl: 'https://example.com',
        phone: '+919876543210',
        email: 'owner@example.com',
      },
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      business: { id: BUSINESS_ID, name: 'Test Studio', role: 'owner', status: 'created' },
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('create_business_with_owner', {
      p_business_id: expect.any(String),
      p_user_id: TEST_USER_ID,
      p_name: 'Test Studio',
      p_business_type: 'retail',
      p_website_url: 'https://example.com',
      p_phone: '+919876543210',
      p_email: 'owner@example.com',
      p_business_age_stage: 'growing',
      p_data_maturity_mode: 'existing_partial',
      p_industry: 'Fashion',
      p_location: 'Indore',
      p_country: 'India',
      p_currency: 'INR',
      p_currency_symbol: '₹',
      p_timezone: 'Asia/Kolkata',
      p_description: 'Young adults',
    });
  });

  it('rejects invalid business names without touching the database', async () => {
    const response = await makeRequest(server, {
      token: validToken(),
      body: { name: 'x' },
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_BUSINESS_NAME');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('does not leak database details when atomic business creation fails', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'private database detail' },
    });
    const response = await makeRequest(server, {
      token: validToken(),
      body: { name: 'Test Studio' },
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('BUSINESS_CREATE_FAILED');
    expect(response.body.message).not.toContain('private database detail');
  });
});
