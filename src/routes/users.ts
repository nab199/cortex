import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool, logger, paginate } from '../db/pool.ts';
import { authenticateToken } from '../middleware/auth.ts';

const router = Router();

// GET /api/users
router.get('/users', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.sendStatus(403);
  try {
    const { page, limit, role } = req.query;
    let query = `
      SELECT u.id, u.username, u.full_name, r.name as role, u.email, u.phone, u.school_id,
             s.grade_level, t.subject
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN students s ON u.id = s.user_id
      LEFT JOIN teachers t ON u.id = t.user_id
      WHERE 1=1
    `;
    let params: any[] = [];

    // Filter by role if provided
    if (role) {
      query += ` AND r.name = $${params.length + 1}`;
      params.push(role);
    }

    // super_admin sees all schools, regular admin sees only their school
    if (req.user.role !== 'super_admin') {
      query += ` AND u.school_id = $${params.length + 1}`;
      params.push(req.user.school_id);
    }

    const countResult = await pool.query(
      query.replace(/SELECT .* FROM/s, 'SELECT COUNT(*) FROM'),
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const p = paginate(query, params, page, limit);
    const result = await pool.query(p.query, p.params);
    res.json({
      data: result.rows,
      pagination: { page: p.pageNum, limit: p.limitNum, total, totalPages: Math.ceil(total / p.limitNum) }
    });
  } catch (err) {
    logger.error('Error fetching users', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/students
router.get('/students', authenticateToken, async (req: any, res) => {
  try {
    const { page, limit } = req.query;
    let query = `
      SELECT s.id, u.full_name, s.grade_level, u.username, u.email, u.school_id
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE 1=1
    `;
    let params: any[] = [];

    // Apply role-specific visibility filters
    if (req.user.role === 'super_admin') {
      // super_admin sees all students from all schools
    } else if (req.user.role === 'admin') {
      // regular admin sees only their school's students
      query += ` AND u.school_id = $${params.length + 1}`;
      params.push(req.user.school_id);
    } else if (req.user.role === 'teacher') {
      query += ` AND u.school_id = $${params.length + 1}`;
      params.push(req.user.school_id);
      query += ` AND (
        EXISTS (SELECT 1 FROM grades g WHERE g.student_id = s.id AND g.teacher_id = $${params.length + 1})
        OR
        EXISTS (SELECT 1 FROM attendance a WHERE a.student_id = s.id AND a.teacher_id = $${params.length + 1})
      )`;
      params.push(req.user.id);
    } else if (req.user.role === 'student') {
      query += ` AND s.user_id = $${params.length + 1}`;
      params.push(req.user.id);
    } else if (req.user.role === 'parent') {
      query += ` AND s.parent_id = $${params.length + 1}`;
      params.push(req.user.id);
    }

    const countResult = await pool.query(
      query.replace(/SELECT .* FROM/s, 'SELECT COUNT(*) FROM'),
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const p = paginate(query, params, page, limit);
    const result = await pool.query(p.query, p.params);
    res.json({
      data: result.rows,
      pagination: { page: p.pageNum, limit: p.limitNum, total, totalPages: Math.ceil(total / p.limitNum) }
    });
  } catch (err) {
    logger.error('Error fetching students', err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// POST /api/users
router.post('/users', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.sendStatus(403);
  const { username, password, full_name, role, email, phone, grade_level, subject, school_id } = req.body;

  // Determine target school_id
  let targetSchoolId = school_id || req.user.school_id;
  
  // Regular admins can only create users in their own school
  if (req.user.role === 'admin' && school_id && school_id !== req.user.school_id) {
    return res.status(403).json({ error: 'Admin can only create users in their own school' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const roleResult = await client.query('SELECT id FROM roles WHERE name = $1', [role]);
    if (roleResult.rows.length === 0) throw new Error('Role not found');
    const roleId = roleResult.rows[0].id;

    const hashedPassword = bcrypt.hashSync(password, 10);
    const userResult = await client.query('INSERT INTO users (username, password, full_name, role_id, email, phone, school_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id', [
      username, hashedPassword, full_name, roleId, email, phone, targetSchoolId
    ]);
    const userId = userResult.rows[0].id;

    if (role === 'student') {
      await client.query('INSERT INTO students (user_id, grade_level) VALUES ($1, $2)', [userId, grade_level]);
    } else if (role === 'teacher') {
      await client.query('INSERT INTO teachers (user_id, subject) VALUES ($1, $2)', [userId, subject]);
    }

    await client.query('COMMIT');
    res.json({ id: userId });
  } catch (e: any) {
    await client.query('ROLLBACK');
    logger.error('Failed to create user', e);
    res.status(400).json({ error: 'Failed to create user' });
  } finally {
    client.release();
  }
});

// DELETE /api/users/:id - Delete a user (admin/super_admin only)
router.delete('/users/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.sendStatus(403);
  }
  
  const { id } = req.params;
  const targetUserId = parseInt(id);
  
  // Prevent self-deletion
  if (targetUserId === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  
  // Regular admins can only delete users in their own school
  if (req.user.role === 'admin') {
    const targetUserRes = await pool.query('SELECT school_id, role_id FROM users WHERE id = $1', [targetUserId]);
    if (targetUserRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (targetUserRes.rows[0].school_id !== req.user.school_id) {
      return res.status(403).json({ error: 'Cannot delete users from other schools' });
    }
    // Prevent admin from deleting super_admin
    const roleRes = await pool.query('SELECT name FROM roles WHERE id = $1', [targetUserRes.rows[0].role_id]);
    if (roleRes.rows[0]?.name === 'super_admin') {
      return res.status(403).json({ error: 'Cannot delete super administrator' });
    }
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get user info for logging
    const userRes = await client.query('SELECT * FROM users WHERE id = $1', [targetUserId]);
    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    const userToDelete = userRes.rows[0];
    
    // Check if user is a teacher - delete from teachers table
    await client.query('DELETE FROM teachers WHERE user_id = $1', [targetUserId]);
    
    // Check if user is a student - delete from students table  
    await client.query('DELETE FROM students WHERE user_id = $1', [targetUserId]);
    
    // Delete the user
    await client.query('DELETE FROM users WHERE id = $1', [targetUserId]);
    
    await client.query('COMMIT');
    
    // Log the action
    logger.info(`User deleted: ${userToDelete.username} (ID: ${targetUserId}) by user ${req.user.id}`);
    
    res.json({ success: true, message: `User ${userToDelete.username} deleted successfully` });
  } catch (e: any) {
    await client.query('ROLLBACK');
    logger.error('Failed to delete user', e);
    res.status(500).json({ error: 'Failed to delete user' });
  } finally {
    client.release();
  }
});

export default router;
