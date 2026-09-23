import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('SECURITY AUDIT: Supabase Row Level Security (RLS) Schema Verification', () => {
  const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  const TENANT_TABLES = [
    'businesses',
    'business_members',
    'customers',
    'leads',
    'orders',
    'bookings',
    'products',
    'services',
    'expenses',
    'business_memory',
    'agent_actions',
    'automations',
    'ai_diagnoses',
    'data_sources',
    'audit_logs',
    'campaigns',
    'business_integrations',
    'connector_webhook_events',
  ];

  it('verifies that schema.sql file exists and is populated', () => {
    expect(schemaContent.length).toBeGreaterThan(1000);
  });

  it('verifies public.is_authorized_business_member SECURITY DEFINER function is defined', () => {
    expect(schemaContent).toContain('CREATE OR REPLACE FUNCTION public.is_authorized_business_member');
    expect(schemaContent).toContain('SECURITY DEFINER');
    expect(schemaContent).toContain('auth.uid()');
  });

  it('verifies public.get_auth_user_business_role SECURITY DEFINER function is defined', () => {
    expect(schemaContent).toContain('CREATE OR REPLACE FUNCTION public.get_auth_user_business_role');
    expect(schemaContent).toContain('SECURITY DEFINER');
  });

  for (const tableName of TENANT_TABLES) {
    it(`verifies Row Level Security is ENABLED on table: public.${tableName}`, () => {
      const rlsEnableRegex = new RegExp(
        `ALTER\\s+TABLE\\s+(public\\.)?${tableName}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
        'i'
      );
      const isEnabled = rlsEnableRegex.test(schemaContent);
      expect(isEnabled).toBe(true);
    });

    it(`verifies tenant isolation policies exist for table: public.${tableName}`, () => {
      const policyRegex = new RegExp(
        `CREATE\\s+POLICY\\s+[^;]+ON\\s+(public\\.)?${tableName}`,
        'gi'
      );
      const matches = schemaContent.match(policyRegex);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(1);
    });
  }

  it('verifies that NO table has DISABLE ROW LEVEL SECURITY in the active schema', () => {
    expect(schemaContent).not.toMatch(/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i);
  });

  it('verifies that business_members table enforces unique (business_id, user_id) constraint', () => {
    expect(schemaContent).toMatch(/UNIQUE\s*\(\s*business_id\s*,\s*user_id\s*\)/i);
  });

  it('verifies that audit_logs is append-only with INSERT and SELECT policies', () => {
    expect(schemaContent).toContain('Members can append audit logs');
    expect(schemaContent).toContain('Members can view audit logs');
  });

  it('verifies that database indexes are configured for multi-tenant queries', () => {
    expect(schemaContent).toContain('CREATE INDEX IF NOT EXISTS idx_business_members_lookup');
    expect(schemaContent).toContain('CREATE INDEX IF NOT EXISTS idx_leads_tenant_status');
    expect(schemaContent).toContain('CREATE INDEX IF NOT EXISTS idx_customers_tenant_status');
    expect(schemaContent).toContain('CREATE INDEX IF NOT EXISTS idx_orders_tenant_date');
    expect(schemaContent).toContain('CREATE INDEX IF NOT EXISTS idx_agent_actions_tenant_status');
  });

  it('SECRET INSULATION AUDIT: Verifies that GEMINI_API_KEY is NEVER imported or referenced in client-side code (/src)', () => {
    function walkDir(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walkDir(fullPath));
        } else if (/\.(tsx?|jsx?|html|css)$/.test(file)) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const srcFiles = walkDir(path.join(process.cwd(), 'src'));
    expect(srcFiles.length).toBeGreaterThan(5);

    for (const filePath of srcFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).not.toContain('GEMINI_API_KEY');
      expect(content).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    }
  });
});

