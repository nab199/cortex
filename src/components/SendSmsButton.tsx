import React, { useState } from 'react';
import { sendFeeReminder } from '../services/api';
import { Button } from './UI';

export default function SendSmsButton({ to, studentName, amount }: { to: string, studentName: string, amount: number }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await sendFeeReminder(to, studentName, amount);
      alert('Fee reminder sent successfully');
    } catch (err: any) {
      console.error('Failed to send fee reminder', err);
      alert('Failed to send fee reminder: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleClick} disabled={loading} variant="secondary" className="flex items-center gap-2">
      {loading ? 'Sending...' : 'Send Fee Reminder'}
    </Button>
  );
}
