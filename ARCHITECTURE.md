# Cortex EduFinance - Backend Architecture

## Overview

The backend has been refactored from a monolithic `server.ts` (~1000 lines) into a **modular, maintainable structure** with clear separation of concerns. This enables:

- ✅ **Easier testing** — each module can be tested independently
- ✅ **Better maintainability** — features are co-located 
- ✅ **Scalability** — new features can be added without touching core logic
- ✅ **Team collaboration** — developers can work on different modules without conflicts

---

## Directory Structure

```
src/
├── db/                          # Database layer
│   ├── pool.ts                  # PostgreSQL connection pool & logger
│   └── schema.ts                # Database initialization & schema
│
├── middleware/                  # Shared middleware
│   ├── auth.ts                  # JWT authentication
│   └── validate.ts              # Input validation schemas
│
├── routes/                      # API endpoints (organized by domain)
│   ├── auth.ts                  # POST /api/auth/login, /signup, /logout
│   ├── users.ts                 # GET /api/users, POST /api/users
│   ├── attendance.ts            # GET/POST /api/attendance
│   ├── grades.ts                # GET/POST/PUT /api/grades, GET /api/marklist
│   ├── payments.ts              # POST /api/payments/*, Chapa integration
│   ├── messages.ts              # GET/POST /api/messages
│   ├── settings.ts              # GET/PUT /api/settings
│   ├── reports.ts               # GET /api/reports/*
│   └── smsRoutes.ts             # SMS functionality
│
├── services/                    # Business logic & external APIs
│   ├── AIService.ts             # Gemini AI insights (via /api/ai/insights)
│   ├── InvoicingService.ts      # Invoice generation
│   ├── SMSService.ts            # SMS messaging
│   ├── offlineService.ts        # Offline sync
│   └── api.ts                   # HTTP client utilities
│
├── utils/                       # Helper utilities
│   └── safeLog.ts               # Secure logging
│
├── components/                  # React components (frontend)
├── App.tsx                      # Main React app
└── main.tsx                     # React entry point

server.ts                         # Main server entry point (lean, ~150 lines)
```

---

## Module Details

### 1. **Database Layer** (`src/db/`)

**pool.ts**
- Exports `pool`: PostgreSQL connection pool
- Exports `logger`: Production logger (console + file in production)
- Exports `paginate()`: Helper for pagination

**schema.ts**
- `initDB()`: Creates all tables on startup
- Handles role seeding (admin, teacher, student, parent)
- Handles default school & admin user creation

**Usage:**
```typescript
import { pool, logger } from '../db/pool.ts';
await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
logger.info('User logged in');
```

---

### 2. **Authentication Middleware** (`src/middleware/`)

**auth.ts**
- `authenticateToken()`: JWT validation middleware
- Reads token from cookies or Authorization header
- Attaches `req.user` (id, username, role, school_id)

**validate.ts**
- Input validation schemas using a validation library
- Schemas: `GradeSchema`, `AttendanceSchema`, `CreateUserSchema`

**Usage:**
```typescript
import { authenticateToken } from '../middleware/auth.ts';
app.get('/api/protected', authenticateToken, (req, res) => {
  console.log(req.user); // { id, username, role, school_id }
});
```

---

### 3. **Route Modules** (`src/routes/`)

Each route file is an Express `Router` that exports route handlers. The main `server.ts` imports and mounts them.

#### **auth.ts** — Authentication
- `POST /api/auth/login` — Login with username/email + password
- `POST /api/auth/signup` — Create school + admin user
- `POST /api/auth/logout` — Clear auth cookie

#### **users.ts** — User Management
- `GET /api/users` — List all users (admin only)
- `POST /api/users` — Create user (admin only)
- Role-based fields: `grade_level` for students, `subject` for teachers

#### **attendance.ts** — Attendance Tracking
- `GET /api/attendance` — List attendance (role-filtered)
  - **Admin**: all records
  - **Teacher**: only own records (teacher_id)
  - **Student**: only self
  - **Parent**: only child
- `POST /api/attendance` — Record attendance (teacher/admin)

#### **grades.ts** — Grades & Performance
- `GET /api/grades` — List grades (role-filtered, same as attendance)
- `POST /api/grades` — Record grade (teacher/admin)
- `PUT /api/grades/:id` — Edit grade (teacher/admin)
- `GET /api/grade-components` — Fetch grading components (weights)
- `POST/PUT/DELETE /api/grade-components` — Manage components (admin)
- **`GET /api/marklist`** — Calculate performance rankings
  - Aggregates grades + attendance for a subject
  - Returns ranked list with weighted averages
  - **Optimized**: Uses 3 queries total (not per-student)

#### **payments.ts** — Chapa Payment Integration
- `POST /api/payments/initialize` — Start payment transaction
- `GET /api/payments/verify/:tx_ref` — Verify & confirm payment
- Stores payments in DB with status tracking

