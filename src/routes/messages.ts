import { Router } from 'express';
import { pool, logger, paginate } from '../db/pool.ts';
import { authenticateToken } from '../middleware/auth.ts';

const router = Router();

// GET /api/messages
router.get('/', authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  try {
    const { page, limit } = req.query;
    let query = `
      SELECT m.*, u1.full_name as sender_name, u2.full_name as receiver_name
      FROM messages m
      JOIN users u1 ON m.sender_id = u1.id
      JOIN users u2 ON m.receiver_id = u2.id
      WHERE (m.sender_id = $1 OR m.receiver_id = $2) AND m.school_id = $3
      ORDER BY m.timestamp DESC
    `;
    let params: any[] = [userId, userId, req.user.school_id];

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
    logger.error('Error fetching messages', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/messages
router.post('/', authenticateToken, async (req: any, res) => {
  const { receiver_id, content } = req.body;
  const sender_id = req.user.id;
  try {
    await pool.query('INSERT INTO messages (sender_id, receiver_id, content, school_id) VALUES ($1, $2, $3, $4)', [
      sender_id, receiver_id, content, req.user.school_id
    ]);
    res.json({ success: true });
  } catch (err) {
    logger.error('Error sending message', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
