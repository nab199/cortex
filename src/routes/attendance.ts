import { Router } from 'express';
import { pool, logger, paginate } from '../db/pool.ts';
import { authenticateToken } from '../middleware/auth.ts';

const router = Router();

// GET /api/attendance
router.get('/', authenticateToken, async (req: any, res) => {
  const { student_id, date, page, limit } = req.query;
  try {
    // Pre-compute visible student IDs for student/parent roles
    let visibleIds: number[] | null = null;
    if (req.user.role === 'student' || req.user.role === 'parent') {
      const idQuery = req.user.role === 'student'
        ? 'SELECT id FROM students WHERE user_id = $1'
        : 'SELECT id FROM students WHERE parent_id = $1';
      const rows = await pool.query(idQuery, [req.user.id]);
      visibleIds = rows.rows.map((r: any) => r.id);
      if (visibleIds.length === 0) return res.json({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    }

    let query = `
      SELECT a.*, u.full_name as student_name
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE 1=1
    `;
    let params: any[] = [];

    // super_admin sees all schools, others see only their school
    if (req.user.role !== 'super_admin') {
      query += ` AND a.school_id = $${params.length + 1}`;
      params.push(req.user.school_id);
    }

    if (req.user.role === 'teacher') {
      query += ` AND a.teacher_id = $${params.length + 1}`;
      params.push(req.user.id);
    } else if (visibleIds) {
      query += ` AND a.student_id = ANY($${params.length + 1})`;
      params.push(visibleIds);
    }

    if (student_id) {
      query += ` AND a.student_id = $${params.length + 1}`;
      params.push(student_id);
    }
    if (date) {
      query += ` AND a.date = $${params.length + 1}`;
      params.push(date);
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
    logger.error('Error fetching attendance', err);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// POST /api/attendance (upsert)
router.post('/', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.sendStatus(403);
  const { student_id, date, status } = req.body;
  try {
    await pool.query(`
      INSERT INTO attendance (student_id, date, status, teacher_id, school_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (student_id, date)
      DO UPDATE SET status = EXCLUDED.status, teacher_id = EXCLUDED.teacher_id
    `, [student_id, date, status, req.user.id, req.user.school_id]);
    res.json({ success: true });
  } catch (err) {
    logger.error('Error posting attendance', err);
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

export default router;
