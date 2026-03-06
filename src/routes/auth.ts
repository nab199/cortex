import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, logger } from '../db/pool.ts';
import { authenticateToken } from '../middleware/auth.ts';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    // Support both username and email login
    const result = await pool.query(`
      SELECT u.*, r.name as role 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.username = $1 OR u.email = $2
    `, [username, username]);

    const user = result.rows[0];

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
  } catch (err) {
    logger.error('Login error', err);
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
});

router.post('/signup', authenticateToken, async (req, res) => {
  // Only super_admin can create new schools and admins
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only super administrators can create new schools' });
  }
  
  const { email, password, full_name, school_name } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create School
    const schoolResult = await client.query('INSERT INTO schools (name) VALUES ($1) RETURNING id', [school_name]);
    const schoolId = schoolResult.rows[0].id;

    // 2. Create Admin User for this school
    const hashedPassword = bcrypt.hashSync(password, 10);
    const roleResult = await client.query('SELECT id FROM roles WHERE name = $1', ['admin']);
    const adminRoleId = roleResult.rows[0].id;

    // Use email as username for signup
    const userResult = await client.query('INSERT INTO users (username, password, full_name, role_id, email, school_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [
      email, hashedPassword, full_name, adminRoleId, email, schoolId
    ]);
    const userId = userResult.rows[0].id;

    await client.query('COMMIT');

    const token = jwt.sign(
      { id: userId, username: email, role: 'admin', school_id: schoolId },
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
        id: userId,
        username: email,
        role: 'admin',
        full_name,
        school_id: schoolId
      }
    });
  } catch (e: any) {
    await client.query('ROLLBACK');
    logger.error('Signup error', e);
    if (e.code === '23505') { // Unique constraint violation in Postgres
      res.status(400).json({ error: 'Email or School Name already exists' });
    } else {
      res.status(500).json({ error: 'An unexpected error occurred' });
    }
  } finally {
    client.release();
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

router.get('/me', authenticateToken, async (req: any, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.full_name, r.name as role, u.email, u.school_id
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error fetching user', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
