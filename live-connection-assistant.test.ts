import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../../server';
import http from 'node:http';
import {
  sanitizeUserInput,
  PROVIDER_ASSISTANCE_GUIDES,
  getWhatDoINowAdvice,
  explainErrorInLanguage,
} from '../../src/lib/connectors/assistance-guide';
import {
  analyzeConnectorScreen,
  SCREEN_DISCLAIMER,
} from '../../src/lib/connectors/screen-assistant';
import {
  getProviderCapabilityModel,
  canAgentPerformAction,
  CONSEQUENTIAL_ACTIONS,
} from '../../src/lib/connectors/capability-model';
import { BusinessIntegration } from '../../src/types/database';

let testServer: http.Server;

const validTestToken = `test_jwt:user_veda_owner:owner@vedaveda.in:owner:biz_01_health_bengaluru:${Math.floor(Date.now() / 1000) + 7200}`;

async function makeRequest(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  const addr = testServer.address() as { port: number };
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
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    testServer = app.listen(0, '127.0.0.1', () => {
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    testServer.close(() => resolve());
  });
});

describe('Live Connection Assistant: Security Sanitizer', () => {
  it('masks 6-digit OTPs and verification codes', () => {
    const input = 'My verification code is 482910, please help me enter it';
    const result = sanitizeUserInput(input);
    expect(result.hasSensitive).toBe(true);
    expect(result.sanitized).toContain('[PROTECTED_OTP___VERIFICATION_CODE]');
    expect(result.sanitized).not.toContain('482910');
  });

  it('masks password and pass phrases', () => {
    const input = 'My password is SuperSecretPass123! what do I do?';
    const result = sanitizeUserInput(input);
    expect(result.hasSensitive).toBe(true);
    expect(result.sanitized).toContain('[PROTECTED_PASSWORD___PASSPHRASE]');
    expect(result.sanitized).not.toContain('SuperSecretPass123!');
  });

  it('masks API secrets, App Secrets, and Bearer tokens', () => {
    const input = 'Here is my app secret: 9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c and key rzp_test_8s7d6f5g4h3j2k';
    const result = sanitizeUserInput(input);
    expect(result.hasSensitive).toBe(true);
    expect(result.sanitized).not.toContain('9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c');
    expect(result.sanitized).not.toContain('rzp_test_8s7d6f5g4h3j2k');
  });

  it('preserves non-sensitive questions from business owners', () => {
    const input = 'Where do I find my WhatsApp phone number ID on the Meta portal?';
    const result = sanitizeUserInput(input);
    expect(result.hasSensitive).toBe(false);
    expect(result.sanitized).toBe(input);
  });
});

