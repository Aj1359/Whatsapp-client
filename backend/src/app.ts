import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env.js';
import webhooksRouter from './routes/webhooks.js';
import internalRouter from './routes/internal.js';
import dashboardRouter from './routes/dashboard.js';
import contactsRouter from './routes/contacts.js';
import templatesRouter from './routes/templates.js';
import campaignsRouter from './routes/campaigns.js';
import settingsRouter from './routes/settings.js';
import repliesRouter from './routes/replies.js';
import './services/forwardingService.js';

export const app = express();

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'unsafe-none' },
  })
);

// Strict CORS: Limited to configured FRONTEND_ORIGIN only
app.use(
  cors({
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Org-Id', 'X-Requested-With', 'Accept', 'X-Cron-Secret'],
  })
);

// Capture raw body for webhook HMAC signature verification
app.use(
  express.json({
    limit: '15mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Global Rate limiter: 300 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Public health check endpoint
app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).send('OK');
});

// Mount Routes
app.use('/webhooks', webhooksRouter);
app.use('/internal', internalRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/replies', repliesRouter);

// Standard JSON error handling envelope format: { "error": { "code", "message" } }
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error('Unhandled error:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An unexpected error occurred',
    },
  });
});
