# Split Expense — Supabase PostgreSQL Setup Guide

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Choose organization, set project name: `split-expense`
4. Set a strong **Database Password** (save it!)
5. Select region closest to you (e.g. `ap-south-1` for India)
6. Click **Create new project** (takes ~2 minutes)

## Step 2: Get Database Connection String

1. In Supabase Dashboard → **Project Settings** → **Database**
2. Under **Connection string**, select **URI** tab
3. Copy the connection string — two options:

### Option A: Transaction Pooler (Recommended for Render/server apps)
```
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

### Option B: Direct Connection (for local dev / migrations)
```
postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

Replace `[YOUR-PASSWORD]` with your database password.

### ⚠️ Password with special characters (@, #, %, etc.)

If your password contains `@`, you **must URL-encode** it in the connection string:

| Character | Encoded |
|-----------|---------|
| `@` | `%40` |
| `#` | `%23` |
| `%` | `%25` |

Example: password `321@Jenil@123` → `321%40Jenil%40123`

Or run: `node src/db/encode-url.js` (edit values in that file first).

### ⚠️ Windows users — use Pooler, NOT Direct connection

Direct host `db.xxx.supabase.co` often fails on Windows with:
```
Error: getaddrinfo ENOTFOUND db.xxx.supabase.co
```
This happens because the direct host resolves to **IPv6 only**. Use **Transaction pooler** (port **6543**) copied from Supabase Dashboard — do not guess the region.

## Step 3: Configure Backend

1. Copy env file:
   ```bash
   cd backend
   copy .env.example .env
   ```

2. Edit `backend/.env`:
   ```env
   DATABASE_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
   JWT_SECRET=generate-a-long-random-string-here-min-32-chars
   FRONTEND_URL=http://localhost:5173
   ```

3. Run migrations:
   ```bash
   npm run db:migrate
   ```

   You should see:
   ```
   ▶  Applying: 001_initial_schema.sql
   ✅ Applied: 001_initial_schema.sql
   🎉 All migrations complete!
   ```

## Step 4: Verify in Supabase

1. Go to **Table Editor** in Supabase Dashboard
2. You should see all tables: `users`, `groups`, `expenses`, `settlements`, etc.
3. Check `expense_categories` has 9 system categories seeded

## Step 5: Run the App Locally

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```
API runs at: http://localhost:5000/api/v1

**Terminal 2 — Frontend:**
```bash
cd frontend
copy .env.example .env
npm run dev
```
App runs at: http://localhost:5173

## Step 6: Deploy

### Backend → Render
1. Push code to GitHub
2. Create **Web Service** on Render
3. Set environment variables from `.env.example`
4. Build command: `npm install`
5. Start command: `npm start`
6. Run migrations once via Render Shell: `npm run db:migrate`

### Frontend → Vercel
1. Import GitHub repo, set root to `frontend`
2. Environment variable: `VITE_API_URL=https://your-render-app.onrender.com/api/v1`
3. Deploy

### Supabase Notes
- Enable **SSL** in production (already handled in backend config)
- For connection pooling on Render, always use port **6543** (transaction pooler)
- Supabase free tier: 500MB database, sufficient for development

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `getaddrinfo ENOTFOUND db.xxx.supabase.co` | Use **Transaction pooler** URL (port 6543), not direct connection |
| `tenant/user postgres.xxx not found` | Wrong **region** in URL — copy exact string from Supabase Dashboard |
| Password has `@` in it | URL-encode: `@` → `%40` |
| `password authentication failed` | Reset password in Supabase → Database Settings |
| `relation does not exist` | Run `npm run db:migrate` |
| Project paused | Supabase Dashboard → **Restore project** (free tier pauses after inactivity) |
| CORS errors | Set `FRONTEND_URL` in backend `.env` |
