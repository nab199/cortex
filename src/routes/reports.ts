import { Router } from 'express';
import { pool, logger } from '../db/pool.ts';
import { authenticateToken } from '../middleware/auth.ts';

const router = Router();

// GET /api/reports/summary
router.get('/summary', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);

  const sid = req.user.school_id;
  try {
    const studentRes = await pool.query('SELECT COUNT(*) as count FROM students s JOIN users u ON s.user_id = u.id WHERE u.school_id = $1', [sid]);
    const teacherRes = await pool.query("SELECT COUNT(*) as count FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'teacher' AND u.school_id = $1", [sid]);
    const revenueRes = await pool.query("SELECT SUM(amount) as total FROM payments WHERE status = 'success' AND school_id = $1", [sid]);
    const gradeRes = await pool.query('SELECT AVG(score) as avg FROM grades WHERE school_id = $1', [sid]);

    res.json({
      totalStudents: parseInt(studentRes.rows[0].count),
      totalTeachers: parseInt(teacherRes.rows[0].count),
      totalRevenue: parseFloat(revenueRes.rows[0].total || 0),
      averageGrade: parseFloat(gradeRes.rows[0].avg || 0)
    });
  } catch (err) {
    logger.error('Error generating report summary', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

export default router;
