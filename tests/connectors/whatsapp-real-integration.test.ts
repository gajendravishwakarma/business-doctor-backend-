import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { app } from '../../server';
import { memoryMembershipRegistry } from '../../server/auth';
import http from 'node:http';
import { whatsAppVault } from '../../server/vault/whatsapp-vault';
import { WhatsAppBusinessAdapter } from '../../src/lib/connectors/adapters/whatsapp-adapter';

async function makeRequest(
  server: http.Server,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any; rawBody: string }> {
  const addr = server.address() as { port: number };
  const port = addr.port;
  const method = options.method || 'GET';
  const headers = { ...(options.headers || {}) };
  const businessId = headers['x-business-id'];
  const testUserId = 'whatsapp_test_owner';
  if (businessId) {
    memoryMembershipRegistry.set(`${businessId}:${testUserId}`, {
      role: 'owner',
      userEmail: 'whatsapp-test@example.com',
    });
  }
  headers.Authorization = headers.Authorization ||
    `Bearer test_jwt:${testUserId}:whatsapp-test@example.com:owner:${businessId || 'no_business'}:${Math.floor(Date.now() / 1000) + 3600}`;
  const payload = options.body ? JSON.stringify(options.body) : undefined;

  if (payload && !headers['Content-Type']) {
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
          let parsed: any;
          try {
            parsed = rawData ? JSON.parse(rawData) : {};
          } catch {
            parsed = rawData;
          }
          resolve({
            status: res.statusCode || 500,
            headers: res.headers,
            body: parsed,
            rawBody: rawData,
          });
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

describe('Real WhatsApp Cloud API Backend & Vault Tests', () => {
  let server: http.Server;
  const TENANT_1 = 'biz_real_ayurveda_101';
  const TENANT_2 = 'biz_real_ayurveda_102';

  beforeAll(async () => {
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(async () => {
    await whatsAppVault.deleteCredential(TENANT_1);
    await whatsAppVault.deleteCredential(TENANT_2);
  });

  describe('1. WhatsApp Secure Credential Vault Isolation', () => {
    it('stores and retrieves access tokens securely per business tenant', async () => {
      await whatsAppVault.storeCredential({
        businessId: TENANT_1,
        phoneNumberId: 'phone_1010101',
        accessToken: 'EAAG_SECRET_TOKEN_TENANT_1',
        wabaId: 'waba_101',
        isTestMode: false,
      });

      const hasCred1 = await whatsAppVault.hasCredential(TENANT_1);
      const hasCred2 = await whatsAppVault.hasCredential(TENANT_2);

      expect(hasCred1).toBe(true);
      expect(hasCred2).toBe(false);

      const cred1 = await whatsAppVault.getCredential(TENANT_1);
      expect(cred1?.accessToken).toBe('EAAG_SECRET_TOKEN_TENANT_1');
      expect(cred1?.phoneNumberId).toBe('phone_1010101');
    });

    it('deletes credentials cleanly on disconnect', async () => {
      await whatsAppVault.storeCredential({
        businessId: TENANT_1,
        phoneNumberId: 'phone_1010101',
        accessToken: 'EAAG_SECRET_TOKEN_TENANT_1',
      });

      expect(await whatsAppVault.hasCredential(TENANT_1)).toBe(true);
      await whatsAppVault.deleteCredential(TENANT_1);
      expect(await whatsAppVault.hasCredential(TENANT_1)).toBe(false);
    });
  });

  describe('2. WhatsApp Connector Authorization Endpoint (/api/connectors/whatsapp/authorize)', () => {
    it('rejects requests without x-business-id header with 400', async () => {
      const res = await makeRequest(server, '/api/connectors/whatsapp/authorize', {
        method: 'POST',
        body: {
          phoneNumberId: '10928374',
          accessToken: 'EAAG_TEST',
        },
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_BUSINESS_ID');
    });

    it('rejects requests missing phoneNumberId or accessToken with 400', async () => {
      const res = await makeRequest(server, '/api/connectors/whatsapp/authorize', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_1 },
        body: {
          wabaId: 'waba_test',
        },
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('missing_required_credentials');
    });

    it('rejects synthetic sandbox credentials and requires official Meta Embedded Signup', async () => {
      const res = await makeRequest(server, '/api/connectors/whatsapp/authorize', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_1 },
        body: {
          phoneNumberId: '100609349424084',
          accessToken: 'EAAG_SANDBOX_TOKEN',
          wabaId: '104593821039482',
          isTestMode: true,
        },
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('sandbox_connection_disabled');
      expect(await whatsAppVault.hasCredential(TENANT_1)).toBe(false);
    });
  });

  describe('3. WhatsApp Health Diagnostics Endpoint (/api/connectors/whatsapp/health)', () => {
    it('returns degraded status when credentials are not configured', async () => {
      const res = await makeRequest(server, '/api/connectors/whatsapp/health', {
        method: 'GET',
        headers: { 'x-business-id': TENANT_2 },
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('degraded');
      expect(res.body.connectorStatus).toBe('NOT_CONNECTED');
    });

    it('returns healthy status when credentials exist in vault', async () => {
      await whatsAppVault.storeCredential({
        businessId: TENANT_1,
        phoneNumberId: 'phone_healthy_101',
        accessToken: 'EAAG_TOKEN',
        isTestMode: true,
      });

      const res = await makeRequest(server, '/api/connectors/whatsapp/health', {
        method: 'GET',
        headers: { 'x-business-id': TENANT_1 },
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.connectorStatus).toBe('CONNECTED');
      expect(res.body.details.phoneNumberId).toBe('phone_healthy_101');
    });
  });

  describe('4. Human-In-The-Loop WhatsApp Message Dispatch (/api/connectors/whatsapp/send-message)', () => {
    beforeEach(async () => {
      await whatsAppVault.storeCredential({
        businessId: TENANT_1,
        phoneNumberId: '100609349424084',
        accessToken: 'EAAG_TEST_TOKEN',
        isTestMode: true,
      });
    });

    it('BLOCKS message dispatch if human approval is not verified (403)', async () => {
      const res = await makeRequest(server, '/api/connectors/whatsapp/send-message', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_1 },
        body: {
          to: '+919876543210',
          message: 'Unapproved AI message to customer',
          isHumanApproved: false,
        },
      });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('human_approval_required');
    });

    it('REJECTS message dispatch if recipient or message is missing (400)', async () => {
      const res = await makeRequest(server, '/api/connectors/whatsapp/send-message', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_1 },
        body: {
          to: '',
          message: 'Hello',
          isHumanApproved: true,
        },
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('recipient_and_message_required');
    });

    it('DISPATCHES message successfully in Sandbox mode when human approved', async () => {
      const res = await makeRequest(server, '/api/connectors/whatsapp/send-message', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_1 },
        body: {
          to: '+919876543210',
          message: 'Hello from Business Doctor AI! Your order #ORD-101 has been confirmed.',
          isHumanApproved: true,
          actionId: 'act_followup_001',
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isSandbox).toBe(true);
      expect(res.body.messageId).toContain('wamid.');
      expect(res.body.recipient).toBe('+919876543210');
    });

    it('PREVENTS Tenant 2 from sending messages using Tenant 1 credentials', async () => {
      const res = await makeRequest(server, '/api/connectors/whatsapp/send-message', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_2 },
        body: {
          to: '+919876543210',
          message: 'Tenant 2 attempting dispatch',
          isHumanApproved: true,
        },
      });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('whatsapp_not_configured');
    });
  });

  describe('5. WhatsApp Disconnect Endpoint (/api/connectors/whatsapp/disconnect)', () => {
    it('deletes vault credentials and unregisters tenant on disconnect', async () => {
      await whatsAppVault.storeCredential({
        businessId: TENANT_1,
        phoneNumberId: 'phone_to_disconnect',
        accessToken: 'EAAG_TOKEN',
        isTestMode: true,
      });

      expect(await whatsAppVault.hasCredential(TENANT_1)).toBe(true);

      const res = await makeRequest(server, '/api/connectors/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_1 },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(await whatsAppVault.hasCredential(TENANT_1)).toBe(false);
    });
  });

  describe('6. Client-Side WhatsApp Adapter Contract', () => {
    it('rejects connection if businessId is missing', async () => {
      const adapter = new WhatsAppBusinessAdapter();
      const res = await adapter.connect({
        businessId: '',
        provider: 'whatsapp_business',
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('tenant_access_denied');
    });

    it('connects in test sandbox mode when isTestMode is true', async () => {
      const adapter = new WhatsAppBusinessAdapter();
      const res = await adapter.connect({
        businessId: TENANT_1,
        provider: 'whatsapp_business',
        isTestMode: true,
        phoneNumberId: '100609349424084',
      });

      expect(res.success).toBe(true);
      expect(res.integration?.status).toBe('CONNECTED');
      expect(res.integration?.is_test_mode).toBe(true);
    });
  });
});
