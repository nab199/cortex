import { Router } from 'express';
import { pool, logger, paginate } from '../db/pool.ts';
import { authenticateToken } from '../middleware/auth.ts';
import { logAction, getActionLogs, getAuditSummary } from '../db/auditLog.ts';

const router = Router();

// GET /api/admin/schools - List all schools with counts (super_admin only)
router.get('/schools', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'super_admin') return res.sendStatus(403);
  
  try {
    const { page, limit } = req.query;
    const query = `
      SELECT 
        sch.id,
        sch.name,
        sch.created_at,
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT CASE WHEN r.name = 'student' THEN u.id END) as total_students,
        COUNT(DISTINCT CASE WHEN r.name = 'teacher' THEN u.id END) as total_teachers,
        COUNT(DISTINCT s.id) as total_students_enrolled
      FROM schools sch
      LEFT JOIN users u ON sch.id = u.school_id
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN students s ON u.id = s.user_id
      GROUP BY sch.id, sch.name, sch.created_at
      ORDER BY sch.created_at DESC
    `;
    
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM schools',
      []
    );
    const total = parseInt(countResult.rows[0].count);
    
    const p = paginate(query, [], page, limit);
    const result = await pool.query(p.query, p.params);
    
    res.json({
      data: result.rows,
      pagination: { page: p.pageNum, limit: p.limitNum, total, totalPages: Math.ceil(total / p.limitNum) }
    });
  } catch (err) {
    logger.error('Error fetching schools', err);
    res.status(500).json({ error: 'Failed to fetch schools' });
  }
});

