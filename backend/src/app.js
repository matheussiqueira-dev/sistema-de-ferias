import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import feriasRoutes from './routes/feriasRoutes.js';
import gerenciaRoutes from './routes/gerenciaRoutes.js';
import { requireAuth, requireGestor } from './middleware/auth.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    }),
  );

  app.use((req, res, next) => {
    console.log(`[${req.method}] ${req.path}`);
    next();
  });

  app.use('/solicitar-ferias', requireAuth, feriasRoutes);
  app.use('/tela', requireAuth, requireGestor, dashboardRoutes);
  app.use('/gerencias', requireAuth, requireGestor, gerenciaRoutes);
  app.use('/', authRoutes);

  return app;
}
