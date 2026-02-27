import { Router } from 'express';
import { SMSService } from '../services/SMSService';

const router = Router();

router.post('/send-fee-reminder', async (req: any, res: any) => {
  const { to, studentName, amount } = req.body;
  if (!to || !studentName || amount === undefined) {
    return res.status(400).json({ error: 'Missing required fields: to, studentName, amount' });
  }

  try {
    const result = await SMSService.sendFeeReminder(to, studentName, Number(amount));
    res.json({ success: true, result });
  } catch (err: any) {
    console.error('SMS route error (fee reminder):', err?.response?.data || err?.message || err);
    res.status(500).json({ error: 'Failed to send SMS' });
  }
});

router.post('/send-absence-alert', async (req: any, res: any) => {
  const { to, studentName, date } = req.body;
  if (!to || !studentName || !date) {
    return res.status(400).json({ error: 'Missing required fields: to, studentName, date' });
  }

  try {
    const result = await SMSService.sendAbsenceAlert(to, studentName, date);
    res.json({ success: true, result });
  } catch (err: any) {
    console.error('SMS route error (absence alert):', err?.response?.data || err?.message || err);
    res.status(500).json({ error: 'Failed to send SMS' });
  }
});

export default router;
