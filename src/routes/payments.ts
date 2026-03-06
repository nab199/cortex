import { Router } from 'express';
import axios from 'axios';
import { pool, logger, paginate } from '../db/pool.ts';
import { authenticateToken } from '../middleware/auth.ts';

const router = Router();

// POST /api/payments/initialize
router.post('/payments/initialize', authenticateToken, async (req: any, res) => {
  const { amount, email, first_name, last_name, description } = req.body;
  const tx_ref = `tx-${Date.now()}`;

  try {
    // Save pending payment to DB
    const studentRes = await pool.query('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
    const student = studentRes.rows[0];

    await pool.query('INSERT INTO payments (student_id, amount, tx_ref, description, date, school_id) VALUES ($1, $2, $3, $4, $5, $6)', [
      student?.id || null, amount, tx_ref, description, new Date().toISOString(), req.user.school_id
    ]);

    // Fetch Chapa API Key from settings
    const settingsRes = await pool.query('SELECT value FROM settings WHERE key = $1 AND school_id = $2', ['chapa_api_key', req.user.school_id]);
    const chapaKey = settingsRes.rows[0]?.value;

    if (!chapaKey) {
      logger.info('Chapa API Key not configured. Using mock checkout.');
      return res.json({
        status: 'success',
        data: {
          checkout_url: `https://test.chapa.co/checkout-now/${tx_ref}`
        }
      });
    }

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

// GET /api/payments/verify/:tx_ref
router.get('/payments/verify/:tx_ref', authenticateToken, async (req: any, res) => {
  const { tx_ref } = req.params;
  try {
    const settingsRes = await pool.query('SELECT value FROM settings WHERE key = $1 AND school_id = $2', ['chapa_api_key', req.user.school_id]);
    const chapaKey = settingsRes.rows[0]?.value;

    if (!chapaKey) {
      // Mock verification
      await pool.query('UPDATE payments SET status = $1 WHERE tx_ref = $2', ['success', tx_ref]);
      return res.json({ status: 'success', message: 'Mock payment verified' });
    }

    const response = await axios.get(`https://api.chapa.co/v1/transaction/verify/${tx_ref}`, {
      headers: { Authorization: `Bearer ${chapaKey}` }
    });

    if (response.data.status === 'success') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('UPDATE payments SET status = $1 WHERE tx_ref = $2 AND school_id = $3', ['success', tx_ref, req.user.school_id]);

        // Update student balance if applicable
        const payRes = await client.query('SELECT * FROM payments WHERE tx_ref = $1', [tx_ref]);
        const payment = payRes.rows[0];

        if (payment && payment.student_id) {
          // Find the most recent unpaid balance (simple logic for now)
          const balRes = await client.query('SELECT * FROM student_balances WHERE student_id = $1 AND status != $2 AND school_id = $3 LIMIT 1', [
            payment.student_id, 'paid', req.user.school_id
          ]);
          const balance = balRes.rows[0];

          if (balance) {
            const newAmountPaid = (balance.amount_paid || 0) + payment.amount;
            const ftRes = await client.query('SELECT amount FROM fee_types WHERE id = $1', [balance.fee_type_id]);
            const feeType = ftRes.rows[0];
            const newStatus = newAmountPaid >= feeType.amount ? 'paid' : 'partial';

            await client.query('UPDATE student_balances SET amount_paid = $1, status = $2 WHERE id = $3', [
              newAmountPaid, newStatus, balance.id
            ]);
          }
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
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

// GET /api/fee-types
router.get('/fee-types', authenticateToken, async (req: any, res) => {
  try {
    const { page, limit } = req.query;
    let query = 'SELECT * FROM fee_types WHERE school_id = $1';
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
    logger.error('Error fetching fee types', err);
    res.status(500).json({ error: 'Failed to fetch fee types' });
  }
});

// POST /api/fee-types
router.post('/fee-types', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const { name, amount } = req.body;
  try {
    await pool.query('INSERT INTO fee_types (name, amount, school_id) VALUES ($1, $2, $3)', [name, amount, req.user.school_id]);
    res.json({ success: true });
  } catch (err) {
    logger.error('Error adding fee type', err);
    res.status(500).json({ error: 'Failed to add fee type' });
  }
});

// GET /api/student-balances
router.get('/student-balances', authenticateToken, async (req: any, res) => {
  const sid = req.user.school_id;
  try {
    const { page, limit } = req.query;
    let query = `
      SELECT sb.*, ft.name as fee_name, ft.amount as total_amount, u.full_name as student_name
      FROM student_balances sb
      JOIN fee_types ft ON sb.fee_type_id = ft.id
      JOIN students s ON sb.student_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE sb.school_id = $1
    `;
    let params: any[] = [sid];

    if (req.user.role === 'student') {
      const studentRes = await pool.query('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
      const student = studentRes.rows[0];
      query += ` AND sb.student_id = $2`;
      params.push(student.id);
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
    logger.error('Error fetching student balances', err);
    res.status(500).json({ error: 'Failed to fetch balances' });
  }
});

export default router;
