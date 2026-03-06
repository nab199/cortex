export class AIService {
    static async getStudentPerformanceInsights(studentDetails: any) {
        try {
            const prompt = `Analyze the following student performance data for Cortex Management System:\nStudent: ${studentDetails.name}\nGrades: ${JSON.stringify(studentDetails.grades)}\nAttendance: ${JSON.stringify(studentDetails.attendance)}\n\nProvide a concise (3-4 sentences) professional analysis of their performance, highlighting strengths or areas for improvement, and a summary of their attendance consistency. Format it for display on a dashboard.`;

            const response = await fetch('/api/ai/insights', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
                console.error('AI Service HTTP Error:', response.statusText);
                return "Error generating AI insights. Please try again later.";
            }

            const { text } = await response.json();
            return text;
        } catch (error: any) {
            console.error('AI Service Error:', error?.message || error);
            return "Error generating AI insights. Please try again later.";
        }
    }
}
