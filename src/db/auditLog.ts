import { pool, logger } from './pool.ts';

export interface ActionLogEntry {
  user_id: number;
  action: string;
  resource_type: string;
  resource_id?: number;
  school_id?: number;
  details?: Record<string, any>;
  ip_address?: string;
  status?: 'success' | 'failed';
}

/**
 * Log an action for compliance and audit purposes
 * @param entry Action log entry
 */
export const logAction = async (entry: ActionLogEntry) => {
  try {
    await pool.query(
      `INSERT INTO action_logs (user_id, action, resource_type, resource_id, school_id, details, ip_address, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        entry.user_id,
        entry.action,
        entry.resource_type,
        entry.resource_id || null,
        entry.school_id || null,
        entry.details ? JSON.stringify(entry.details) : null,
        entry.ip_address || null,
        entry.status || 'success'
      ]
    );
  } catch (err) {
    logger.error('Failed to log action', err);
  }
};

/**
 * Get action logs with filtering
 */
export const getActionLogs = async (
  userId?: number,
  schoolId?: number,
  resourceType?: string,
  limit: number = 100,
  offset: number = 0
) => {
  let query = 'SELECT * FROM action_logs WHERE 1=1';
  let params: any[] = [];

  if (userId) {
    params.push(userId);
    query += ` AND user_id = $${params.length}`;
  }
  if (schoolId) {
    params.push(schoolId);
    query += ` AND school_id = $${params.length}`;
  }
  if (resourceType) {
    params.push(resourceType);
    query += ` AND resource_type = $${params.length}`;
  }

  query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  return pool.query(query, params);
};

/**
 * Get audit summary for a school or all schools
 */
export const getAuditSummary = async (schoolId?: number) => {
  let query = `
    SELECT
      action,
      COUNT(*) as count,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
      MAX(timestamp) as latest
    FROM action_logs
    WHERE 1=1
  `;
  let params: any[] = [];

  if (schoolId) {
    params.push(schoolId);
    query += ` AND school_id = $${params.length}`;
  }

  query += ` GROUP BY action ORDER BY MAX(timestamp) DESC`;

  return pool.query(query, params);
};
