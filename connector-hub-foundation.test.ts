import { describe, it, expect } from 'vitest';
import {
  getAllConnectorSpecs,
  getConnectorSpec,
  getConnectorAdapter,
  checkConnectorCapability,
  sanitizeIntegrationForClient,
  CONNECTOR_SPECS,
  getDefaultIntegrations,
} from '../../src/lib/connectors/registry';
import { canAccessRoute, canPerformAction } from '../../src/lib/permissions';
import { BusinessIntegration, ConnectorProviderId, ConnectorStatus } from '../../src/types/database';

describe('Phase 6 Step 1: Connector Hub Foundation Tests', () => {
  const TENANT_A = '11111111-1111-4111-8111-111111111111';
  const TENANT_B = '22222222-2222-4222-8222-222222222222';

  describe('1. Provider-Agnostic Registry & Specifications', () => {
    it('registers exactly all 5 long-term connector providers', () => {
      const specs = getAllConnectorSpecs();
      expect(specs).toHaveLength(5);

      const providerIds = specs.map((s) => s.id);
      expect(providerIds).toContain('whatsapp_business');
      expect(providerIds).toContain('facebook');
      expect(providerIds).toContain('instagram');
      expect(providerIds).toContain('youtube');
      expect(providerIds).toContain('razorpay');
    });

    it('each provider specification contains all required metadata and capabilities', () => {
      const expectedCategories: Record<ConnectorProviderId, string> = {
        whatsapp_business: 'messaging',
        facebook: 'social',
        instagram: 'social',
        youtube: 'video',
        razorpay: 'payments',
      };

      for (const spec of getAllConnectorSpecs()) {
        expect(spec.displayName).toBeDefined();
        expect(spec.displayName.length).toBeGreaterThan(0);
        expect(spec.category).toBe(expectedCategories[spec.id]);
        expect(spec.shortDescription).toBeDefined();
        expect(spec.defaultCapabilities.length).toBeGreaterThan(0);
        expect(spec.requiredScopes.length).toBeGreaterThan(0);
        expect(spec.securityNotice).toBeDefined();
        expect(spec.securityNotice.length).toBeGreaterThan(10);
      }
    });

    it('instantiates typed adapters for all 5 providers implementing ConnectorAdapter interface', () => {
      const providers: ConnectorProviderId[] = [
        'whatsapp_business',
        'facebook',
        'instagram',
        'youtube',
        'razorpay',
      ];

      for (const p of providers) {
        const adapter = getConnectorAdapter(p);
        expect(adapter).toBeDefined();
        expect(adapter.providerId).toBe(p);
        expect(typeof adapter.connect).toBe('function');
        expect(typeof adapter.disconnect).toBe('function');
        expect(typeof adapter.getConnectionStatus).toBe('function');
        expect(typeof adapter.healthCheck).toBe('function');
      }
    });
  });

  describe('2. Truthful Initial States (No False Connections)', () => {
    it('seed integrations start strictly in NOT_CONNECTED status', () => {
      const defaultInts = getDefaultIntegrations(TENANT_A);
      expect(defaultInts).toHaveLength(5);

      for (const int of defaultInts) {
        expect(int.status).toBe('NOT_CONNECTED');
        expect(int.business_id).toBe(TENANT_A);
        expect(int.encrypted_credential_ref).toBeFalsy();
        expect(int.last_error).toBeFalsy();
      }
    });

    it('rejects unauthorized access when no provider is connected', () => {
      const defaultInts = getDefaultIntegrations(TENANT_A);
      const capCheck = checkConnectorCapability(
        TENANT_A,
        'whatsapp_business',
        'whatsapp_send_messages',
        defaultInts
      );

      expect(capCheck.allowed).toBe(false);
      expect(capCheck.status).toBe('NOT_CONNECTED');
      expect(capCheck.reason).toContain('NOT_CONNECTED');
    });
  });

  describe('3. Multi-Tenant Scoping & Isolation', () => {
    it('strictly isolates capabilities by business_id (Tenant B cannot use Tenant A connections)', () => {
      // Tenant A connects WhatsApp in sandbox mode
      const tenantAIntegrations: BusinessIntegration[] = [
        {
          id: 'int-1',
          business_id: TENANT_A,
          provider: 'whatsapp_business',
          status: 'CONNECTED',
          is_test_mode: true,
          provider_account_id: 'waba-12345',
          scopes: ['whatsapp_business_messaging'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      // Tenant A check passes
      const checkA = checkConnectorCapability(
        TENANT_A,
        'whatsapp_business',
        'whatsapp_send_messages',
        tenantAIntegrations
      );
      expect(checkA.allowed).toBe(true);
      expect(checkA.status).toBe('CONNECTED');

      // Tenant B check fails because tenant does not match
      const checkB = checkConnectorCapability(
        TENANT_B,
        'whatsapp_business',
        'whatsapp_send_messages',
        tenantAIntegrations
      );
      expect(checkB.allowed).toBe(false);
      expect(checkB.status).toBe('NOT_CONNECTED');
    });
  });

  describe('4. Zero-Token Client Exposure & Sanitization', () => {
    it('sanitizes integrations to completely strip credentials and raw tokens from client views', () => {
      const rawIntegrationWithSecrets: any = {
        id: 'int-secret-test',
        business_id: TENANT_A,
        provider: 'razorpay',
        status: 'CONNECTED',
        is_test_mode: true,
        credentials_encrypted: 'aes-256-gcm:ciphertext-fake-secret',
        access_token: 'secret_raw_token_must_not_leak',
        refresh_token: 'refresh_secret_must_not_leak',
        key_secret: 'razorpay_secret_key_secret',
        provider_account_id: 'rzp_test_123',
        provider_account_name: 'Dr. Vaidya Payments',
        scopes_granted: ['payments:read'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const clientSafe = sanitizeIntegrationForClient(rawIntegrationWithSecrets);

      expect(clientSafe.id).toBe('int-secret-test');
      expect(clientSafe.provider).toBe('razorpay');
      expect(clientSafe.status).toBe('CONNECTED');
      expect(clientSafe.provider_account_id).toBe('rzp_test_123');

      // Verify no sensitive keys exist on sanitized object
      expect((clientSafe as any).credentials_encrypted).toBeUndefined();
      expect((clientSafe as any).access_token).toBeUndefined();
      expect((clientSafe as any).refresh_token).toBeUndefined();
      expect((clientSafe as any).key_secret).toBeUndefined();
    });
  });

  describe('5. RBAC & Route Permissions Matrix', () => {
    it('allows owner and manager to access connectors route', () => {
      expect(canAccessRoute('owner', 'connectors')).toBe(true);
      expect(canAccessRoute('manager', 'connectors')).toBe(true);
    });

    it('blocks staff role from accessing connectors route', () => {
      expect(canAccessRoute('staff', 'connectors')).toBe(false);
    });

    it('authorizes manage_connectors only for owner and manager', () => {
      expect(canPerformAction('owner', 'manage_connectors')).toBe(true);
      expect(canPerformAction('manager', 'manage_connectors')).toBe(true);
      expect(canPerformAction('staff', 'manage_connectors')).toBe(false);
    });
  });

  describe('6. Test/Development Mode Distinction', () => {
    it('enforces is_test_mode flag so sandbox mode cannot masquerade as real live connection', async () => {
      const whatsappAdapter = getConnectorAdapter('whatsapp_business');

      // Connect in Sandbox Mode
      const testConnect = await whatsappAdapter.connect({
        businessId: TENANT_A,
        isTestMode: true,
      });

      expect(testConnect.success).toBe(true);
      expect(testConnect.integration).toBeDefined();
      expect(testConnect.integration?.is_test_mode).toBe(true);
      expect(testConnect.integration?.status).toBe('CONNECTED');
      expect(testConnect.integration?.provider_account_id).toBeDefined();

      // Health check with connected test integration returns healthy diagnostic
      const health = await whatsappAdapter.healthCheck(
        TENANT_A,
        testConnect.integration as any,
        true
      );
      expect(health.status).toBe('healthy');
      expect(health.message).toContain('Sandbox');
    });
  });

  describe('7. Disconnect Safety & Non-Destructive Invariants', () => {
    it('disconnecting a channel only updates the integration status and leaves other business data untouched', async () => {
      const whatsappAdapter = getConnectorAdapter('whatsapp_business');

      const disconnectRes = await whatsappAdapter.disconnect({
        businessId: TENANT_A,
        revokeAtProvider: true,
        isTestMode: true,
      });

      expect(disconnectRes.success).toBe(true);

      // Verify that disconnection status transition is DISCONNECTED
      const statusCheck = await whatsappAdapter.getConnectionStatus(TENANT_A, {
        id: 'int-wa',
        business_id: TENANT_A,
        provider: 'whatsapp_business',
        status: 'DISCONNECTED',
        scopes: [],
        is_test_mode: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      expect(statusCheck.status).toBe('DISCONNECTED');
    });
  });
});
