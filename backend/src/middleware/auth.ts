import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { pool } from '../db/pool.js';

const JWKS_URL = env.SUPABASE_JWKS_URL ?? `${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

export interface AuthenticatedContext {
  userId: string;
  orgId: string;
  role: string;
  email?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedContext;
      // backward-compatible alias
      user?: {
        id: string;
        email?: string;
        role?: string;
      };
      orgId?: string;
    }
  }
}

/**
 * Verifies Supabase JWT and resolves verified organization membership.
 * Accepts X-Org-Id only if the user is verified to be a member of that org.
 * Otherwise defaults to their single organization membership.
 * Returns 403 if they have no valid membership or are not authorized for the requested org.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or malformed Authorization header',
      },
    });
    return;
  }

  const token = authHeader.slice(7);
  let userId: string;
  let email: string | undefined;

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${env.SUPABASE_URL}/auth/v1`,
    });
    userId = payload.sub as string;
    email = payload.email as string | undefined;
  } catch (err: any) {
    logger.warn({ err: err.message }, 'JWT verification failed');
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid, expired, or untrusted session token',
      },
    });
    return;
  }

  // Load user's organization memberships from DB
  let client;
  try {
    client = await pool.connect();
    const { rows: memberships } = await client.query(
      `SELECT org_id, role FROM memberships WHERE user_id = $1`,
      [userId]
    );

    if (!memberships || memberships.length === 0) {
      res.status(403).json({
        error: {
          code: 'NO_ORGANIZATION_MEMBERSHIP',
          message: 'User does not belong to any active organization',
        },
      });
      return;
    }

    const requestedOrgId = req.headers['x-org-id'] as string | undefined;
    let selectedMembership: { org_id: string; role: string } | undefined;

    if (requestedOrgId) {
      selectedMembership = memberships.find((m) => m.org_id === requestedOrgId);
      if (!selectedMembership) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN_ORG_ACCESS',
            message: 'You are not a member of the requested organization',
          },
        });
        return;
      }
    } else {
      // Default to first membership (or single membership)
      selectedMembership = memberships[0];
    }

    if (!selectedMembership) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN_ORG_ACCESS',
          message: 'Unable to resolve valid organization context',
        },
      });
      return;
    }

    const authCtx: AuthenticatedContext = {
      userId,
      orgId: selectedMembership.org_id,
      role: selectedMembership.role,
      email,
    };

    req.auth = authCtx;
    req.orgId = authCtx.orgId;
    req.user = {
      id: userId,
      email,
      role: selectedMembership.role,
    };

    next();
  } catch (err: any) {
    logger.error({ err: err.message }, 'Error verifying organization membership in requireAuth');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to verify organization context',
      },
    });
  } finally {
    if (client) client.release();
  }
}

/**
 * Authenticates internal cron/tick calls via X-Cron-Secret header.
 */
export function requireCronSecret(req: Request, res: Response, next: NextFunction) {
  const secretHeader = req.headers['x-cron-secret'];
  if (!secretHeader || secretHeader !== env.CRON_SECRET) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED_CRON',
        message: 'Invalid or missing X-Cron-Secret header',
      },
    });
    return;
  }
  next();
}
