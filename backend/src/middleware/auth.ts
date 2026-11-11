import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const JWKS_URL = env.SUPABASE_JWKS_URL ?? `${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }
  const token = header.slice(7);
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: `${env.SUPABASE_URL}/auth/v1` });
    req.user = {
      id: payload.sub as string,
      email: payload.email as string | undefined,
      role: (payload as any).role as string | undefined,
    };
    next();
  } catch (err) {
    logger.warn({ err }, 'JWT verification failed');
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Cron jobs authenticated by a static secret in X-Cron-Secret header */
export function requireCronSecret(req: Request, res: Response, next: NextFunction) {
  if (req.headers['x-cron-secret'] !== env.CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

