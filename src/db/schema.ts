import bcrypt from 'bcryptjs';
import { pool, logger } from './pool.ts';

export const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schools (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role_id INTEGER REFERENCES roles(id),
      email TEXT UNIQUE,
      phone TEXT,
      school_id INTEGER REFERENCES schools(id)
    );

    CREATE TABLE IF NOT EXISTS students (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id),
      parent_id INTEGER REFERENCES users(id),
      grade_level TEXT
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id),
      subject TEXT
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      student_id INTEGER REFERENCES students(id),
      date TEXT NOT NULL,
      status TEXT CHECK(status IN ('present', 'absent', 'late')) NOT NULL,
      teacher_id INTEGER REFERENCES users(id),
      school_id INTEGER REFERENCES schools(id),
      UNIQUE(student_id, date)
    );

    CREATE TABLE IF NOT EXISTS grade_components (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      weight REAL NOT NULL DEFAULT 0.0,
      school_id INTEGER REFERENCES schools(id),
      UNIQUE(name, school_id)
    );

    CREATE TABLE IF NOT EXISTS grades (
      id SERIAL PRIMARY KEY,
      student_id INTEGER REFERENCES students(id),
      subject TEXT NOT NULL,
      score REAL NOT NULL,
      date TEXT NOT NULL,
      teacher_id INTEGER REFERENCES users(id),
      component_id INTEGER REFERENCES grade_components(id),
      school_id INTEGER REFERENCES schools(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      student_id INTEGER REFERENCES students(id),
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'ETB',
      status TEXT DEFAULT 'pending',
      tx_ref TEXT UNIQUE,
      description TEXT,
      date TEXT NOT NULL,
      school_id INTEGER REFERENCES schools(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER REFERENCES users(id),
      receiver_id INTEGER REFERENCES users(id),
      content TEXT NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      school_id INTEGER REFERENCES schools(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT NOT NULL,
      value TEXT,
      school_id INTEGER REFERENCES schools(id),
      PRIMARY KEY (key, school_id)
    );

    CREATE TABLE IF NOT EXISTS fee_types (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      school_id INTEGER REFERENCES schools(id)
    );

    CREATE TABLE IF NOT EXISTS student_balances (
      id SERIAL PRIMARY KEY,
      student_id INTEGER REFERENCES students(id),
      fee_type_id INTEGER REFERENCES fee_types(id),
      amount_paid REAL DEFAULT 0,
      status TEXT DEFAULT 'unpaid' CHECK(status IN ('unpaid', 'partial', 'paid')),
      school_id INTEGER REFERENCES schools(id)
    );

    CREATE TABLE IF NOT EXISTS action_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id INTEGER,
      school_id INTEGER REFERENCES schools(id),
      details JSONB,
      ip_address TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'success' CHECK(status IN ('success', 'failed'))
    );

    CREATE INDEX IF NOT EXISTS action_logs_user_id_idx ON action_logs(user_id);
    CREATE INDEX IF NOT EXISTS action_logs_timestamp_idx ON action_logs(timestamp);
    CREATE INDEX IF NOT EXISTS action_logs_school_id_idx ON action_logs(school_id);
  `);

  // Seed Roles
  const roles = ['super_admin', 'admin', 'teacher', 'student', 'parent'];
  for (const role of roles) {
    await pool.query('INSERT INTO roles (name) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = $1)', [role]);
  }

  // Seed Default School
  let defaultSchoolId: number;
  const schoolRes = await pool.query('SELECT id FROM schools WHERE name = $1', ['Default School']);
  if (schoolRes.rows.length === 0) {
    const insertSchool = await pool.query('INSERT INTO schools (name) VALUES ($1) RETURNING id', ['Default School']);
    defaultSchoolId = insertSchool.rows[0].id;
  } else {
    defaultSchoolId = schoolRes.rows[0].id;
  }

  // Seed Super Admin
  const superAdminRes = await pool.query('SELECT id FROM users WHERE username = $1', ['superadmin']);
  if (superAdminRes.rows.length === 0) {
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@2026';
    const hashedPassword = bcrypt.hashSync(superAdminPassword, 10);
    const roleRes = await pool.query('SELECT id FROM roles WHERE name = $1', ['super_admin']);
    const superAdminRoleId = roleRes.rows[0].id;
    await pool.query('INSERT INTO users (username, password, full_name, role_id, email, school_id) VALUES ($1, $2, $3, $4, $5, $6)', [
      'superadmin', hashedPassword, 'Super Administrator', superAdminRoleId, 'superadmin@edufinance.com', defaultSchoolId
    ]);
  }

  // Seed Admin
  const adminRes = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);
  if (adminRes.rows.length === 0) {
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'ChangeMe@2026';
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);
    const roleRes = await pool.query('SELECT id FROM roles WHERE name = $1', ['admin']);
    const adminRoleId = roleRes.rows[0].id;
    await pool.query('INSERT INTO users (username, password, full_name, role_id, email, school_id) VALUES ($1, $2, $3, $4, $5, $6)', [
      'admin', hashedPassword, 'System Administrator', adminRoleId, 'admin@school.com', defaultSchoolId
    ]);
  }

  logger.info('Database initialized and seeded.');
};
