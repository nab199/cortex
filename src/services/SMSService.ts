import axios from 'axios';

const AFRO_API_KEY = process.env.AFRO_MESSAGE_API_KEY;
const AFRO_SENDER_ID = process.env.AFRO_MESSAGE_SENDER_ID;
const AFRO_URL = 'https://api.afromessage.com/api/send';

export class SMSService {
    static async sendSMS(to: string, message: string) {
        if (!AFRO_API_KEY || !AFRO_SENDER_ID) {
            console.warn('SMS Warning: Missing Afro Message credentials. Skipping SMS.');
            return;
        }

        try {
            const response = await axios.get(AFRO_URL, {
                params: {
                    from: AFRO_SENDER_ID,
                    sender: AFRO_SENDER_ID,
                    to: to,
                    message: message,
                },
                headers: {
                    'Authorization': `Bearer ${AFRO_API_KEY}`
                }
            });
            return response.data;
        } catch (error: any) {
            console.error('SMS Error:', error.response?.data || error.message);
            throw error;
        }
    }

    static async sendFeeReminder(to: string, studentName: string, amount: number) {
        const message = `Dear Parent, this is a reminder that ${studentName} has an outstanding balance of ${amount} ETB at Cortex School. Please settle at your earliest convenience.`;
        return this.sendSMS(to, message);
    }

    static async sendAbsenceAlert(to: string, studentName: string, date: string) {
        const message = `Cortex Alert: ${studentName} was marked ABSENT today, ${date}. Please contact the school for any concerns.`;
        return this.sendSMS(to, message);
    }
}
