import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import 'dotenv/config';

import { pool, logger } from './src/db/pool.ts';
import { initDB } from './src/db/schema.ts';
import { authenticateToken } from './src/middleware/auth.ts';

import authRoutes from './src/routes/auth.ts';
import userRoutes from './src/routes/users.ts';
import attendanceRoutes from './src/routes/attendance.ts';
import gradeRoutes from './src/routes/grades.ts';
import paymentRoutes from './src/routes/payments.ts';
import messageRoutes from './src/routes/messages.ts';
import settingsRoutes from './src/routes/settings.ts';
import reportRoutes from './src/routes/reports.ts';
import schoolsRoutes from './src/routes/schools.ts';
import smsRoutes from './src/routes/smsRoutes.ts';
if (!process.env.JWT_SECRET) {
  console.error('CRITICAL: JWT_SECRET is not defined in environment variables.');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Graceful Shutdown
const shutdown = async () => {
  logger.info('Shutting down server...');
  await pool.end();
  logger.info('Database connection pool closed.');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function startServer() {
  await initDB();
  const app = express();

  // Trust proxy for rate limiting behind Nginx
  app.set('trust proxy', 1);

  // Security Middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for development with Vite
  }));

  // Health Check for Kubernetes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Rate Limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, default: false },
    message: 'Too many requests from this IP, please try again after 15 minutes'
  });
  app.use('/api/', limiter);

  // CORS
  const allowedOrigins = process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL, 'http://localhost:5173']
    : true;

  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  // Request Logging Middleware
  app.use((req: any, res: any, next: any) => {
    const start = Date.now();
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';

    res.on('finish', () => {
      const duration = Date.now() - start;
      const userId = req.user?.id || 'unauthenticated';
      const logMsg = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | Duration: ${duration}ms | UserID: ${userId} | IP: ${ip}`;

      if (res.statusCode >= 500) {
        console.error(logMsg);
      } else if (res.statusCode >= 400) {
        console.warn(logMsg);
      } else {
        console.log(logMsg);
      }
    });

    next();
  });

  // --- Mount Route Modules ---

  // Sync endpoint for offline data
  app.post('/api/sync', authenticateToken, async (req: any, res) => {
    const { actions } = req.body;
    const results: any[] = [];
    const now = Date.now();
    const FOUR_HOURS = 4 * 60 * 60 * 1000;

    for (const action of actions) {
      if (now - action.timestamp > FOUR_HOURS) {
        results.push({ status: 'expired', action });
        continue;
      }

      try {
        if (action.type === 'attendance') {
          const { student_id, date, status } = action.data;
          await pool.query('INSERT INTO attendance (student_id, date, status, teacher_id, school_id) VALUES ($1, $2, $3, $4, $5)', [
            student_id, date, status, req.user.id, req.user.school_id
          ]);
          results.push({ status: 'success', action });
        } else if (action.type === 'grade') {
          const { student_id, subject, score, date, component_id } = action.data;
          await pool.query('INSERT INTO grades (student_id, subject, score, date, teacher_id, component_id, school_id) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
            student_id, subject, score, date, req.user.id, component_id || null, req.user.school_id
          ]);
          results.push({ status: 'success', action });
        }
      } catch (e: any) {
        logger.error('Sync error for action', { action, error: (e as Error).message });
        results.push({ status: 'error', error: 'Database error', action });
      }
    }

    res.json({ results });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api', userRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api', gradeRoutes);
  app.use('/api', paymentRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/admin', schoolsRoutes);
  app.use('/api/sms', authenticateToken, smsRoutes);

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(3000, '0.0.0.0', () => {
    console.log('Server running on http://localhost:3000');
  });
}

startServer();
