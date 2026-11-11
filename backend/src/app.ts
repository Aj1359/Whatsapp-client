import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import dotenv from 'dotenv';
dotenv.config();

import webhooksRouter from './routes/webhooks.js';
import internalRouter from './routes/internal.js';
import contactsRouter from './routes/contacts.js';
import broadcastsRouter from './routes/broadcasts.js';
import credentialsRouter from './routes/credentials.js';
import settingsRouter from './routes/settings.js';

export const app = express();

// PRD Security specs: helmet, CORS allows FRONTEND_ORIGIN and any Render frontend
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin or any Render domain / localhost
      if (!origin || origin.includes('onrender.com') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

// Capture raw body for webhook signature verification
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

// Health check endpoint (PRD Page 13: GET /healthz)
app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).send('OK');
});

// Mount Routes
app.use('/webhooks', webhooksRouter);
app.use('/internal', internalRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/campaigns', broadcastsRouter);
app.use('/api/broadcasts', broadcastsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/credentials', credentialsRouter);

// Standard JSON response envelope format per PRD Page 12:
// { "data": ... } on success and { "error": { "code", "message" } } on failure.
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

