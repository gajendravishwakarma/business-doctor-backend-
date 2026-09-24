import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { app } from '../../server';
import http from 'node:http';
import { whatsAppVault } from '../../server/vault/whatsapp-vault';
import { resetConnectorRouterTestState } from '../../server/routes/whatsapp-connector';

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
  const headers = options.headers || {};
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

describe('Meta WhatsApp Embedded Signup Flow & State Machine Tests', () => {
  let server: http.Server;
  const TENANT_A = 'biz_tenant_ayurveda_001';
  const TENANT_B = 'biz_tenant_ayurveda_002';

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
    await whatsAppVault.deleteCredential(TENANT_A);
    await whatsAppVault.deleteCredential(TENANT_B);
    resetConnectorRouterTestState();
  });

  describe('1. Configuration & Security Boundary', () => {
    it('returns Meta SDK configuration with sessionInfoVersion 3 and NO raw secrets', async () => {
      const res = await makeRequest(server, '/api/connectors/whatsapp/config');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.config).toBeDefined();

      const { config } = res.body;
      expect(config.sessionInfoVersion).toBe(3);
      expect(Array.isArray(config.scopes)).toBe(true);
      expect(config.scopes).toContain('whatsapp_business_management');
      expect(config.scopes).toContain('whatsapp_business_messaging');

      // Zero customer secrets exposed to frontend
      expect(config.appSecret).toBeUndefined();
      expect(config.clientSecret).toBeUndefined();
      expect(config.systemUserToken).toBeUndefined();
    });

    it('reports initial NOT_CONNECTED state when no vault credentials exist', async () => {
      const res = await makeRequest(server, '/api/connectors/whatsapp/state', {
        headers: { 'x-business-id': TENANT_A },
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.state.status).toBe('NOT_CONNECTED');
      expect(res.body.state.activeConnection).toBeUndefined();
    });
  });

  describe('2. Embedded Signup Lifecycle (Session -> Exchange -> Select Asset)', () => {
    it('starts session and transitions state to AUTHORIZING', async () => {
      // Start session
      const startRes = await makeRequest(server, '/api/connectors/whatsapp/embedded-signup/start', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
      });
      expect(startRes.status).toBe(200);
      expect(startRes.body.success).toBe(true);
      expect(startRes.body.sessionToken).toBeDefined();
      expect(startRes.body.appId).toBeDefined();

      // Check state
      const stateRes = await makeRequest(server, '/api/connectors/whatsapp/state', {
        headers: { 'x-business-id': TENANT_A },
      });
      expect(stateRes.status).toBe(200);
      expect(stateRes.body.state.status).toBe('AUTHORIZING');
    });

    it('exchanges Meta authCode and returns eligible assets without leaking access tokens', async () => {
      // 1. Start session
      const startRes = await makeRequest(server, '/api/connectors/whatsapp/embedded-signup/start', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
      });
      const sessionToken = startRes.body.sessionToken;

      // 2. Simulate Meta popup callback with authCode and sessionInfo
      const exchangeRes = await makeRequest(server, '/api/connectors/whatsapp/embedded-signup/exchange', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
        body: {
          sessionToken,
          authCode: 'AQD_META_OAUTH_CODE_XYZ123',
          wabaId: 'waba_meta_98765',
          phoneNumberId: 'phone_meta_45678',
        },
      });

      expect(exchangeRes.status).toBe(200);
      expect(exchangeRes.body.success).toBe(true);
      expect(exchangeRes.body.eligibleAssets).toBeDefined();
      expect(exchangeRes.body.eligibleAssets.length).toBeGreaterThan(0);

      // Verify no raw token is sent back in eligible assets
      for (const asset of exchangeRes.body.eligibleAssets) {
        expect(asset.accessToken).toBeUndefined();
        expect(asset.phoneNumberId).toBeDefined();
        expect(asset.wabaId).toBeDefined();
        expect(asset.displayPhoneNumber).toBeDefined();
      }

      // Check state machine is now in ASSET_SELECTION
      const stateRes = await makeRequest(server, '/api/connectors/whatsapp/state', {
        headers: { 'x-business-id': TENANT_A },
      });
      expect(stateRes.status).toBe(200);
      expect(stateRes.body.state.status).toBe('ASSET_SELECTION');
      expect(stateRes.body.state.eligibleAssets.length).toBeGreaterThan(0);
    });

    it('selects asset, saves credentials in vault, and reaches CONNECTED / HEALTHY state', async () => {
      // 1. Start session
      const startRes = await makeRequest(server, '/api/connectors/whatsapp/embedded-signup/start', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
      });
      const sessionToken = startRes.body.sessionToken;

      // 2. Exchange code
      const exchangeRes = await makeRequest(server, '/api/connectors/whatsapp/embedded-signup/exchange', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
        body: {
          sessionToken,
          authCode: 'AQD_META_OAUTH_CODE_AYURVEDA',
          wabaId: 'waba_ayurveda_001',
          phoneNumberId: 'phone_ayurveda_001',
        },
      });
      const chosenAsset = exchangeRes.body.eligibleAssets[0];

      // 3. Select asset
      const selectRes = await makeRequest(server, '/api/connectors/whatsapp/embedded-signup/select-asset', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
        body: {
          sessionToken,
          wabaId: chosenAsset.wabaId,
          phoneNumberId: chosenAsset.phoneNumberId,
        },
      });

      expect(selectRes.status).toBe(200);
      expect(selectRes.body.success).toBe(true);
      expect(selectRes.body.activeConnection).toBeDefined();
      expect(selectRes.body.activeConnection.businessId).toBe(TENANT_A);
      expect(selectRes.body.activeConnection.maskedPhoneNumber).toBeDefined();

      // Check vault has stored credentials securely
      const cred = await whatsAppVault.getCredential(TENANT_A);
      expect(cred).not.toBeNull();
      expect(cred?.phoneNumberId).toBe(chosenAsset.phoneNumberId);
      expect(cred?.wabaId).toBe(chosenAsset.wabaId);
      expect(cred?.accessToken).toBeDefined();

      // Check state machine is now CONNECTED / HEALTHY
      const stateRes = await makeRequest(server, '/api/connectors/whatsapp/state', {
        headers: { 'x-business-id': TENANT_A },
      });
      expect(stateRes.status).toBe(200);
      expect(stateRes.body.state.status).toBe('CONNECTED');
      expect(stateRes.body.state.activeConnection?.phoneNumberId).toBe(chosenAsset.phoneNumberId);
    });
  });

  describe('3. Multi-Tenant Isolation & Error Boundaries', () => {
    it('prevents Tenant B from selecting assets or hijacking Tenant A session', async () => {
      // Tenant A starts session
      const startResA = await makeRequest(server, '/api/connectors/whatsapp/embedded-signup/start', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
      });
      const sessionTokenA = startResA.body.sessionToken;

      await makeRequest(server, '/api/connectors/whatsapp/embedded-signup/exchange', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
        body: {
          sessionToken: sessionTokenA,
          authCode: 'AQD_CODE_TENANT_A',
        },
      });

      // Tenant B attempts to select asset using Tenant A session
      const attackRes = await makeRequest(server, '/api/connectors/whatsapp/embedded-signup/select-asset', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_B },
        body: {
          sessionToken: sessionTokenA,
          wabaId: 'waba_hijack',
          phoneNumberId: 'phone_hijack',
        },
      });

      expect(attackRes.status).toBe(404);
      expect(attackRes.body.success).toBe(false);

      // Verify Tenant B has NO credentials in vault
      const credB = await whatsAppVault.getCredential(TENANT_B);
      expect(credB).toBeNull();
    });

    it('rejects exchange with missing sessionToken or missing authCode', async () => {
      const res1 = await makeRequest(server, '/api/connectors/whatsapp/embedded-signup/exchange', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
        body: { authCode: 'AQD_ONLY' },
      });
      expect(res1.status).toBe(400);

      const res2 = await makeRequest(server, '/api/connectors/whatsapp/embedded-signup/exchange', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
        body: { sessionToken: 'invalid_token' },
      });
      expect(res2.status).toBe(400);
    });
  });
});
