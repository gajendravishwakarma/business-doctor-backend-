import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { app } from '../../server';
import http from 'node:http';
import { whatsAppVault } from '../../server/vault/whatsapp-vault';
import {
  recordWhatsAppAudit,
  getWhatsAppAuditLogs,
  resetWhatsAppAuditTestState,
} from '../../server/services/whatsapp-audit-service';
import {
  proposeOutboundMessage,
  approveOutboundMessage,
  executeOutboundJob,
  getOutboundJobs,
  classifyWhatsAppError,
  resetOutboundJobsTestState,
} from '../../server/services/whatsapp-outbound-service';
import {
  validatePhoneNumberId,
  validateWabaId,
  validateBusinessId,
  validateProvider,
  validateExternalMessageId,
} from '../../server/services/whatsapp-validator';
import { MetaApiError } from '../../server/services/meta-whatsapp-client';

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

describe('WhatsApp Production Readiness Hardening Test Suite', () => {
  let server: http.Server;
  const TENANT_A = 'biz_production_hardening_01';
  const TENANT_B = 'biz_production_hardening_02';

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
    resetWhatsAppAuditTestState();
    resetOutboundJobsTestState();
  });

  describe('1. Input Validation Service & Sanitization', () => {
    it('validates phone_number_id correctly', () => {
      expect(validatePhoneNumberId('100609349424084').valid).toBe(true);
      expect(validatePhoneNumberId('').valid).toBe(false);
      expect(validatePhoneNumberId('abc12345').valid).toBe(false);
      expect(validatePhoneNumberId('1234').valid).toBe(false); // too short
    });

    it('validates waba_id correctly', () => {
      expect(validateWabaId('104593821039482').valid).toBe(true);
      expect(validateWabaId('waba_104593821039482').valid).toBe(true);
      expect(validateWabaId('invalid!!waba').valid).toBe(false);
    });

    it('validates business_id correctly', () => {
      expect(validateBusinessId(TENANT_A).valid).toBe(true);
      expect(validateBusinessId('').valid).toBe(false);
      expect(validateBusinessId('invalid business!@#').valid).toBe(false);
    });

    it('validates external message id correctly', () => {
      expect(validateExternalMessageId('wamid.HBgL1234567890').valid).toBe(true);
      expect(validateExternalMessageId('msg_random_123').valid).toBe(true);
      expect(validateExternalMessageId('').valid).toBe(false);
      expect(validateExternalMessageId('a'.repeat(257)).valid).toBe(false); // exceeds max length
    });

    it('validates provider strictly', () => {
      expect(validateProvider('whatsapp_business').valid).toBe(true);
      expect(validateProvider('telegram').valid).toBe(false);
      expect(validateProvider('').valid).toBe(false);
    });
  });

  describe('2. State Machine & WhatsApp Connection Record', () => {
    it('returns DISCONNECTED connection record when not configured', async () => {
      const res = await makeRequest(server, '/api/connectors/whatsapp/connection-record', {
        method: 'GET',
        headers: { 'x-business-id': TENANT_A },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.connection.connection_status).toBe('DISCONNECTED');
      expect(res.body.connection.business_id).toBe(TENANT_A);
      expect(res.body.connection.provider).toBe('whatsapp_business');
    });

    it('transitions to CONNECTED and provides full connection record after authorization', async () => {
      const authRes = await makeRequest(server, '/api/connectors/whatsapp/authorize', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
        body: {
          phoneNumberId: '100609349424084',
          accessToken: 'EAAG_SANDBOX_TOKEN',
          wabaId: '104593821039482',
          isTestMode: true,
        },
      });

      expect(authRes.status).toBe(200);
      expect(authRes.body.connection.status).toBe('CONNECTED');

      const recordRes = await makeRequest(server, '/api/connectors/whatsapp/connection-record', {
        method: 'GET',
        headers: { 'x-business-id': TENANT_A },
      });

      expect(recordRes.status).toBe(200);
      expect(recordRes.body.success).toBe(true);
      const conn = recordRes.body.connection;
      expect(conn.business_id).toBe(TENANT_A);
      expect(conn.provider).toBe('whatsapp_business');
      expect(conn.connection_status).toBe('CONNECTED');
      expect(conn.phone_number_id).toBe('100609349424084');
      expect(conn.waba_id).toBe('104593821039482');
      expect(conn.capabilities).toContain('inbound_webhooks');
      expect(conn.capabilities).toContain('outbound_messaging');
      expect(conn.capabilities).toContain('template_messaging');
      expect(conn.capabilities).toContain('human_in_the_loop_approvals');
      expect(conn.last_health_check).toBeDefined();
    });

    it('transitions to DISCONNECTED when disconnected', async () => {
      // Connect first
      await makeRequest(server, '/api/connectors/whatsapp/authorize', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
        body: {
          phoneNumberId: '100609349424084',
          accessToken: 'EAAG_SANDBOX_TOKEN',
          isTestMode: true,
        },
      });

      // Disconnect
      const disRes = await makeRequest(server, '/api/connectors/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
      });

      expect(disRes.status).toBe(200);

      // Verify connection record
      const recordRes = await makeRequest(server, '/api/connectors/whatsapp/connection-record', {
        method: 'GET',
        headers: { 'x-business-id': TENANT_A },
      });

      expect(recordRes.body.connection.connection_status).toBe('DISCONNECTED');
    });
  });

  describe('3. Webhook Health Dashboard Endpoint (/api/connectors/whatsapp/webhook-health)', () => {
    it('returns disconnected dashboard health when not connected', async () => {
      const res = await makeRequest(server, '/api/connectors/whatsapp/webhook-health', {
        method: 'GET',
        headers: { 'x-business-id': TENANT_B },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.connected).toBe(false);
      expect(res.body.status).toBe('DISCONNECTED');
      expect(res.body.tenant).toBe(TENANT_B);
      expect(res.body.error_count).toBe(0);
    });

    it('returns connected health diagnostics when active', async () => {
      await makeRequest(server, '/api/connectors/whatsapp/authorize', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
        body: {
          phoneNumberId: '100609349424084',
          accessToken: 'EAAG_SANDBOX_TOKEN',
          wabaId: '104593821039482',
          isTestMode: true,
        },
      });

      const res = await makeRequest(server, '/api/connectors/whatsapp/webhook-health', {
        method: 'GET',
        headers: { 'x-business-id': TENANT_A },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.connected).toBe(true);
      expect(res.body.status).toBe('CONNECTED');
      expect(res.body.tenant).toBe(TENANT_A);
      expect(res.body.WABA).toBe('104593821039482');
      expect(res.body.phone_number_id).toBe('100609349424084');
      expect(res.body.phone_number).toBeDefined();
      expect(res.body.webhook_verified).toBe(true);
    });
  });

  describe('4. Safe Outbound Execution Service & State Machine', () => {
    beforeEach(async () => {
      await whatsAppVault.storeCredential({
        businessId: TENANT_A,
        phoneNumberId: '100609349424084',
        accessToken: 'EAAG_SANDBOX_TOKEN',
        isTestMode: true,
      });
    });

    it('proposes a message entering proposed status', async () => {
      const res = await makeRequest(server, '/api/connectors/whatsapp/outbound/propose', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
        body: {
          to: '+919876543210',
          message: 'Hello, your appointment is confirmed for tomorrow.',
          requiresHumanApproval: true,
        },
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.job.status).toBe('proposed');
      expect(res.body.job.requires_human_approval).toBe(true);
      expect(res.body.job.business_id).toBe(TENANT_A);
    });

    it('rejects execution of an unapproved job', async () => {
      const proposeRes = await makeRequest(server, '/api/connectors/whatsapp/outbound/propose', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
        body: {
          to: '+919876543210',
          message: 'Sensitive message',
          requiresHumanApproval: true,
        },
      });

      const jobId = proposeRes.body.job.id;

      // Attempt to execute without approval
      const execRes = await makeRequest(server, '/api/connectors/whatsapp/outbound/execute', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
        body: { jobId },
      });

      expect(execRes.status).toBe(400);
      expect(execRes.body.error).toBe('execution_failed');
      expect(execRes.body.message).toContain('human approval');
    });

    it('approves and executes job through the complete state machine', async () => {
      const proposeRes = await makeRequest(server, '/api/connectors/whatsapp/outbound/propose', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
        body: {
          to: '+919876543210',
          message: 'Welcome to Business Doctor AI!',
          requiresHumanApproval: true,
        },
      });

      const jobId = proposeRes.body.job.id;

      // Approve
      const approveRes = await makeRequest(server, '/api/connectors/whatsapp/outbound/approve', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
        body: { jobId, approvedBy: 'lead_operator_sarah' },
      });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.job.status).toBe('approved');
      expect(approveRes.body.job.approved_by).toBe('lead_operator_sarah');

      // Execute
      const execRes = await makeRequest(server, '/api/connectors/whatsapp/outbound/execute', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
        body: { jobId },
      });

      expect(execRes.status).toBe(200);
      expect(execRes.body.job.status).toBe('sent');
      expect(execRes.body.job.external_message_id).toBeDefined();
    });

    it('correctly classifies transient vs permanent errors', () => {
      // Transient rate limit error (code 4 or subcode 130429)
      const rateLimitErr = new MetaApiError({
        message: 'Rate limit hit',
        type: 'OAuthException',
        code: 4,
        error_subcode: 130429,
      });
      const c1 = classifyWhatsAppError(rateLimitErr);
      expect(c1.isTransient).toBe(true);

      // Network timeout
      const netErr = new Error('fetch failed: ETIMEDOUT connect');
      const c2 = classifyWhatsAppError(netErr);
      expect(c2.isTransient).toBe(true);

      // Permanent token invalid error (code 190)
      const tokenErr = new MetaApiError({
        message: 'Invalid OAuth token',
        type: 'OAuthException',
        code: 190,
      });
      const c3 = classifyWhatsAppError(tokenErr);
      expect(c3.isTransient).toBe(false);

      // Permanent undeliverable error (subcode 131026)
      const undeliverableErr = new MetaApiError({
        message: 'Message undeliverable',
        type: 'GraphMethodException',
        code: 100,
        error_subcode: 131026,
      });
      const c4 = classifyWhatsAppError(undeliverableErr);
      expect(c4.isTransient).toBe(false);
    });
  });

  describe('5. Audit Logging & Strict Business Tenant Isolation', () => {
    it('isolates audit logs strictly by business_id', async () => {
      // Record audits for Tenant A
      recordWhatsAppAudit({
        business_id: TENANT_A,
        action: 'connection_started',
        details: 'Tenant A connection test',
      });
      recordWhatsAppAudit({
        business_id: TENANT_A,
        action: 'connection_completed',
        details: 'Tenant A connected',
      });

      // Record audit for Tenant B
      recordWhatsAppAudit({
        business_id: TENANT_B,
        action: 'connection_started',
        details: 'Tenant B connection test',
      });

      const logsA = await makeRequest(server, '/api/connectors/whatsapp/audit-logs', {
        method: 'GET',
        headers: { 'x-business-id': TENANT_A },
      });

      const logsB = await makeRequest(server, '/api/connectors/whatsapp/audit-logs', {
        method: 'GET',
        headers: { 'x-business-id': TENANT_B },
      });

      expect(logsA.status).toBe(200);
      expect(logsA.body.total).toBe(2);
      expect(logsA.body.logs.every((l: any) => l.business_id === TENANT_A)).toBe(true);

      expect(logsB.status).toBe(200);
      expect(logsB.body.total).toBe(1);
      expect(logsB.body.logs.every((l: any) => l.business_id === TENANT_B)).toBe(true);
    });

    it('records full audit event lifecycle for connector operations', async () => {
      // 1. Authorize (produces connection_started and connection_completed)
      await makeRequest(server, '/api/connectors/whatsapp/authorize', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
        body: {
          phoneNumberId: '100609349424084',
          accessToken: 'EAAG_SANDBOX_TOKEN',
          isTestMode: true,
        },
      });

      // 2. Propose outbound message (produces message_proposed)
      const propRes = await makeRequest(server, '/api/connectors/whatsapp/outbound/propose', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
        body: {
          to: '+919876543210',
          message: 'Test audit lifecycle',
          requiresHumanApproval: true,
        },
      });

      const jobId = propRes.body.job.id;

      // 3. Approve message (produces message_approved)
      await makeRequest(server, '/api/connectors/whatsapp/outbound/approve', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
        body: { jobId, approvedBy: 'operator_1' },
      });

      // 4. Execute message (produces message_sent)
      await makeRequest(server, '/api/connectors/whatsapp/outbound/execute', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
        body: { jobId },
      });

      // 5. Disconnect (produces connection_disconnected)
      await makeRequest(server, '/api/connectors/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'x-business-id': TENANT_A },
      });

      // Fetch audit logs
      const logsRes = await makeRequest(server, '/api/connectors/whatsapp/audit-logs', {
        method: 'GET',
        headers: { 'x-business-id': TENANT_A },
      });

      const actions = logsRes.body.logs.map((l: any) => l.action);
      expect(actions).toContain('connection_started');
      expect(actions).toContain('connection_completed');
      expect(actions).toContain('message_proposed');
      expect(actions).toContain('message_approved');
      expect(actions).toContain('message_sent');
      expect(actions).toContain('connection_disconnected');
    });
  });
});
