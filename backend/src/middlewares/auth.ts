import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { prisma } from '../utils/prisma.js';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  twoFactorEnabled: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  teamId?: string | null;
  userRole?: string; // in context of team or system
}

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token && req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      res.status(401).json({ success: false, error: 'Authentication required. No token provided.' });
      return;
    }

    const payload = jwt.verify(token, ENV.JWT_ACCESS_SECRET) as {
      userId: string;
      email: string;
      sessionVersion: number;
    };

    const user = await prisma.user.findFirst({
      where: {
        id: payload.userId,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        twoFactorEnabled: true,
        currentSessionVersion: true,
      },
    });

    if (!user) {
      res.status(401).json({ success: false, error: 'User not found or deactivated.' });
      return;
    }

    if (user.currentSessionVersion !== payload.sessionVersion) {
      res.status(401).json({ success: false, error: 'Session has been invalidated. Please log in again.' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled,
    };

    // Check optional active team context
    const requestedTeamId = req.headers['x-team-id'] as string;
    if (requestedTeamId) {
      const membership = await prisma.teamMember.findFirst({
        where: {
          teamId: requestedTeamId,
          userId: user.id,
          deletedAt: null,
        },
      });

      if (membership) {
        req.teamId = requestedTeamId;
        req.userRole = membership.role;
      } else {
        const teamOwner = await prisma.team.findFirst({
          where: { id: requestedTeamId, ownerId: user.id, deletedAt: null },
        });
        if (teamOwner) {
          req.teamId = requestedTeamId;
          req.userRole = 'OWNER';
        }
      }
    }

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, error: 'Token expired', code: 'TOKEN_EXPIRED' });
      return;
    }
    res.status(401).json({ success: false, error: 'Invalid authentication token' });
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const currentRole = req.userRole || req.user.role;
    if (!allowedRoles.includes(currentRole)) {
      res.status(403).json({
        success: false,
        error: `Forbidden. Requires one of: [${allowedRoles.join(', ')}]. Current role: ${currentRole}`,
      });
      return;
    }

    next();
  };
}
