import { GoogleGenerativeAI } from '@google/genai';

const API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

export class AIService {
    static async getStudentPerformanceInsights(studentDetails: any) {
        if (!API_KEY) {
            return "AI Insight Warning: GEMINI_API_KEY is not configured. Insights are unavailable.";
        }

        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            const prompt = `
        Analyze the following student performance data for Cortex Management System:
        Student: ${studentDetails.name}
        Grades: ${JSON.stringify(studentDetails.grades)}
        Attendance: ${JSON.stringify(studentDetails.attendance)}
        
        Provide a concise (3-4 sentences) professional analysis of their performance, 
        highlighting strengths or areas for improvement, and a summary of their attendance consistency.
        Format it for display on a dashboard.
      `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error: any) {
            console.error('AI Service Error:', error.message);
            return "Error generating AI insights. Please try again later.";
        }
    }
}
