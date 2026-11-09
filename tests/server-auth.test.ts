import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { memoryMembershipRegistry, requireAuth, resolveTenantMembership, verifyToken } from '../server/auth';

describe('server authentication boundaries', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects offline demo tokens from production API authentication', async () => {
    const result = await verifyToken('demo_token_offline_preview');
    expect(result.user).toBeNull();
    expect(result.isDemo).toBe(true);
    expect(result.error).toMatch(/demo/i);
  });

  it('does not treat a demo session as an authenticated Supabase user', async () => {
    const result = await verifyToken('offline_sim_preview');
    expect(result.user).toBeNull();
    expect(result.isDemo).toBe(true);
  });

  it('resolves a role from the tenant membership record, not a client role claim', async () => {
    memoryMembershipRegistry.set('test_business:test_owner', {
      role: 'owner',
      userEmail: 'owner@example.com',
    });
    const membership = await resolveTenantMembership('test_owner', 'test_business');
    expect(membership).toEqual({ isMember: true, role: 'owner' });
  });

  it('denies a user who has no membership in the requested tenant', async () => {
    const membership = await resolveTenantMembership('test_owner', 'different_business');
    expect(membership.isMember).toBe(false);
  });

  it('returns 401 when an API request has no bearer token', async () => {
    const req = { headers: {}, body: {}, query: {} } as unknown as Request;
    const res = {
      statusCode: 200,
      payload: undefined as unknown,
      status(code: number) { this.statusCode = code; return this; },
      json(payload: unknown) { this.payload = payload; return this; },
    } as unknown as Response & { statusCode: number; payload?: unknown };
    const next = vi.fn() as unknown as NextFunction;

    await requireAuth({ requireBusiness: false })(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.payload).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(next).not.toHaveBeenCalled();
  });
});
