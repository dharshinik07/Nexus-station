import { describe, it, expect, vi } from 'vitest';
import { getTenantScope } from '../src/middlewares/tenant.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';

describe('Multi-Tenant Strict Data Isolation', () => {
  it('strictly scopes queries to the authenticated user ID', () => {
    const userA_Req = {
      user: {
        id: 'user_1111_alpha',
        email: 'userA@vault.dev',
        fullName: 'User Alpha',
        role: 'OWNER',
        twoFactorEnabled: false,
      },
    } as AuthenticatedRequest;

    const userB_Req = {
      user: {
        id: 'user_2222_bravo',
        email: 'userB@vault.dev',
        fullName: 'User Bravo',
        role: 'OWNER',
        twoFactorEnabled: false,
      },
    } as AuthenticatedRequest;

    const scopeA = getTenantScope(userA_Req);
    const scopeB = getTenantScope(userB_Req);

    // Scopes must never cross or bleed
    expect(scopeA.userId).toBe('user_1111_alpha');
    expect(scopeB.userId).toBe('user_2222_bravo');
    expect(scopeA.userId).not.toBe(scopeB.userId);

    // Both enforce non-deleted records
    expect(scopeA.deletedAt).toBeNull();
    expect(scopeB.deletedAt).toBeNull();
  });

  it('throws an error if tenant scope is requested without an authenticated user', () => {
    const unauthenticatedReq = {} as AuthenticatedRequest;
    expect(() => getTenantScope(unauthenticatedReq)).toThrow('Tenant scoping requires authenticated user');
  });

  it('properly scopes to teamId when active team context is supplied', () => {
    const teamMemberReq = {
      user: {
        id: 'user_1111_alpha',
        email: 'userA@vault.dev',
        fullName: 'User Alpha',
        role: 'EDITOR',
        twoFactorEnabled: false,
      },
      teamId: 'team_collab_999',
    } as AuthenticatedRequest;

    const teamScope = getTenantScope(teamMemberReq);
    expect(teamScope.teamId).toBe('team_collab_999');
    expect((teamScope as any).userId).toBeUndefined();
    expect(teamScope.deletedAt).toBeNull();
  });
});