// GET /api/admin/schools/overview - Cross-school dashboard (super_admin only)
router.get('/schools/overview', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'super_admin') return res.sendStatus(403);
  
  try {
    // Total schools
    const schoolsResult = await pool.query('SELECT COUNT(*) as count FROM schools', []);
    const totalSchools = parseInt(schoolsResult.rows[0].count);
    
    // Total users across all schools
    const usersResult = await pool.query('SELECT COUNT(*) as count FROM users WHERE username != $1', ['admin']);
    const totalUsers = parseInt(usersResult.rows[0].count);
    
    // Total students across all schools
    const studentsResult = await pool.query('SELECT COUNT(*) as count FROM students', []);
    const totalStudents = parseInt(studentsResult.rows[0].count);
    
    // Total teachers across all schools
    const teachersResult = await pool.query(`
      SELECT COUNT(DISTINCT t.user_id) as count
      FROM teachers t
    `, []);
    const totalTeachers = parseInt(teachersResult.rows[0].count);
    
    // Total attendance records
    const attendanceResult = await pool.query('SELECT COUNT(*) as count FROM attendance', []);
    const totalAttendance = parseInt(attendanceResult.rows[0].count);
    
    // Total grades
    const gradesResult = await pool.query('SELECT COUNT(*) as count FROM grades', []);
    const totalGrades = parseInt(gradesResult.rows[0].count);
    
    // Total revenue from payments
    const paymentsResult = await pool.query(
      'SELECT SUM(amount) as total_amount FROM payments WHERE status = $1',
      ['success']
    );
    const totalRevenue = parseFloat(paymentsResult.rows[0].total_amount || 0);
    
    // Schools breakdown with stats
    const schoolsBreakdown = await pool.query(`
      SELECT 
        sch.id,
        sch.name,
        COUNT(DISTINCT u.id) as users,
        COUNT(DISTINCT s.id) as students,
        COUNT(DISTINCT t.id) as teachers,
        COUNT(DISTINCT a.id) as attendance_records,
        COUNT(DISTINCT g.id) as grade_records,
        COALESCE(SUM(CASE WHEN p.status = 'success' THEN p.amount ELSE 0 END), 0) as revenue
      FROM schools sch
      LEFT JOIN users u ON sch.id = u.school_id
      LEFT JOIN students s ON u.id = s.user_id
      LEFT JOIN teachers t ON u.id = t.user_id
      LEFT JOIN attendance a ON sch.id = a.school_id
      LEFT JOIN grades g ON sch.id = g.school_id
      LEFT JOIN payments p ON sch.id = p.school_id
      GROUP BY sch.id, sch.name
      ORDER BY revenue DESC
    `, []);
    
    // Recent activity (last 10 days) across all schools
    const recentActivity = await pool.query(`
      SELECT 
        'attendance' as type,
        COUNT(*) as count,
        MAX(date) as latest_date
      FROM attendance
      WHERE date >= CURRENT_DATE - INTERVAL '10 days'
      UNION ALL
      SELECT 
        'grades',
        COUNT(*),
        MAX(date)
      FROM grades
      WHERE date >= CURRENT_DATE - INTERVAL '10 days'
      UNION ALL
      SELECT 
        'payments',
        COUNT(*),
        MAX(date)
      FROM payments
      WHERE date >= CURRENT_DATE - INTERVAL '10 days'
    `, []);
    
    res.json({
      summary: {
        total_schools: totalSchools,
        total_users: totalUsers,
        total_students: totalStudents,
        total_teachers: totalTeachers,
        total_attendance_records: totalAttendance,
        total_grades: totalGrades,
        total_revenue: totalRevenue.toFixed(2)
      },
      schools_breakdown: schoolsBreakdown.rows.map(s => ({
        ...s,
        revenue: parseFloat(s.revenue)
      })),
      recent_activity: recentActivity.rows
    });
  } catch (err) {
    logger.error('Error fetching cross-school overview', err);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

// GET /api/admin/schools/:id - School details with all stats (super_admin)
router.get('/schools/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'super_admin') return res.sendStatus(403);
  
  const { id } = req.params;
  
  try {
    // School info
    const schoolRes = await pool.query(
      'SELECT * FROM schools WHERE id = $1',
      [id]
    );
    if (schoolRes.rows.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }
    const school = schoolRes.rows[0];
    
    // Users count by role
    const usersRes = await pool.query(`
      SELECT r.name as role, COUNT(*) as count
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.school_id = $1
      GROUP BY r.name
    `, [id]);
    
    // Grade components
    const componentsRes = await pool.query(`
      SELECT id, name, weight
      FROM grade_components
      WHERE school_id = $1
      ORDER BY name
    `, [id]);
    
    // Payment stats
    const paymentsRes = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(amount) as total
      FROM payments
      WHERE school_id = $1
      GROUP BY status
    `, [id]);
    
    // Recent students
    const recentStudentsRes = await pool.query(`
      SELECT u.id, u.full_name, s.grade_level
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE u.school_id = $1
      ORDER BY u.id DESC
      LIMIT 10
    `, [id]);
    
    res.json({
      school,
      users_by_role: usersRes.rows,
      grade_components: componentsRes.rows,
      payment_stats: paymentsRes.rows,
      recent_students: recentStudentsRes.rows
    });
  } catch (err) {
    logger.error('Error fetching school details', err);
    res.status(500).json({ error: 'Failed to fetch school details' });
  }
});

// GET /api/admin/grades/audit - Audit grades (super_admin only)
router.get('/grades/audit', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'super_admin') return res.sendStatus(403);
  
  try {
    const { subject, student_id, teacher_id, school_id, page, limit } = req.query;
    
    let query = `
      SELECT 
        g.id, g.student_id, g.subject, g.score, g.date,
        u_student.full_name as student_name,
        u_teacher.full_name as teacher_name,
        sc.name as school_name,
        g.created_at
      FROM grades g
      JOIN students s ON g.student_id = s.id
      JOIN users u_student ON s.user_id = u_student.id
      LEFT JOIN users u_teacher ON g.teacher_id = u_teacher.id
      LEFT JOIN schools sc ON g.school_id = sc.id
      WHERE 1=1
    `;
    let params: any[] = [];
    
    if (subject) {
      params.push(subject);
      query += ` AND g.subject = $${params.length}`;
    }
    if (student_id) {
      params.push(student_id);
      query += ` AND g.student_id = $${params.length}`;
    }
    if (teacher_id) {
      params.push(teacher_id);
      query += ` AND g.teacher_id = $${params.length}`;
    }
    if (school_id) {
      params.push(school_id);
      query += ` AND g.school_id = $${params.length}`;
    }
    
    query += ` ORDER BY g.date DESC`;
    
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
    logger.error('Error fetching grade audit', err);
    res.status(500).json({ error: 'Failed to fetch grade audit' });
  }
});

// DELETE /api/admin/grades/:id - Delete a grade (super_admin only, logged)
router.delete('/grades/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'super_admin') return res.sendStatus(403);
  
  const { id } = req.params;
  const { reason } = req.body;
  
  try {
    // Get grade details before deletion
    const gradeRes = await pool.query('SELECT * FROM grades WHERE id = $1', [id]);
    if (gradeRes.rows.length === 0) {
      return res.status(404).json({ error: 'Grade not found' });
    }
    const grade = gradeRes.rows[0];
    
    // Delete the grade
    await pool.query('DELETE FROM grades WHERE id = $1', [id]);
    
    // Log the action
    await logAction({
      user_id: req.user.id,
      action: 'delete_grade',
      resource_type: 'grade',
      resource_id: id,
      school_id: grade.school_id,
      details: {
        student_id: grade.student_id,
        subject: grade.subject,
        score: grade.score,
        reason: reason || 'No reason provided'
      },
      ip_address: req.ip || req.connection?.remoteAddress
    });
    
    res.json({ success: true, message: 'Grade deleted and logged' });
  } catch (err) {
    logger.error('Error deleting grade', err);
    
    // Log failure
    await logAction({
      user_id: req.user.id,
      action: 'delete_grade',
      resource_type: 'grade',
      resource_id: parseInt(id),
      details: { error: (err as Error).message },
      ip_address: req.ip || req.connection?.remoteAddress,
      status: 'failed'
    });
    
    res.status(500).json({ error: 'Failed to delete grade' });
  }
});

// GET /api/admin/action-logs - Retrieve action logs (super_admin only)
router.get('/action-logs', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'super_admin') return res.sendStatus(403);
  
  try {
    const { user_id, school_id, resource_type, days, page, limit } = req.query;
    const offset = ((parseInt(page) || 1) - 1) * (parseInt(limit) || 50);
    
    let query = 'SELECT * FROM action_logs WHERE 1=1';
    let params: any[] = [];
    
    if (user_id) {
      params.push(user_id);
      query += ` AND user_id = $${params.length}`;
    }
    if (school_id) {
      params.push(school_id);
      query += ` AND school_id = $${params.length}`;
    }
    if (resource_type) {
      params.push(resource_type);
      query += ` AND resource_type = $${params.length}`;
    }
    
    // Filter by days (default: last 30 days)
    const daysBack = parseInt(days) || 30;
    query += ` AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '${daysBack} days'`;
    
    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit) || 50, offset);
    
    const result = await pool.query(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM action_logs WHERE 1=1';
    let countParams: any[] = [];
    if (user_id) {
      countParams.push(user_id);
      countQuery += ` AND user_id = $${countParams.length}`;
    }
    if (school_id) {
      countParams.push(school_id);
      countQuery += ` AND school_id = $${countParams.length}`;
    }
    if (resource_type) {
      countParams.push(resource_type);
      countQuery += ` AND resource_type = $${countParams.length}`;
    }
    countQuery += ` AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '${daysBack} days'`;
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);
    
    res.json({
      data: result.rows,
      pagination: {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50,
        total,
        totalPages: Math.ceil(total / (parseInt(limit) || 50))
      }
    });
  } catch (err) {
    logger.error('Error fetching action logs', err);
    res.status(500).json({ error: 'Failed to fetch action logs' });
  }
});

// GET /api/admin/audit/summary - Audit summary (super_admin only)
router.get('/audit/summary', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'super_admin') return res.sendStatus(403);
  
  try {
    const { school_id, days } = req.query;
    const daysBack = parseInt(days) || 30;
    
    let query = `
      SELECT
        action,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
        MAX(timestamp) as latest,
        COUNT(DISTINCT user_id) as unique_users
      FROM action_logs
      WHERE timestamp >= CURRENT_TIMESTAMP - INTERVAL '${daysBack} days'
    `;
    let params: any[] = [];
    
    if (school_id) {
      params.push(school_id);
      query += ` AND school_id = $${params.length}`;
    }
    
    query += ` GROUP BY action ORDER BY MAX(timestamp) DESC`;
    
    const result = await pool.query(query, params);
    
    res.json({
      summary: result.rows,
      period_days: daysBack
    });
  } catch (err) {
    logger.error('Error fetching audit summary', err);
    res.status(500).json({ error: 'Failed to fetch audit summary' });
  }
});

// POST /api/admin/attendance/delete - Delete attendance records (flagged as spam)
router.post('/attendance/delete', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'super_admin') return res.sendStatus(403);
  
  const { attendance_ids, reason } = req.body;
  
  if (!Array.isArray(attendance_ids) || attendance_ids.length === 0) {
    return res.status(400).json({ error: 'attendance_ids must be a non-empty array' });
  }
  
  try {
    // Get attendance details before deletion
    const attendanceRes = await pool.query(
      `SELECT * FROM attendance WHERE id = ANY($1)`,
      [attendance_ids]
    );
    const attendanceRecords = attendanceRes.rows;
    
    // Delete the records
    await pool.query('DELETE FROM attendance WHERE id = ANY($1)', [attendance_ids]);
    
    // Log the action
    await logAction({
      user_id: req.user.id,
      action: 'delete_attendance_batch',
      resource_type: 'attendance',
      details: {
        count: attendance_ids.length,
        reason: reason || 'Spam/invalid records',
        deleted_ids: attendance_ids
      },
      ip_address: req.ip || req.connection?.remoteAddress
    });
    
    res.json({ 
      success: true, 
      message: `${attendance_ids.length} attendance records deleted and logged` 
    });
  } catch (err) {
    logger.error('Error deleting attendance records', err);
    
    await logAction({
      user_id: req.user.id,
      action: 'delete_attendance_batch',
      resource_type: 'attendance',
      details: { 
        error: (err as Error).message,
        attempted_count: attendance_ids.length
      },
      ip_address: req.ip || req.connection?.remoteAddress,
      status: 'failed'
    });
    
    res.status(500).json({ error: 'Failed to delete attendance records' });
  }
});

export default router;
