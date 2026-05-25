import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { personsRouter } from './routes/persons.js';
import { relationshipsRouter } from './routes/relationships.js';
import { treeRouter } from './routes/tree.js';
import { auditRouter } from './routes/audit.js';
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

  app.use(errorHandler);

  return app;
}
