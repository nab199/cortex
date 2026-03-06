import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const pool = new Pool({
  connectionString: process.env.DB_URL,
});

// Simple Production Logger
export const logger = {
  info: (msg: string) => {
    const entry = `[${new Date().toISOString()}] INFO: ${msg}\n`;
    console.log(entry.trim());
    if (process.env.NODE_ENV === 'production') {
      try { path.join(__dirname, '..', '..', 'logs', 'app.log'); } catch (e) { } // For future use
    }
  },
  error: (msg: string, err?: any) => {
    const entry = `[${new Date().toISOString()}] ERROR: ${msg} ${err ? (err.stack || JSON.stringify(err)) : ''}\n`;
    console.error(entry.trim());
  }
};

// Pagination Helper
export const paginate = (query: string, params: any[], page: any, limit: any) => {
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;
  return {
    query: query + ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    params: [...params, limitNum, offset],
    pageNum,
    limitNum
  };
};
