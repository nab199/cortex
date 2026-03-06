import { Router } from 'express';
import { pool, logger } from '../db/pool.ts';
import { authenticateToken } from '../middleware/auth.ts';

const router = Router();

// GET /api/settings
router.get('/', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  try {
    const result = await pool.query('SELECT * FROM settings WHERE school_id = $1', [req.user.school_id]);
    const settingsMap = result.rows.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    res.json(settingsMap);
  } catch (err) {
    logger.error('Error fetching settings', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// POST /api/settings
router.post('/', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const { chapa_api_key } = req.body;
  try {
    if (chapa_api_key !== undefined) {
      await pool.query(`
        INSERT INTO settings (key, value, school_id) 
        VALUES ($1, $2, $3) 
        ON CONFLICT (key, school_id) DO UPDATE SET value = EXCLUDED.value
      `, ['chapa_api_key', chapa_api_key, req.user.school_id]);
    }
    res.json({ success: true });
  } catch (err) {
    logger.error('Error updating settings', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
