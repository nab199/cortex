const BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3001';

async function handleResponse(res: Response) {
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!res.ok) {
    const message = data?.error || data?.message || res.statusText || 'Request failed';
    throw new Error(message);
  }
  return data;
}

export async function sendFeeReminder(to: string, studentName: string, amount: number) {
  const resp = await fetch(`${BASE_URL}/api/sms/send-fee-reminder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ to, studentName, amount })
  });
  return handleResponse(resp);
}

export async function sendAbsenceAlert(to: string, studentName: string, date: string) {
  const resp = await fetch(`${BASE_URL}/api/sms/send-absence-alert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ to, studentName, date })
  });
  return handleResponse(resp);
}

export default { sendFeeReminder, sendAbsenceAlert };
