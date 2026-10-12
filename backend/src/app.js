import express from 'express';
import cors from 'cors';
import config from './config.js';
import { logger } from './lib/logger.js';
import { requireAuth } from './auth/middleware.js';
import healthRouter from './routes/health.js';
import projectsRouter from './routes/projects.js';
import filesRouter from './routes/files.js';
import languagesRouter from './routes/languages.js';
import diagnosticsRouter from './routes/diagnostics.js';
import meRouter from './routes/me.js';
import usersRouter from './routes/users.js';
import invitesRouter from './routes/invites.js';
import aiRouter from './routes/ai.js';
import runRouter from './routes/run.js';
import { rateLimit } from './middleware/rateLimit.js';


export function createApp() {
  const app = express();

  app.use(cors({ origin: config.clientOrigins, credentials: true }));
  app.use(express.json({ limit: '2mb' }));

  app.use((req, _res, next) => {
    if (!req.path.startsWith('/api/health')) logger.debug(req.method, req.path);
    next();
  });

  // Public
  app.use('/api/health', healthRouter);
  app.use('/api/languages', languagesRouter);

  // Authenticated
  app.use('/api/me', meRouter);
  app.use('/api/projects', requireAuth, projectsRouter);
  app.use('/api/files', requireAuth, filesRouter);
  app.use('/api/users', requireAuth, usersRouter);
  app.use('/api/invites', requireAuth, invitesRouter);
 app.use('/api/ai', requireAuth, rateLimit({ max: 20 }), aiRouter);
  app.use('/api/run', requireAuth, rateLimit({ max: 30 }), runRouter);
  app.use('/api/diagnostics', requireAuth, rateLimit({ max: 60 }), diagnosticsRouter);



  // 404 — must come after every route
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) logger.error('unhandled error:', err);
    res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
  });

  return app;
}