describe('Live Connection Assistant: Multilingual Guides & Branching', () => {
  it('provides comprehensive guides for all required providers', () => {
    const providers = ['whatsapp_business', 'facebook', 'instagram', 'youtube', 'razorpay'] as const;
    for (const p of providers) {
      const guide = PROVIDER_ASSISTANCE_GUIDES[p];
      expect(guide).toBeDefined();
      expect(guide.providerName).toBeTruthy();
      expect(guide.steps.length).toBeGreaterThanOrEqual(3);
      expect(guide.accountCreation).toBeDefined();
      expect(guide.symptoms.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('supports English, Hindi, and Hinglish for "What do I do now?" advice', () => {
    const enAdvice = getWhatDoINowAdvice('whatsapp_business', 'authorization', 'has_account', 'en');
    const hiAdvice = getWhatDoINowAdvice('whatsapp_business', 'authorization', 'has_account', 'hi');
    const hinglishAdvice = getWhatDoINowAdvice('whatsapp_business', 'authorization', 'has_account', 'hinglish');

    expect(enAdvice).toContain('Phone Number ID');
    expect(hiAdvice).toBeTruthy();
    expect(hinglishAdvice).toContain('Phone Number ID');
  });

  it('supports the "I do not have an account" branching flow with prerequisites and official links', () => {
    const advice = getWhatDoINowAdvice('razorpay', 'account_check', 'needs_account', 'en');
    expect(advice).toContain('account');

    const guide = PROVIDER_ASSISTANCE_GUIDES.razorpay;
    expect(guide.accountCreation.officialUrl).toContain('razorpay.com');
    expect(guide.accountCreation.prerequisites.length).toBeGreaterThan(0);
  });

  it('explains common connector errors in plain business language', () => {
    const tokenExp = explainErrorInLanguage('token_expired', 'Access token has expired', 'hinglish');
    expect(tokenExp.explanation).toContain('token expire');
    expect(tokenExp.action).toContain('Reconnect');

    const permDenied = explainErrorInLanguage('permission_denied', 'Missing permissions', 'en');
    expect(permDenied.explanation).toContain('permissions');
    expect(permDenied.action).toContain('Connect again');
  });
});

describe('Live Connection Assistant: Visual Screen Reading Guardrails', () => {
  it('contains mandatory security disclaimer that AI cannot control computers or click buttons', () => {
    expect(SCREEN_DISCLAIMER).toContain('cannot click buttons');
    expect(SCREEN_DISCLAIMER).toContain('passwords');
  });

  it('analyzes screenshots with structured findings and next step guidance', () => {
    const dummyImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const analysis = analyzeConnectorScreen({
      provider: 'whatsapp_business',
      base64Image: dummyImage,
      language: 'hinglish',
    });

    expect(analysis.identifiedScreen).toBeTruthy();
    expect(analysis.nextStepGuidance).toBeTruthy();
    expect(analysis.nextStepGuidanceHinglish).toBeTruthy();
    expect(analysis.visibleButtons).toBeInstanceOf(Array);
  });
});

describe('Live Connection Assistant: Capability Model & Human-in-the-Loop', () => {
  const dummyIntegrations: BusinessIntegration[] = [
    {
      id: 'int_01',
      business_id: 'biz_01_health_bengaluru',
      provider: 'whatsapp_business',
      status: 'CONNECTED',
      is_test_mode: false,
      scopes: ['whatsapp_business_messaging', 'whatsapp_business_management'],
      connected_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  it('enforces that consequential actions require human approval', () => {
    const model = getProviderCapabilityModel('biz_01_health_bengaluru', 'whatsapp_business', dummyIntegrations);
    expect(model.isConnected).toBe(true);
    expect(model.approvalRequired).toBe(true);
    expect(model.consequentialActions).toContain('send_whatsapp_message');

    // Consequential action requires human approval
    const check = canAgentPerformAction('biz_01_health_bengaluru', 'whatsapp_business', 'send_whatsapp_message', dummyIntegrations);
    expect(check.allowed).toBe(true);
    expect(check.requiresHumanApproval).toBe(true);
    expect(check.reason).toContain('explicit human approval');

    // Non-consequential read action does not require human approval
    const readCheck = canAgentPerformAction('biz_01_health_bengaluru', 'whatsapp_business', 'get_sync_status', dummyIntegrations);
    expect(readCheck.allowed).toBe(true);
    expect(readCheck.requiresHumanApproval).toBe(false);
  });

  it('blocks all actions on disconnected connectors', () => {
    const model = getProviderCapabilityModel('biz_01_health_bengaluru', 'razorpay', dummyIntegrations);
    expect(model.isConnected).toBe(false);

    const check = canAgentPerformAction('biz_01_health_bengaluru', 'razorpay', 'issue_refund', dummyIntegrations);
    expect(check.allowed).toBe(false);
    expect(check.requiresHumanApproval).toBe(false);
    expect(check.reason).toContain('not connected');
  });
});

describe('Live Connection Assistant: API Endpoints & Auth Guardrails', () => {
  it('rejects unauthenticated requests to /api/connectors/assist/chat with 401', async () => {
    const res = await makeRequest('/api/connectors/assist/chat', {
      method: 'POST',
      body: {
        provider: 'whatsapp_business',
        message: 'How do I setup WhatsApp?',
      },
    });

    expect(res.status).toBe(401);
  });

  it('accepts authenticated request to /api/connectors/assist/chat and redacts sensitive input', async () => {
    const res = await makeRequest('/api/connectors/assist/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validTestToken}`,
        'x-business-id': 'biz_01_health_bengaluru',
      },
      body: {
        provider: 'whatsapp_business',
        message: 'My verification code is 123456 what should I do next?',
        language: 'hinglish',
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.sensitiveDetected).toBe(true);
    expect(res.body.reply).toBeTruthy();
  });

  it('rejects unauthenticated requests to /api/connectors/assist/screen with 401', async () => {
    const res = await makeRequest('/api/connectors/assist/screen', {
      method: 'POST',
      body: {
        provider: 'whatsapp_business',
        base64Image: 'dummy',
      },
    });

    expect(res.status).toBe(401);
  });

  it('accepts authenticated requests to /api/connectors/assist/screen and returns analysis', async () => {
    const res = await makeRequest('/api/connectors/assist/screen', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validTestToken}`,
        'x-business-id': 'biz_01_health_bengaluru',
      },
      body: {
        provider: 'whatsapp_business',
        base64Image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        language: 'hinglish',
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.analysis).toBeDefined();
    expect(res.body.analysis.nextStepGuidance).toBeTruthy();
  });
});
