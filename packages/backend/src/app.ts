import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { personsRouter } from './routes/persons.js';
import { relationshipsRouter } from './routes/relationships.js';
import { treeRouter } from './routes/tree.js';
import { auditRouter } from './routes/audit.js';
import { exportRouter } from './routes/export.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.APP_URL, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/persons', personsRouter);
  app.use('/api/relationships', relationshipsRouter);
  app.use('/api/tree', treeRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/export', exportRouter);

  // In production Express serves the Vite build; in dev Vite's own server handles it.
  if (process.env.NODE_ENV === 'production') {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const frontend = path.join(__dirname, '../../frontend/dist');
    app.use(express.static(frontend));
    app.get('*', (_req, res) => res.sendFile(path.join(frontend, 'index.html')));
  }

  app.use(errorHandler);

  return app;
}
