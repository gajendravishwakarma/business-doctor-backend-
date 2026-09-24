import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { app } from '../../server';
import http from 'node:http';
import crypto from 'node:crypto';
import {
  resetWebhookTestState,
  inMemoryWebhookEvents,
  inMemoryInboundActions,
  inMemoryInboundMemories,
  inMemoryInboundLeads,
} from '../../server/webhooks/whatsapp';

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

describe('Phase 6 Step 2: Real Meta WhatsApp Cloud API Webhook Backend Tests', () => {
  let server: http.Server;
  const TEST_VERIFY_TOKEN = 'secret_webhook_verify_token_prod_99';
  const TENANT_A_BIZ = 'biz_01_health_bengaluru';
  const TENANT_A_PHONE_ID = '109283746501928';
  const TENANT_A_WABA_ID = 'waba_veda_bengaluru_01';

  const TENANT_B_BIZ = 'biz_tenant_b_99';
  const TENANT_B_PHONE_ID = '209283746501929';

  beforeAll(async () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = TEST_VERIFY_TOKEN;
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
  });

  afterAll(async () => {
    delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    delete process.env.WHATSAPP_APP_SECRET;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    resetWebhookTestState();
    delete process.env.WHATSAPP_APP_SECRET;
  });

  describe('1. GET /api/webhooks/whatsapp — Meta Webhook Verification', () => {
    it('returns 200 and echoes hub.challenge when hub.mode is subscribe and verify_token matches', async () => {
      const challenge = 'meta_test_challenge_code_98765';
      const res = await makeRequest(
        server,
        `/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${TEST_VERIFY_TOKEN}&hub.challenge=${challenge}`
      );

      expect(res.status).toBe(200);
      expect(res.rawBody).toBe(challenge);
      // Ensure token is not leaked
      expect(res.rawBody).not.toContain(TEST_VERIFY_TOKEN);
    });

    it('rejects with 403 when hub.verify_token does not match expected secret', async () => {
      const res = await makeRequest(
        server,
        `/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token_hacker&hub.challenge=test_code`
      );

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('VERIFICATION_FAILED');
      expect(JSON.stringify(res.body)).not.toContain(TEST_VERIFY_TOKEN);
    });

    it('rejects with 403 when hub.mode is not subscribe', async () => {
      const res = await makeRequest(
        server,
        `/api/webhooks/whatsapp?hub.mode=unsubscribe&hub.verify_token=${TEST_VERIFY_TOKEN}&hub.challenge=test_code`
      );

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('VERIFICATION_FAILED');
    });

    it('returns 400 if hub.challenge is missing on subscribe mode', async () => {
      const res = await makeRequest(
        server,
        `/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${TEST_VERIFY_TOKEN}`
      );

      expect(res.status).toBe(400);
      expect(res.rawBody).toContain('Missing hub.challenge');
    });
  });

  describe('2. POST /api/webhooks/whatsapp — Payload Validation & HMAC Security', () => {
    it('rejects malformed payload missing object or entry array with 400', async () => {
      const res = await makeRequest(server, '/api/webhooks/whatsapp', {
        method: 'POST',
        body: { foo: 'bar' },
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MALFORMED_PAYLOAD');
    });

    it('validates X-Hub-Signature-256 HMAC when WHATSAPP_APP_SECRET is configured', async () => {
      const appSecret = 'super_secret_meta_app_key_321';
      process.env.WHATSAPP_APP_SECRET = appSecret;

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: TENANT_A_WABA_ID,
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    phone_number_id: TENANT_A_PHONE_ID,
                    display_phone_number: '+91 98765 43210',
                  },
                  messages: [
                    {
                      from: '919876500001',
                      id: 'wamid.test_sig_01',
                      timestamp: '1720000000',
                      text: { body: 'Hello clinic timings?' },
                      type: 'text',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawJson = JSON.stringify(payload);
      const validHmac = crypto.createHmac('sha256', appSecret).update(rawJson).digest('hex');

      // 1. Send with valid HMAC header -> should succeed (200)
      const validRes = await makeRequest(server, '/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': `sha256=${validHmac}`,
          'Content-Type': 'application/json',
        },
        body: payload,
      });

      expect(validRes.status).toBe(200);
      expect(validRes.body.success).toBe(true);

      // 2. Send with invalid HMAC header -> should be rejected (401)
      const invalidRes = await makeRequest(server, '/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': 'sha256=invalid_tampered_signature_hex_value',
          'Content-Type': 'application/json',
        },
        body: payload,
      });

      expect(invalidRes.status).toBe(401);
      expect(invalidRes.body.code).toBe('INVALID_SIGNATURE');
    });
  });

  describe('3. Tenant Resolution & Tenant Isolation', () => {
    it('correctly maps phone_number_id to the internal business_id server-side', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: TENANT_A_WABA_ID,
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    phone_number_id: TENANT_A_PHONE_ID,
                    display_phone_number: '+91 98765 43210',
                  },
                  contacts: [{ profile: { name: 'Priya Sharma' }, wa_id: '919876500002' }],
                  messages: [
                    {
                      from: '919876500002',
                      id: 'wamid.tenant_res_01',
                      timestamp: '1720000100',
                      text: { body: 'What are your consultation fees?' },
                      type: 'text',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const res = await makeRequest(server, '/api/webhooks/whatsapp', {
        method: 'POST',
        body: payload,
      });

      expect(res.status).toBe(200);
      expect(res.body.results[0].businessId).toBe(TENANT_A_BIZ);

      // Verify stored event has correct business_id
      const storedEvent = inMemoryWebhookEvents.find((e) => e.external_message_id === 'wamid.tenant_res_01');
      expect(storedEvent).toBeDefined();
      expect(storedEvent?.business_id).toBe(TENANT_A_BIZ);
      expect(storedEvent?.customer_name).toBe('Priya Sharma');
      expect(storedEvent?.customer_phone).toBe('919876500002');
    });

    it('rejects unknown or unmapped phone_number_id with 404 to protect tenant boundaries', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba_unauthorized_999',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    phone_number_id: 'unknown_unregistered_phone_999',
                  },
                  messages: [
                    {
                      from: '919876599999',
                      id: 'wamid.unmapped_01',
                      text: { body: 'Inquiry to nowhere' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const res = await makeRequest(server, '/api/webhooks/whatsapp', {
        method: 'POST',
        body: payload,
      });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('UNKNOWN_WHATSAPP_TENANT');
    });

    it('never trusts client-supplied business_id inside the payload', async () => {
      // Attacker tries to inject client-side business_id="biz_spoofed_victim"
      // while using Tenant B's registered phone_number_id
      const payload = {
        object: 'whatsapp_business_account',
        business_id: 'biz_spoofed_victim',
        entry: [
          {
            id: 'waba_tenant_b_02',
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: {
                    phone_number_id: TENANT_B_PHONE_ID,
                  },
                  messages: [
                    {
                      from: '919876500003',
                      id: 'wamid.anti_spoof_01',
                      text: { body: 'Spoof attempt' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const res = await makeRequest(server, '/api/webhooks/whatsapp', {
        method: 'POST',
        body: payload,
      });

      expect(res.status).toBe(200);
      // Resolved server-side to Tenant B, NOT to spoofed victim
      expect(res.body.results[0].businessId).toBe(TENANT_B_BIZ);

      const storedEvent = inMemoryWebhookEvents.find((e) => e.external_message_id === 'wamid.anti_spoof_01');
      expect(storedEvent?.business_id).toBe(TENANT_B_BIZ);
    });
  });

  describe('4. Idempotency & Deduplication Ledger', () => {
    it('processes message on first delivery and marks duplicate on redelivery without re-triggering actions', async () => {
      const messageId = 'wamid.dedupe_test_999';
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: TENANT_A_WABA_ID,
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: {
                    phone_number_id: TENANT_A_PHONE_ID,
                  },
                  contacts: [{ profile: { name: 'Arjun Mehta' }, wa_id: '919876500004' }],
                  messages: [
                    {
                      from: '919876500004',
                      id: messageId,
                      text: { body: 'Appointment booking inquiry' },
                      type: 'text',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      // 1. First delivery
      const res1 = await makeRequest(server, '/api/webhooks/whatsapp', {
        method: 'POST',
        body: payload,
      });

      expect(res1.status).toBe(200);
      expect(res1.body.results[0].status).toBe('processed');

      const initialEventsCount = inMemoryWebhookEvents.length;
      const initialActionsCount = inMemoryInboundActions.length;
      const initialLeadsCount = inMemoryInboundLeads.length;
      const initialMemoriesCount = inMemoryInboundMemories.length;

      expect(initialEventsCount).toBe(1);
      expect(initialActionsCount).toBe(1);
      expect(initialLeadsCount).toBe(1);
      expect(initialMemoriesCount).toBe(1);

      // 2. Redelivery of identical message ID (e.g. Meta retry)
      const res2 = await makeRequest(server, '/api/webhooks/whatsapp', {
        method: 'POST',
        body: payload,
      });

      expect(res2.status).toBe(200);
      expect(res2.body.results[0].status).toBe('duplicate');
      expect(res2.body.results[0].ignored).toBe(true);

      // Counts MUST NOT increase!
      expect(inMemoryWebhookEvents.length).toBe(initialEventsCount);
      expect(inMemoryInboundActions.length).toBe(initialActionsCount);
      expect(inMemoryInboundLeads.length).toBe(initialLeadsCount);
      expect(inMemoryInboundMemories.length).toBe(initialMemoriesCount);
    });
  });

  describe('5. Agent Architecture & Consequential Action Safety', () => {
    it('creates grounded proposed action with status pending and human approval required', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: TENANT_A_WABA_ID,
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: {
                    phone_number_id: TENANT_A_PHONE_ID,
                  },
                  contacts: [{ profile: { name: 'Kavita Rao' }, wa_id: '919876500005' }],
                  messages: [
                    {
                      from: '919876500005',
                      id: 'wamid.agent_safety_01',
                      text: { body: 'Can I book a consultation today at Indiranagar?' },
                      type: 'text',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const res = await makeRequest(server, '/api/webhooks/whatsapp', {
        method: 'POST',
        body: payload,
      });

      expect(res.status).toBe(200);

      // Verify Proposed Action
      const proposedAction = inMemoryInboundActions.find(
        (a) => a.proposed_payload?.in_reply_to_message_id === 'wamid.agent_safety_01'
      );

      expect(proposedAction).toBeDefined();
      expect(proposedAction?.business_id).toBe(TENANT_A_BIZ);
      expect(proposedAction?.agent_id).toBe('customer_support');
      expect(proposedAction?.status).toBe('pending'); // NEVER automatically executed
      expect(proposedAction?.approval_policy).toBe('owner_or_manager');
      expect(proposedAction?.consequential_level).toBe('medium');
      expect(proposedAction?.proposed_payload?.recipient_phone).toBe('919876500005');
      expect(proposedAction?.proposed_payload?.proposed_message).toContain('VedaVeda Ayurveda');

      // Verify Business Memory
      const memory = inMemoryInboundMemories.find((m) => m.content.includes('wamid.agent_safety_01'));
      expect(memory).toBeDefined();
      expect(memory?.category).toBe('customer_interaction');
      expect(memory?.source).toBe('whatsapp_webhook');
    });
  });

  describe('6. Delivery & Read Status Updates (statuses array)', () => {
    it('records sent, delivered, read, and failed status callbacks in the ledger', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: TENANT_A_WABA_ID,
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: {
                    phone_number_id: TENANT_A_PHONE_ID,
                  },
                  statuses: [
                    {
                      id: 'wamid.msg_status_out_01',
                      status: 'delivered',
                      timestamp: '1720000500',
                      recipient_id: '919876500006',
                    },
                    {
                      id: 'wamid.msg_status_out_02',
                      status: 'failed',
                      timestamp: '1720000510',
                      recipient_id: '919876500007',
                      errors: [{ code: 131026, title: 'Message undeliverable' }],
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const res = await makeRequest(server, '/api/webhooks/whatsapp', {
        method: 'POST',
        body: payload,
      });

      expect(res.status).toBe(200);
      expect(res.body.eventsProcessed).toBe(2);

      const deliveredEvent = inMemoryWebhookEvents.find((e) => e.metadata?.status === 'delivered');
      expect(deliveredEvent).toBeDefined();
      expect(deliveredEvent?.message_type).toBe('status_update');

      const failedEvent = inMemoryWebhookEvents.find((e) => e.metadata?.status === 'failed');
      expect(failedEvent).toBeDefined();
      expect(failedEvent?.metadata?.errors).toBeDefined();
    });
  });

  describe('7. Multi-Tenant Protected Event History (GET /api/webhooks/whatsapp/events)', () => {
    beforeEach(async () => {
      // Seed an event for Tenant A
      await makeRequest(server, '/api/webhooks/whatsapp', {
        method: 'POST',
        body: {
          object: 'whatsapp_business_account',
          entry: [
            {
              id: TENANT_A_WABA_ID,
              changes: [
                {
                  field: 'messages',
                  value: {
                    metadata: { phone_number_id: TENANT_A_PHONE_ID },
                    messages: [{ from: '919876500010', id: 'wamid.tenant_a_event', text: { body: 'Msg for A' } }],
                  },
                },
              ],
            },
          ],
        },
      });

      // Seed an event for Tenant B
      await makeRequest(server, '/api/webhooks/whatsapp', {
        method: 'POST',
        body: {
          object: 'whatsapp_business_account',
          entry: [
            {
              id: 'waba_tenant_b_02',
              changes: [
                {
                  field: 'messages',
                  value: {
                    metadata: { phone_number_id: TENANT_B_PHONE_ID },
                    messages: [{ from: '919876500020', id: 'wamid.tenant_b_event', text: { body: 'Msg for B' } }],
                  },
                },
              ],
            },
          ],
        },
      });
    });

    it('rejects unauthenticated request with 401', async () => {
      const res = await makeRequest(server, '/api/webhooks/whatsapp/events');
      expect(res.status).toBe(401);
    });

    it('returns only Tenant A events when authenticated as Tenant A member', async () => {
      const expSec = Math.floor(Date.now() / 1000) + 3600;
      const authHeader = `Bearer test_jwt:user_veda_owner:owner@vedaveda.in:owner:${TENANT_A_BIZ}:${expSec}`;
      const res = await makeRequest(server, '/api/webhooks/whatsapp/events', {
        headers: {
          Authorization: authHeader,
          'x-business-id': TENANT_A_BIZ,
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.businessId).toBe(TENANT_A_BIZ);

      // Verify all returned events belong ONLY to Tenant A
      for (const ev of res.body.events) {
        expect(ev.business_id).toBe(TENANT_A_BIZ);
        expect(ev.external_message_id).not.toBe('wamid.tenant_b_event');
      }

      const tenantAEvent = res.body.events.find((e: any) => e.external_message_id === 'wamid.tenant_a_event');
      expect(tenantAEvent).toBeDefined();
    });

    it('returns only Tenant B events when authenticated as Tenant B member', async () => {
      const expSec = Math.floor(Date.now() / 1000) + 3600;
      const authHeader = `Bearer test_jwt:user_tenant_b_mgr:mgr@tenantb.com:manager:${TENANT_B_BIZ}:${expSec}`;
      const res = await makeRequest(server, '/api/webhooks/whatsapp/events', {
        headers: {
          Authorization: authHeader,
          'x-business-id': TENANT_B_BIZ,
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.businessId).toBe(TENANT_B_BIZ);

      for (const ev of res.body.events) {
        expect(ev.business_id).toBe(TENANT_B_BIZ);
        expect(ev.external_message_id).not.toBe('wamid.tenant_a_event');
      }

      const tenantBEvent = res.body.events.find((e: any) => e.external_message_id === 'wamid.tenant_b_event');
      expect(tenantBEvent).toBeDefined();
    });
  });

  describe('8. GET /api/webhooks/whatsapp/status — Public Status Diagnostics', () => {
    it('returns 200 with online status and verify token status without leaking token string', async () => {
      const res = await makeRequest(server, '/api/webhooks/whatsapp/status');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('online');
      expect(res.body.provider).toBe('whatsapp_cloud_api');
      expect(res.body.isVerifyTokenConfigured).toBe(true);
      expect(res.body.webhookPath).toBe('/api/webhooks/whatsapp');

      // Crucial: Ensure secret token is not in response
      expect(JSON.stringify(res.body)).not.toContain(TEST_VERIFY_TOKEN);
    });
  });
});
