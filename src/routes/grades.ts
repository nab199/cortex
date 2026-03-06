import { Router } from 'express';
import { pool, logger, paginate } from '../db/pool.ts';
import { authenticateToken } from '../middleware/auth.ts';

const router = Router();

// GET /api/grades
router.get('/grades', authenticateToken, async (req: any, res) => {
  const { student_id, page, limit } = req.query;
  try {
    // determine visible student ids for student/parent roles
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
      SELECT g.*, u.full_name as student_name
      FROM grades g
      JOIN students s ON g.student_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE 1=1
    `;
    let params: any[] = [];

    // super_admin sees all schools, others see only their school
    if (req.user.role !== 'super_admin') {
      query += ` AND g.school_id = $${params.length + 1}`;
      params.push(req.user.school_id);
    }

    if (req.user.role === 'teacher') {
      query += ` AND g.teacher_id = $${params.length + 1}`;
      params.push(req.user.id);
    } else if (visibleIds) {
      query += ` AND g.student_id = ANY($${params.length + 1})`;
      params.push(visibleIds);
    }

    if (student_id) {
      query += ` AND g.student_id = $${params.length + 1}`;
      params.push(student_id);
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
    logger.error('Error fetching grades', err);
    res.status(500).json({ error: 'Failed to fetch grades' });
  }
});

// POST /api/grades
router.post('/grades', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.sendStatus(403);
  const { student_id, subject, score, date, component_id, school_id } = req.body;
  const teacher_id = req.user.id;
  const targetSchoolId = school_id || req.user.school_id;
  
  // Regular admins/teachers can only record grades in their school
  if (req.user.role !== 'super_admin' && school_id && school_id !== req.user.school_id) {
    return res.status(403).json({ error: 'Cannot record grades outside your school' });
  }
  
  try {
    await pool.query('INSERT INTO grades (student_id, subject, score, date, teacher_id, component_id, school_id) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
      student_id, subject, score, date, teacher_id, component_id || null, targetSchoolId
    ]);

    // Notification Logic (Mock Afro Message)
    if (score < 50) {
      logger.info(`Low grade alert for student ${student_id} in ${subject}: ${score}`);
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('Error posting grade', err);
    res.status(500).json({ error: 'Failed to record grade' });
  }
});

// PUT /api/grades/:id
router.put('/grades/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.sendStatus(403);
  const { id } = req.params;
  const { score, date, component_id } = req.body;
  
  let query = 'UPDATE grades SET score = $1, date = $2, component_id = $3 WHERE id = $4';
  let params: any[] = [score, date, component_id, id];
  
  // Regular admins/teachers can only update grades in their school
  if (req.user.role !== 'super_admin') {
    query += ` AND school_id = $${params.length + 1}`;
    params.push(req.user.school_id);
  }
  
  try {
    await pool.query(query, params);
    res.json({ success: true });
  } catch (e: any) {
    logger.error('Error updating grade', e);
    res.status(400).json({ error: 'Failed to update grade' });
  }
});

// GET /api/grade-components
router.get('/grade-components', authenticateToken, async (req: any, res) => {
  try {
    const { page, limit } = req.query;
    let query = 'SELECT * FROM grade_components WHERE school_id = $1';
    let params: any[] = [req.user.school_id];

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
    logger.error('Error fetching grade components', err);
    res.status(500).json({ error: 'Failed to fetch components' });
  }
});

// POST /api/grade-components
router.post('/grade-components', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const { name, weight } = req.body;
  try {
    await pool.query('INSERT INTO grade_components (name, weight, school_id) VALUES ($1, $2, $3)', [name, weight, req.user.school_id]);
    res.json({ success: true });
  } catch (e: any) {
    logger.error('Error adding grade component', e);
    res.status(400).json({ error: 'Failed to add component' });
  }
});

// PUT /api/grade-components/:id
router.put('/grade-components/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const { id } = req.params;
  const { weight } = req.body;
  try {
    await pool.query('UPDATE grade_components SET weight = $1 WHERE id = $2 AND school_id = $3', [weight, id, req.user.school_id]);
    res.json({ success: true });
  } catch (err) {
    logger.error('Error updating grade component', err);
    res.status(500).json({ error: 'Failed to update component' });
  }
});

// DELETE /api/grade-components/:id
router.delete('/grade-components/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM grade_components WHERE id = $1 AND school_id = $2', [id, req.user.school_id]);
    res.json({ success: true });
  } catch (e: any) {
    logger.error('Error deleting grade component', e);
    res.status(400).json({ error: 'Failed to delete component' });
  }
});

// GET /api/marklist
router.get('/marklist', authenticateToken, async (req: any, res) => {
  const { subject } = req.query;
  if (!subject) return res.status(400).json({ error: 'Subject is required' });

  try {
    // 1. Get all students in the school
    const studentRes = await pool.query(
      `SELECT s.id, u.full_name FROM students s
       JOIN users u ON s.user_id = u.id
       WHERE u.school_id = $1`,
      [req.user.school_id]
    );
    const students = studentRes.rows;
    const studentIds = students.map((s: any) => s.id);
    if (studentIds.length === 0) return res.json([]);

    // 2. Get ALL grades for this subject in one query
    const gradeRes = await pool.query(
      `SELECT g.*, c.name as component_name, c.weight
       FROM grades g
       LEFT JOIN grade_components c ON g.component_id = c.id
       WHERE g.student_id = ANY($1) AND g.subject = $2 AND g.school_id = $3`,
      [studentIds, subject, req.user.school_id]
    );

    // 3. Get ALL attendance in one query
    const attendanceRes = await pool.query(
      `SELECT student_id, status FROM attendance
       WHERE student_id = ANY($1)`,
      [studentIds]
    );

    // 4. Get grade component weights
    const weightRes = await pool.query(
      'SELECT * FROM grade_components WHERE school_id = $1',
      [req.user.school_id]
    );
    const weights = weightRes.rows;
    const attendanceWeight = weights.find((w: any) => w.name.toLowerCase() === 'attendance')?.weight || 0;

    // 5. Group data by student in JavaScript (no more DB calls in a loop)
    const gradesByStudent = gradeRes.rows.reduce((acc: any, g) => {
      (acc[g.student_id] ||= []).push(g);
      return acc;
    }, {});

    const attendanceByStudent = attendanceRes.rows.reduce((acc: any, a) => {
      (acc[a.student_id] ||= []).push(a);
      return acc;
    }, {});

    // 6. Calculate scores
    const marklist = students.map((student: any) => {
      const grades = gradesByStudent[student.id] || [];
      const attendance = attendanceByStudent[student.id] || [];

      let weightedSum = 0, totalWeightUsed = 0;
      const componentAverages: any = {};

      weights.forEach((w: any) => {
        if (w.name.toLowerCase() === 'attendance') return;
        const compGrades = grades.filter((g: any) => g.component_id === w.id);
        const avg = compGrades.length > 0
          ? compGrades.reduce((sum: number, g: any) => sum + g.score, 0) / compGrades.length
          : 0;
        componentAverages[w.name] = avg;
        weightedSum += avg * w.weight;
        totalWeightUsed += w.weight;
      });

      const presentCount = attendance.filter((a: any) => a.status === 'present').length;
      const attendanceScore = attendance.length > 0 ? (presentCount / attendance.length) * 100 : 0;
      componentAverages['Attendance'] = attendanceScore;
      weightedSum += attendanceScore * attendanceWeight;
      totalWeightUsed += attendanceWeight;

      return {
        student_id: student.id,
        student_name: student.full_name,
        averages: componentAverages,
        finalAverage: parseFloat((totalWeightUsed > 0 ? weightedSum / totalWeightUsed : 0).toFixed(2))
      };
    });

    // 7. Add ranks
    const sorted = [...marklist].sort((a, b) => b.finalAverage - a.finalAverage);
    const finalMarklist = marklist.map((item: any) => ({
      ...item,
      rank: sorted.findIndex((s: any) => s.student_id === item.student_id) + 1
    }));

    res.json(finalMarklist);
  } catch (err) {
    logger.error('Marklist calculation error', err);
    res.status(500).json({ error: 'Failed to calculate marklist' });
  }
});

export default router;
