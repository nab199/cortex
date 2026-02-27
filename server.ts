import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Pool } = pg;
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import 'dotenv/config';
import axios from 'axios';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import smsRoutes from './src/routes/smsRoutes'; // remove .ts extension
if (!process.env.JWT_SECRET) {
  console.error('CRITICAL: JWT_SECRET is not defined in environment variables.');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DB_URL,
});
const JWT_SECRET = process.env.JWT_SECRET!;

// Simple Production Logger
const logger = {
  info: (msg: string) => {
    const entry = `[${new Date().toISOString()}] INFO: ${msg}\n`;
    console.log(entry.trim());
    if (process.env.NODE_ENV === 'production') {
      try { path.join(__dirname, 'logs', 'app.log'); } catch (e) { } // For future use
    }
  },
  error: (msg: string, err?: any) => {
    const entry = `[${new Date().toISOString()}] ERROR: ${msg} ${err ? (err.stack || JSON.stringify(err)) : ''}\n`;
    console.error(entry.trim());
  }
};

// Graceful Shutdown
const shutdown = async () => {
  logger.info('Shutting down server...');
  await pool.end();
  logger.info('Database connection pool closed.');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Initialize Database
const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schools (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role_id INTEGER REFERENCES roles(id),
      email TEXT UNIQUE,
      phone TEXT,
      school_id INTEGER REFERENCES schools(id)
    );

    CREATE TABLE IF NOT EXISTS students (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id),
      parent_id INTEGER REFERENCES users(id),
      grade_level TEXT
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id),
      subject TEXT
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      student_id INTEGER REFERENCES students(id),
      date TEXT NOT NULL,
      status TEXT CHECK(status IN ('present', 'absent', 'late')) NOT NULL,
      teacher_id INTEGER REFERENCES users(id),
      school_id INTEGER REFERENCES schools(id)
    );

    CREATE TABLE IF NOT EXISTS grade_components (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      weight REAL NOT NULL DEFAULT 0.0,
      school_id INTEGER REFERENCES schools(id),
      UNIQUE(name, school_id)
    );

    CREATE TABLE IF NOT EXISTS grades (
      id SERIAL PRIMARY KEY,
      student_id INTEGER REFERENCES students(id),
      subject TEXT NOT NULL,
      score REAL NOT NULL,
      date TEXT NOT NULL,
      teacher_id INTEGER REFERENCES users(id),
      component_id INTEGER REFERENCES grade_components(id),
      school_id INTEGER REFERENCES schools(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      student_id INTEGER REFERENCES students(id),
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'ETB',
      status TEXT DEFAULT 'pending',
      tx_ref TEXT UNIQUE,
      description TEXT,
      date TEXT NOT NULL,
      school_id INTEGER REFERENCES schools(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER REFERENCES users(id),
      receiver_id INTEGER REFERENCES users(id),
      content TEXT NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      school_id INTEGER REFERENCES schools(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT NOT NULL,
      value TEXT,
      school_id INTEGER REFERENCES schools(id),
      PRIMARY KEY (key, school_id)
    );

    CREATE TABLE IF NOT EXISTS fee_types (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      school_id INTEGER REFERENCES schools(id)
    );

    CREATE TABLE IF NOT EXISTS student_balances (
      id SERIAL PRIMARY KEY,
      student_id INTEGER REFERENCES students(id),
      fee_type_id INTEGER REFERENCES fee_types(id),
      amount_paid REAL DEFAULT 0,
      status TEXT DEFAULT 'unpaid' CHECK(status IN ('unpaid', 'partial', 'paid')),
      school_id INTEGER REFERENCES schools(id)
    );
  `);

  // Seed Roles
  const roles = ['admin', 'teacher', 'student', 'parent'];
  for (const role of roles) {
    await pool.query('INSERT INTO roles (name) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = $1)', [role]);
  }

  // Seed Default School
  let defaultSchoolId: number;
  const schoolRes = await pool.query('SELECT id FROM schools WHERE name = $1', ['Default School']);
  if (schoolRes.rows.length === 0) {
    const insertSchool = await pool.query('INSERT INTO schools (name) VALUES ($1) RETURNING id', ['Default School']);
    defaultSchoolId = insertSchool.rows[0].id;
  } else {
    defaultSchoolId = schoolRes.rows[0].id;
  }

  // Seed Admin
  const adminRes = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);
  if (adminRes.rows.length === 0) {
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'ChangeMe@2026';
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);
    const roleRes = await pool.query('SELECT id FROM roles WHERE name = $1', ['admin']);
    const adminRoleId = roleRes.rows[0].id;
    await pool.query('INSERT INTO users (username, password, full_name, role_id, email, school_id) VALUES ($1, $2, $3, $4, $5, $6)', [
      'admin', hashedPassword, 'System Administrator', adminRoleId, 'admin@school.com', defaultSchoolId
    ]);
  }

  logger.info('Database initialized and seeded.');
};

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
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, default: false },
    message: 'Too many requests from this IP, please try again after 15 minutes'
  });
  app.use('/api/', limiter);

  // Allow Vercel frontend in production, permissive in dev
  const allowedOrigins = process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL, 'http://localhost:5173']
    : true;

  app.use(cors({
    origin: allowedOrigins,
    credentials: true
  }));
  app.use(express.json());
  app.use(cookieParser());

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const token = req.cookies.token || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) {
        res.clearCookie('token');
        return res.sendStatus(403);
      }
      req.user = user;
      next();
    });
  };

  // --- API Routes ---

  // Auth
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    // Support both username and email login
    const user = db.prepare(`
      SELECT u.*, r.name as role 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.username = ? OR u.email = ?
    `).get(username, username) as any;

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, school_id: user.school_id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.json({ user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name, school_id: user.school_id } });
  });

  app.post('/api/auth/signup', (req, res) => {
    const { email, password, full_name, school_name } = req.body;

    try {
      db.transaction(() => {
        // 1. Create School
        const schoolResult = db.prepare('INSERT INTO schools (name) VALUES (?)').run(school_name);
        const schoolId = schoolResult.lastInsertRowid;

        // 2. Create Admin User for this school
        const hashedPassword = bcrypt.hashSync(password, 10);
        const adminRoleId = db.prepare('SELECT id FROM roles WHERE name = ?').get('admin').id;

        // Use email as username for signup
        const userResult = db.prepare('INSERT INTO users (username, password, full_name, role_id, email, school_id) VALUES (?, ?, ?, ?, ?, ?)').run(
          email, hashedPassword, full_name, adminRoleId, email, schoolId
        );

        const token = jwt.sign(
          { id: userResult.lastInsertRowid, username: email, role: 'admin', school_id: schoolId },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        res.cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000
        });

        res.json({
          user: {
            id: userResult.lastInsertRowid,
            username: email,
            role: 'admin',
            full_name,
            school_id: schoolId
          }
        });
      })();
    } catch (e: any) {
      if (e.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ error: 'Email or School Name already exists' });
      } else {
        res.status(500).json({ error: 'An unexpected error occurred' });
      }
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
  });

  // Sync endpoint for offline data
  app.post('/api/sync', authenticateToken, (req: any, res) => {
    const { actions } = req.body; // Array of { type, data, timestamp }
    const results = [];
    const now = Date.now();
    const FOUR_HOURS = 4 * 60 * 60 * 1000;

    for (const action of actions) {
      // Check if data is older than 4 hours
      if (now - action.timestamp > FOUR_HOURS) {
        results.push({ status: 'expired', action });
        continue;
      }

      try {
        if (action.type === 'attendance') {
          const { student_id, date, status } = action.data;
          db.prepare('INSERT INTO attendance (student_id, date, status, teacher_id, school_id) VALUES (?, ?, ?, ?, ?)').run(
            student_id, date, status, req.user.id, req.user.school_id
          );
          results.push({ status: 'success', action });
        } else if (action.type === 'grade') {
          const { student_id, subject, score, date, component_id } = action.data;
          db.prepare('INSERT INTO grades (student_id, subject, score, date, teacher_id, component_id, school_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            student_id, subject, score, date, req.user.id, component_id || null, req.user.school_id
          );
          results.push({ status: 'success', action });
        }
      } catch (e: any) {
        results.push({ status: 'error', error: 'Database error', action });
      }
    }

    res.json({ results });
  });

  // Users
  app.get('/api/users', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const users = db.prepare(`
      SELECT u.id, u.username, u.full_name, r.name as role, u.email, u.phone,
             s.grade_level, t.subject
      FROM users u 
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN students s ON u.id = s.user_id
      LEFT JOIN teachers t ON u.id = t.user_id
      WHERE u.school_id = ?
    `).all(req.user.school_id);
    res.json(users);
  });

  app.get('/api/students', authenticateToken, (req: any, res) => {
    const students = db.prepare(`
      SELECT s.id, u.full_name, s.grade_level, u.username, u.email
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE u.school_id = ?
    `).all(req.user.school_id);
    res.json(students);
  });

  app.post('/api/users', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { username, password, full_name, role, email, phone, grade_level, subject } = req.body;
    const roleId = db.prepare('SELECT id FROM roles WHERE name = ?').get(role).id;
    const hashedPassword = bcrypt.hashSync(password, 10);
    try {
      const result = db.prepare('INSERT INTO users (username, password, full_name, role_id, email, phone, school_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        username, hashedPassword, full_name, roleId, email, phone, req.user.school_id
      );

      if (role === 'student') {
        db.prepare('INSERT INTO students (user_id, grade_level) VALUES (?, ?)').run(result.lastInsertRowid, grade_level);
      } else if (role === 'teacher') {
        db.prepare('INSERT INTO teachers (user_id, subject) VALUES (?, ?)').run(result.lastInsertRowid, subject);
      }

      res.json({ id: result.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: 'Failed to create user' });
    }
  });

  // Attendance
  app.get('/api/attendance', authenticateToken, (req: any, res) => {
    const { student_id, date } = req.query;
    let query = `
      SELECT a.*, u.full_name as student_name 
      FROM attendance a 
      JOIN students s ON a.student_id = s.id 
      JOIN users u ON s.user_id = u.id
      WHERE a.school_id = ?
    `;
    const params: any[] = [req.user.school_id];
    if (student_id) {
      query += ' AND a.student_id = ?';
      params.push(student_id);
    }
    const records = db.prepare(query).all(...params);
    res.json(records);
  });

  app.post('/api/attendance', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.sendStatus(403);
    const { student_id, date, status } = req.body;
    const teacher_id = req.user.id;
    db.prepare('INSERT INTO attendance (student_id, date, status, teacher_id, school_id) VALUES (?, ?, ?, ?, ?)').run(
      student_id, date, status, teacher_id, req.user.school_id
    );
    res.json({ success: true });
  });

  // Grades
  app.get('/api/grades', authenticateToken, (req: any, res) => {
    const { student_id } = req.query;
    let query = `
      SELECT g.*, u.full_name as student_name 
      FROM grades g 
      JOIN students s ON g.student_id = s.id 
      JOIN users u ON s.user_id = u.id
      WHERE g.school_id = ?
    `;
    const params: any[] = [req.user.school_id];
    if (student_id) {
      query += ' AND g.student_id = ?';
      params.push(student_id);
    }
    const records = db.prepare(query).all(...params);
    res.json(records);
  });

  app.post('/api/grades', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.sendStatus(403);
    const { student_id, subject, score, date, component_id } = req.body;
    const teacher_id = req.user.id;
    db.prepare('INSERT INTO grades (student_id, subject, score, date, teacher_id, component_id, school_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      student_id, subject, score, date, teacher_id, component_id || null, req.user.school_id
    );

    // Notification Logic (Mock Afro Message)
    if (score < 50) {
      console.log(`Low grade alert for student ${student_id} in ${subject}: ${score}`);
      // In real app, call Afro Message API here
    }

    res.json({ success: true });
  });

  app.put('/api/grades/:id', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.sendStatus(403);
    const { id } = req.params;
    const { score, date, component_id } = req.body;
    try {
      db.prepare('UPDATE grades SET score = ?, date = ?, component_id = ? WHERE id = ? AND school_id = ?').run(score, date, component_id, id, req.user.school_id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: 'Failed to update grade' });
    }
  });

  // Grade Components
  app.get('/api/grade-components', authenticateToken, (req: any, res) => {
    const components = db.prepare('SELECT * FROM grade_components WHERE school_id = ?').all(req.user.school_id);
    res.json(components);
  });

  app.post('/api/grade-components', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { name, weight } = req.body;
    try {
      db.prepare('INSERT INTO grade_components (name, weight, school_id) VALUES (?, ?, ?)').run(name, weight, req.user.school_id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: 'Failed to add component' });
    }
  });

  app.put('/api/grade-components/:id', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { id } = req.params;
    const { weight } = req.body;
    db.prepare('UPDATE grade_components SET weight = ? WHERE id = ? AND school_id = ?').run(weight, id, req.user.school_id);
    res.json({ success: true });
  });

  app.delete('/api/grade-components/:id', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { id } = req.params;
    try {
      db.prepare('DELETE FROM grade_components WHERE id = ? AND school_id = ?').run(id, req.user.school_id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: 'Failed to delete component' });
    }
  });

  // Marklist Calculation
  app.get('/api/marklist', authenticateToken, (req: any, res) => {
    const { subject } = req.query;
    if (!subject) return res.status(400).json({ error: 'Subject is required' });

    const students = db.prepare(`
      SELECT s.id, u.full_name 
      FROM students s 
      JOIN users u ON s.user_id = u.id
      WHERE u.school_id = ?
    `).all(req.user.school_id) as any[];

    const weights = db.prepare('SELECT * FROM grade_components WHERE school_id = ?').all(req.user.school_id) as any[];
    const attendanceWeight = weights.find(w => w.name.toLowerCase() === 'attendance')?.weight || 0;

    const marklist = students.map(student => {
      const grades = db.prepare(`
        SELECT g.*, c.name as component_name, c.weight 
        FROM grades g 
        LEFT JOIN grade_components c ON g.component_id = c.id 
        WHERE g.student_id = ? AND g.subject = ? AND g.school_id = ?
      `).all(student.id, subject, req.user.school_id) as any[];

      // Calculate weighted average for non-attendance components
      let weightedSum = 0;
      let totalWeightUsed = 0;

      const componentAverages: any = {};

      weights.forEach(w => {
        if (w.name.toLowerCase() === 'attendance') return;

        const compGrades = grades.filter(g => g.component_id === w.id);
        if (compGrades.length > 0) {
          const avg = compGrades.reduce((sum, g) => sum + g.score, 0) / compGrades.length;
          componentAverages[w.name] = avg;
          weightedSum += avg * w.weight;
          totalWeightUsed += w.weight;
        } else {
          componentAverages[w.name] = 0;
        }
      });

      // Calculate attendance score
      const attendance = db.prepare('SELECT status FROM attendance WHERE student_id = ?').all(student.id) as any[];
      const presentCount = attendance.filter(a => a.status === 'present').length;
      const attendanceScore = attendance.length > 0 ? (presentCount / attendance.length) * 100 : 0;

      componentAverages['Attendance'] = attendanceScore;
      weightedSum += attendanceScore * attendanceWeight;
      totalWeightUsed += attendanceWeight;

      const finalAverage = totalWeightUsed > 0 ? (weightedSum / totalWeightUsed) : 0;

      return {
        student_id: student.id,
        student_name: student.full_name,
        averages: componentAverages,
        finalAverage: parseFloat(finalAverage.toFixed(2))
      };
    });

    // Calculate Ranks
    const sorted = [...marklist].sort((a, b) => b.finalAverage - a.finalAverage);
    const finalMarklist = marklist.map(item => ({
      ...item,
      rank: sorted.findIndex(s => s.student_id === item.student_id) + 1
    }));

    res.json(finalMarklist);
  });

  // Payments (Chapa Integration)
  app.post('/api/payments/initialize', authenticateToken, async (req: any, res) => {
    const { amount, email, first_name, last_name, description } = req.body;
    const tx_ref = `tx-${Date.now()}`;

    // Save pending payment to DB
    const student = db.prepare('SELECT id FROM students WHERE user_id = ?').get(req.user.id);

    db.prepare('INSERT INTO payments (student_id, amount, tx_ref, description, date, school_id) VALUES (?, ?, ?, ?, ?, ?)').run(
      student?.id || null, amount, tx_ref, description, new Date().toISOString(), req.user.school_id
    );

    // Fetch Chapa API Key from settings
    const chapaKey = db.prepare('SELECT value FROM settings WHERE key = ? AND school_id = ?').get('chapa_api_key', req.user.school_id)?.value;

    if (!chapaKey) {
      logger.info('Chapa API Key not configured. Using mock checkout.');
      return res.json({
        status: 'success',
        data: {
          checkout_url: `https://test.chapa.co/checkout-now/${tx_ref}`
        }
      });
    }

    try {
      const response = await axios.post('https://api.chapa.co/v1/transaction/initialize', {
        amount,
        currency: 'ETB',
        email,
        first_name,
        last_name,
        tx_ref,
        callback_url: `${process.env.PUBLIC_URL || 'http://localhost:3000'}/api/payments/verify/${tx_ref}`,
        customization: {
          title: 'Cortex School Fees',
          description: description
        }
      }, {
        headers: { Authorization: `Bearer ${chapaKey}` }
      });
      res.json(response.data);
    } catch (err: any) {
      logger.error('Chapa initialization failed', err.response?.data || err.message);
      res.status(500).json({ error: 'Payment initialization failed' });
    }
  });

  app.get('/api/payments/verify/:tx_ref', authenticateToken, async (req: any, res) => {
    const { tx_ref } = req.params;
    const chapaKey = db.prepare('SELECT value FROM settings WHERE key = ? AND school_id = ?').get('chapa_api_key', req.user.school_id)?.value;

    if (!chapaKey) {
      // Mock verification
      db.prepare('UPDATE payments SET status = ? WHERE tx_ref = ?').run('success', tx_ref);
      return res.json({ status: 'success', message: 'Mock payment verified' });
    }

    try {
      const response = await axios.get(`https://api.chapa.co/v1/transaction/verify/${tx_ref}`, {
        headers: { Authorization: `Bearer ${chapaKey}` }
      });

      if (response.data.status === 'success') {
        db.prepare('UPDATE payments SET status = ? WHERE tx_ref = ? AND school_id = ?').run('success', tx_ref, req.user.school_id);

        // Update student balance if applicable
        const payment = db.prepare('SELECT * FROM payments WHERE tx_ref = ?').get(tx_ref);
        if (payment && payment.student_id) {
          // Find the most recent unpaid balance (simple logic for now)
          const balance = db.prepare('SELECT * FROM student_balances WHERE student_id = ? AND status != ? AND school_id = ? LIMIT 1')
            .get(payment.student_id, 'paid', req.user.school_id);

          if (balance) {
            const newAmountPaid = (balance.amount_paid || 0) + payment.amount;
            const feeType = db.prepare('SELECT amount FROM fee_types WHERE id = ?').get(balance.fee_type_id);
            const newStatus = newAmountPaid >= feeType.amount ? 'paid' : 'partial';

            db.prepare('UPDATE student_balances SET amount_paid = ?, status = ? WHERE id = ?')
              .run(newAmountPaid, newStatus, balance.id);
          }
        }

        res.json({ status: 'success', message: 'Payment verified successfully' });
      } else {
        res.status(400).json({ status: 'failed', message: 'Payment verification failed' });
      }
    } catch (err: any) {
      logger.error('Chapa verification failed', err.response?.data || err.message);
      res.status(500).json({ error: 'Verification error' });
    }
  });

  // Fee Management
  app.get('/api/fee-types', authenticateToken, (req: any, res) => {
    const types = db.prepare('SELECT * FROM fee_types WHERE school_id = ?').all(req.user.school_id);
    res.json(types);
  });

  app.post('/api/fee-types', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { name, amount } = req.body;
    db.prepare('INSERT INTO fee_types (name, amount, school_id) VALUES (?, ?, ?)').run(name, amount, req.user.school_id);
    res.json({ success: true });
  });

  app.get('/api/student-balances', authenticateToken, (req: any, res) => {
    const sid = req.user.school_id;
    let query = `
      SELECT sb.*, ft.name as fee_name, ft.amount as total_amount, u.full_name as student_name
      FROM student_balances sb
      JOIN fee_types ft ON sb.fee_type_id = ft.id
      JOIN students s ON sb.student_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE sb.school_id = ?
    `;
    const params = [sid];

    if (req.user.role === 'student') {
      const student = db.prepare('SELECT id FROM students WHERE user_id = ?').get(req.user.id);
      query += ` AND sb.student_id = ?`;
      params.push(student.id);
    }

    const balances = db.prepare(query).all(...params);
    res.json(balances);
  });
  app.get('/api/messages', authenticateToken, (req: any, res) => {
    const userId = req.user.id;
    const messages = db.prepare(`
      SELECT m.*, u1.full_name as sender_name, u2.full_name as receiver_name 
      FROM messages m 
      JOIN users u1 ON m.sender_id = u1.id 
      JOIN users u2 ON m.receiver_id = u2.id 
      WHERE (m.sender_id = ? OR m.receiver_id = ?) AND m.school_id = ?
      ORDER BY m.timestamp DESC
    `).all(userId, userId, req.user.school_id);
    res.json(messages);
  });

  app.post('/api/messages', authenticateToken, (req: any, res) => {
    const { receiver_id, content } = req.body;
    const sender_id = req.user.id;
    db.prepare('INSERT INTO messages (sender_id, receiver_id, content, school_id) VALUES (?, ?, ?, ?)')
      .run(sender_id, receiver_id, content, req.user.school_id);
    res.json({ success: true });
  });

  // Mount SMS routes under /api/sms
  app.use('/api/sms', authenticateToken, smsRoutes);

  // Settings
  app.get('/api/settings', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const settings = db.prepare('SELECT * FROM settings WHERE school_id = ?').all(req.user.school_id);
    const settingsMap = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    res.json(settingsMap);
  });

  app.post('/api/settings', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { chapa_api_key } = req.body;
    if (chapa_api_key !== undefined) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value, school_id) VALUES (?, ?, ?)').run('chapa_api_key', chapa_api_key, req.user.school_id);
    }
    res.json({ success: true });
  });

  // Analytics/Reports
  app.get('/api/reports/summary', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);

    const sid = req.user.school_id;
    const totalStudents = db.prepare('SELECT COUNT(*) as count FROM students s JOIN users u ON s.user_id = u.id WHERE u.school_id = ?').get(sid).count;
    const totalTeachers = db.prepare("SELECT COUNT(*) as count FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'teacher' AND u.school_id = ?").get(sid).count;
    const totalRevenue = db.prepare("SELECT SUM(amount) as total FROM payments WHERE status = 'success' AND school_id = ?").get(sid).total || 0;
    const averageGrade = db.prepare('SELECT AVG(score) as avg FROM grades WHERE school_id = ?').get(sid).avg || 0;

    res.json({
      totalStudents,
      totalTeachers,
      totalRevenue,
      averageGrade
    });
  });

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
