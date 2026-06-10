# Split Expense Platform

Group Expense & Settlement Platform — Splitwise alternative for Friends, Office Teams, Food Clubs, Sports & Travel Groups.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, Material UI, React Query, React Hook Form |
| Backend | Node.js, Express.js, JWT Auth |
| Database | PostgreSQL (Supabase) |
| Deploy | Vercel (frontend), Render (backend) |

## Project Structure

```
Split Expense/
├── backend/          # Express REST API
├── frontend/         # React SPA
└── SUPABASE_SETUP.md # Database setup guide
```

## Quick Start

### 1. Setup Supabase Database
Follow [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

### 2. Backend
```bash
cd backend
copy .env.example .env   # Add your DATABASE_URL
npm run db:migrate
npm run dev
```

### 3. Frontend
```bash
cd frontend
copy .env.example .env
npm run dev
```

Open http://localhost:5173

## Features Implemented

- ✅ Email Register / Login with JWT + Refresh tokens
- ✅ Groups CRUD with admin/member roles
- ✅ Member invitations
- ✅ Expenses with equal/unequal/percentage/shares split
- ✅ Ledger engine with balance tracking
- ✅ Settlement suggestions (min-cash-flow algorithm)
- ✅ Settlement recording & history
- ✅ Reports (summary, members, monthly, categories)
- ✅ Activity timeline
- ✅ In-app notifications
- ✅ Audit logs & activity logs
- ✅ Soft delete on all entities

## API Base URL

```
http://localhost:5000/api/v1
```

Key endpoints:
- `POST /auth/register` — Register
- `POST /auth/login` — Login
- `GET /groups` — List groups
- `POST /groups/:id/expenses` — Add expense
- `GET /groups/:id/balances` — Member balances
- `GET /groups/:id/settlements/suggestions` — Settlement plan
