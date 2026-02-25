import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database('school.db');
const JWT_SECRET = process.env.JWT_SECRET || 'school-secret-123';

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS schools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role_id INTEGER,
    email TEXT UNIQUE,
    phone TEXT,
    school_id INTEGER,
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (school_id) REFERENCES schools(id)
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    parent_id INTEGER,
    grade_level TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    subject TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    date TEXT NOT NULL,
    status TEXT CHECK(status IN ('present', 'absent', 'late')) NOT NULL,
    teacher_id INTEGER,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (teacher_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS grade_components (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    weight REAL NOT NULL DEFAULT 0.0
  );

  CREATE TABLE IF NOT EXISTS grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    subject TEXT NOT NULL,
    score REAL NOT NULL,
    date TEXT NOT NULL,
    teacher_id INTEGER,
    component_id INTEGER,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (teacher_id) REFERENCES users(id),
    FOREIGN KEY (component_id) REFERENCES grade_components(id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'ETB',
    status TEXT DEFAULT 'pending',
    tx_ref TEXT UNIQUE,
    description TEXT,
    date TEXT NOT NULL,
    FOREIGN KEY (student_id) REFERENCES students(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER,
    receiver_id INTEGER,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Seed Roles
const roles = ['admin', 'teacher', 'student', 'parent'];
const insertRole = db.prepare('INSERT OR IGNORE INTO roles (name) VALUES (?)');
roles.forEach(role => insertRole.run(role));

// Seed Default School
const schoolExists = db.prepare('SELECT * FROM schools WHERE name = ?').get('Default School');
let defaultSchoolId: number | bigint;
if (!schoolExists) {
  const res = db.prepare('INSERT INTO schools (name) VALUES (?)').run('Default School');
  defaultSchoolId = res.lastInsertRowid;
} else {
  defaultSchoolId = (schoolExists as any).id;
}

// Seed Grade Components
const components = [
  { name: 'Test', weight: 0.5 },
  { name: 'Assignment', weight: 0.3 },
  { name: 'Attendance', weight: 0.2 }
];
const insertComponent = db.prepare('INSERT OR IGNORE INTO grade_components (name, weight) VALUES (?, ?)');
components.forEach(c => insertComponent.run(c.name, c.weight));

// Seed Admin if not exists
const adminExists = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  const adminRoleId = db.prepare('SELECT id FROM roles WHERE name = ?').get('admin').id;
  db.prepare('INSERT INTO users (username, password, full_name, role_id, email, school_id) VALUES (?, ?, ?, ?, ?, ?)').run(
    'admin', hashedPassword, 'System Administrator', adminRoleId, 'admin@school.com', defaultSchoolId
  );
}

// Seed Students if not exists
const studentExists = db.prepare('SELECT * FROM users WHERE username = ?').get('student1');
if (!studentExists) {
  const studentRoleId = db.prepare('SELECT id FROM roles WHERE name = ?').get('student').id;
  const hashedPassword = bcrypt.hashSync('student123', 10);
  
  const s1 = db.prepare('INSERT INTO users (username, password, full_name, role_id, email, school_id) VALUES (?, ?, ?, ?, ?, ?)').run(
    'student1', hashedPassword, 'John Doe', studentRoleId, 'john@example.com', defaultSchoolId
  );
  db.prepare('INSERT INTO students (user_id, grade_level) VALUES (?, ?)').run(s1.lastInsertRowid, '10A');

  const s2 = db.prepare('INSERT INTO users (username, password, full_name, role_id, email, school_id) VALUES (?, ?, ?, ?, ?, ?)').run(
    'student2', hashedPassword, 'Jane Smith', studentRoleId, 'jane@example.com', defaultSchoolId
  );
  db.prepare('INSERT INTO students (user_id, grade_level) VALUES (?, ?)').run(s2.lastInsertRowid, '10B');
}

async function startServer() {
  const app = express();
  
  // Trust proxy for rate limiting behind Nginx
  app.set('trust proxy', 1);

  // Security Middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for development with Vite
  }));

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

  app.use(cors());
  app.use(express.json());

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
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

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name, school_id: user.school_id } });
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

        const token = jwt.sign({ id: userResult.lastInsertRowid, username: email, role: 'admin', school_id: schoolId }, JWT_SECRET);
        res.json({ 
          token, 
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
        res.status(500).json({ error: e.message });
      }
    }
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
          db.prepare('INSERT INTO attendance (student_id, date, status, teacher_id) VALUES (?, ?, ?, ?)').run(
            student_id, date, status, req.user.id
          );
          results.push({ status: 'success', action });
        } else if (action.type === 'grade') {
          const { student_id, subject, score, date, component_id } = action.data;
          db.prepare('INSERT INTO grades (student_id, subject, score, date, teacher_id, component_id) VALUES (?, ?, ?, ?, ?, ?)').run(
            student_id, subject, score, date, req.user.id, component_id || null
          );
          results.push({ status: 'success', action });
        }
      } catch (e: any) {
        results.push({ status: 'error', error: e.message, action });
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
    `).all();
    res.json(users);
  });

  app.get('/api/students', authenticateToken, (req: any, res) => {
    const students = db.prepare(`
      SELECT s.id, u.full_name, s.grade_level, u.username, u.email
      FROM students s
      JOIN users u ON s.user_id = u.id
    `).all();
    res.json(students);
  });

  app.post('/api/users', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { username, password, full_name, role, email, phone, grade_level, subject } = req.body;
    const roleId = db.prepare('SELECT id FROM roles WHERE name = ?').get(role).id;
    const hashedPassword = bcrypt.hashSync(password, 10);
    try {
      const result = db.prepare('INSERT INTO users (username, password, full_name, role_id, email, phone) VALUES (?, ?, ?, ?, ?, ?)').run(
        username, hashedPassword, full_name, roleId, email, phone
      );
      
      if (role === 'student') {
        db.prepare('INSERT INTO students (user_id, grade_level) VALUES (?, ?)').run(result.lastInsertRowid, grade_level);
      } else if (role === 'teacher') {
        db.prepare('INSERT INTO teachers (user_id, subject) VALUES (?, ?)').run(result.lastInsertRowid, subject);
      }
      
      res.json({ id: result.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
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
    `;
    const params = [];
    if (student_id) {
      query += ' WHERE a.student_id = ?';
      params.push(student_id);
    }
    const records = db.prepare(query).all(...params);
    res.json(records);
  });

  app.post('/api/attendance', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.sendStatus(403);
    const { student_id, date, status } = req.body;
    const teacher_id = req.user.id;
    db.prepare('INSERT INTO attendance (student_id, date, status, teacher_id) VALUES (?, ?, ?, ?)').run(
      student_id, date, status, teacher_id
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
    `;
    const params = [];
    if (student_id) {
      query += ' WHERE g.student_id = ?';
      params.push(student_id);
    }
    const records = db.prepare(query).all(...params);
    res.json(records);
  });

  app.post('/api/grades', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.sendStatus(403);
    const { student_id, subject, score, date, component_id } = req.body;
    const teacher_id = req.user.id;
    db.prepare('INSERT INTO grades (student_id, subject, score, date, teacher_id, component_id) VALUES (?, ?, ?, ?, ?, ?)').run(
      student_id, subject, score, date, teacher_id, component_id || null
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
      db.prepare('UPDATE grades SET score = ?, date = ?, component_id = ? WHERE id = ?').run(score, date, component_id, id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Grade Components
  app.get('/api/grade-components', authenticateToken, (req, res) => {
    const components = db.prepare('SELECT * FROM grade_components').all();
    res.json(components);
  });

  app.post('/api/grade-components', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { name, weight } = req.body;
    try {
      db.prepare('INSERT INTO grade_components (name, weight) VALUES (?, ?)').run(name, weight);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put('/api/grade-components/:id', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { id } = req.params;
    const { weight } = req.body;
    db.prepare('UPDATE grade_components SET weight = ? WHERE id = ?').run(weight, id);
    res.json({ success: true });
  });

  app.delete('/api/grade-components/:id', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { id } = req.params;
    try {
      db.prepare('DELETE FROM grade_components WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
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
    `).all() as any[];

    const weights = db.prepare('SELECT * FROM grade_components').all() as any[];
    const attendanceWeight = weights.find(w => w.name.toLowerCase() === 'attendance')?.weight || 0;

    const marklist = students.map(student => {
      const grades = db.prepare(`
        SELECT g.*, c.name as component_name, c.weight 
        FROM grades g 
        LEFT JOIN grade_components c ON g.component_id = c.id 
        WHERE g.student_id = ? AND g.subject = ?
      `).all(student.id, subject) as any[];

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
    if (!student && req.user.role === 'student') {
        // Handle student not in students table yet
    }

    db.prepare('INSERT INTO payments (student_id, amount, tx_ref, description, date) VALUES (?, ?, ?, ?, ?)').run(
      student?.id || null, amount, tx_ref, description, new Date().toISOString()
    );

    // Fetch Chapa API Key from settings
    const chapaKey = db.prepare('SELECT value FROM settings WHERE key = ?').get('chapa_api_key')?.value;
    
    if (!chapaKey) {
      console.warn('Chapa API Key not configured in settings. Using mock flow.');
    }

    // Real Chapa Integration would go here using chapaKey
    // For now, return a mock checkout URL
    res.json({
      status: 'success',
      data: {
        checkout_url: `https://test.chapa.co/checkout-now/${tx_ref}`
      }
    });
  });

  app.get('/api/payments/verify/:tx_ref', authenticateToken, (req, res) => {
    const { tx_ref } = req.params;
    // Mock verification
    db.prepare('UPDATE payments SET status = ? WHERE tx_ref = ?').run('success', tx_ref);
    res.json({ status: 'success', message: 'Payment verified' });
  });

  // Messaging
  app.get('/api/messages', authenticateToken, (req: any, res) => {
    const userId = req.user.id;
    const messages = db.prepare(`
      SELECT m.*, u1.full_name as sender_name, u2.full_name as receiver_name 
      FROM messages m 
      JOIN users u1 ON m.sender_id = u1.id 
      JOIN users u2 ON m.receiver_id = u2.id 
      WHERE m.sender_id = ? OR m.receiver_id = ?
      ORDER BY m.timestamp DESC
    `).all(userId, userId);
    res.json(messages);
  });

  app.post('/api/messages', authenticateToken, (req: any, res) => {
    const { receiver_id, content } = req.body;
    const sender_id = req.user.id;
    db.prepare('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)')
      .run(sender_id, receiver_id, content);
    res.json({ success: true });
  });

  // Settings
  app.get('/api/settings', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const settings = db.prepare('SELECT * FROM settings').all();
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
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('chapa_api_key', chapa_api_key);
    }
    res.json({ success: true });
  });

  // Analytics/Reports
  app.get('/api/reports/summary', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    
    const totalStudents = db.prepare('SELECT COUNT(*) as count FROM students').get().count;
    const totalTeachers = db.prepare("SELECT COUNT(*) as count FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'teacher'").get().count;
    const totalRevenue = db.prepare("SELECT SUM(amount) as total FROM payments WHERE status = 'success'").get().total || 0;
    const averageGrade = db.prepare('SELECT AVG(score) as avg FROM grades').get().avg || 0;

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