#### **messages.ts** — Internal Messaging
- `GET /api/messages` — List conversations
- `POST /api/messages` — Send message

#### **settings.ts** — School Configuration
- `GET /api/settings` — Fetch settings (Chapa API key, SMS config, etc.)
- `PUT /api/settings` — Update settings (admin)

#### **reports.ts** — Analytics & Reports
- `GET /api/reports/*` — Various reports (attendance, performance, etc.)

#### **smsRoutes.ts** — SMS Notifications
- Routes for SMS sending and delivery confirmation

---

### 4. **Sync Endpoint** (in `server.ts`)
- `POST /api/sync` — Offline-first sync
  - Accepts batch of attendance/grade actions
  - Rejects data older than 4 hours
  - Idempotent inserts

---

### 5. **Main Server** (`server.ts`)

Orchestrates everything:
1. Initializes database
2. Sets up security (Helmet, rate limiting, CORS)
3. Mounts all route modules
4. Serves frontend (Vite in dev, static in prod)
5. Handles graceful shutdown

**Key Patterns:**
```typescript
// Import modular routes
import authRoutes from './src/routes/auth.ts';

// Mount on app
app.use('/api/auth', authRoutes);
```

---

## Role-Based Access Control (RBAC)

All data-fetching endpoints enforce role-based visibility:

| Role | Students | Attendance | Grades |
|------|----------|-----------|--------|
| **Admin** | All | All | All |
| **Teacher** | Only taught (via grades/attendance) | Only own records | Only own records |
| **Student** | Self only | Self only | Self only |
| **Parent** | Child only | Child only | Child only |

**Implementation:** Conditional `WHERE` clauses in queries (no separate authorization layer needed).

---

## Key Features

### Marklist Calculation
**Endpoint:** `GET /api/marklist?subject=<subject>`

**Process:**
1. Fetch all students (1 query)
2. Fetch all grades for subject (1 query)
3. Fetch all attendance (1 query)
4. Group in JavaScript (no DB loops)
5. Calculate weights & rank

**Performance:** O(n) complexity, not O(n²)

### Offline Sync
**Endpoint:** `POST /api/sync`

Allows mobile app to batch attendance/grades when offline, with automatic expiration of old data.

### Gemini AI Insights
**Frontend calls:** `POST /api/ai/insights`
- No direct SDK calls in browser
- Server routes to Gemini API securely

---

## Testing Structure

To test a module:

```typescript
import request from 'supertest';
import app from './server.ts';

describe('GET /api/students', () => {
  it('should return students filtered by role', async () => {
    const res = await request(app)
      .get('/api/students')
      .set('Cookie', 'token=<jwt>');
    expect(res.status).toBe(200);
  });
});
```

---

## Adding New Features

### 1. New Endpoint
Create `src/routes/feature.ts`:
```typescript
import { Router } from 'express';
import { pool, logger } from '../db/pool.ts';
import { authenticateToken } from '../middleware/auth.ts';

const router = Router();

router.get('/endpoint', authenticateToken, async (req, res) => {
  // Implementation
  res.json({});
});

export default router;
```

### 2. Mount in `server.ts`
```typescript
import featureRoutes from './src/routes/feature.ts';
app.use('/api/feature', featureRoutes);
```

### 3. Add to DB schema if needed
Update `src/db/schema.ts` with new table definitions.

---

## Deployment

### Environment Variables Required
```
DB_URL=postgresql://user:pass@host/dbname
JWT_SECRET=<secret-key>
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
CHAPA_API_KEY=<if using payments>
```

### Build & Run
```bash
npm run build    # TypeScript compilation
npm start        # Start server on port 3000
```

### Docker
```bash
docker build -t edufinance .
docker run -p 3000:3000 -e DB_URL=... edufinance
```

---

## Migration from Monolithic

**What Changed:**
- ~~1000-line monolithic `server.ts`~~ → **Modular structure**
- All route handlers distributed across `src/routes/`
- DB logic isolated in `src/db/`
- Middleware centralized in `src/middleware/`

**What Stayed the Same:**
- API contracts (routes, request/response formats)
- Database schema
- Security posture (JWT, rate limiting, CORS)

**Breaking Changes:** None — fully backward compatible.

---

## Quick Reference

| Task | Location |
|------|----------|
| Add API endpoint | `src/routes/<feature>.ts` |
| Add DB table | `src/db/schema.ts` |
| Add validation | `src/middleware/validate.ts` |
| Change auth logic | `src/middleware/auth.ts` |
| Add logger call | Import from `src/db/pool.ts` |
| Add external API | `src/services/<name>.ts` |

---

## Support & Questions

For issues:
1. Check the relevant route file in `src/routes/`
2. Trace DB queries in `src/db/`
3. Verify auth in `src/middleware/auth.ts`
4. Check environment variables

---

**Last Updated:** March 1, 2026  
**Structure Version:** 2.0 (Modular)
