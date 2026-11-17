import { AuthenticatedRequest } from './auth.js';

/**
 * Returns standard Prisma where clause for tenant data scoping:
 * Either scoped to the authenticated user or their active team.
 */
export function getTenantScope(req: AuthenticatedRequest) {
  if (!req.user) {
    throw new Error('Tenant scoping requires authenticated user');
  }

  if (req.teamId) {
    return {
      teamId: req.teamId,
      deletedAt: null,
    };
  }

  return {
    userId: req.user.id,
    deletedAt: null,
  };
}
