---
# DEPLOYMENT CONFIGURATION GUIDE

## Frontend (Vercel)

Set these environment variables in Vercel Project Settings → Environment Variables:

### Required Variables

| Variable | Example | Description |
|----------|---------|-------------|
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` | Supabase anonymous/public key (safe to expose) |
| `VITE_API_BASE` | `https://linguafolio-api.railway.app/api/v1` | Backend API endpoint (include /api/v1 path) |

### Build Configuration

- Vercel will run: `npm --prefix frontend run build`
- Build output: `frontend/dist/`
- Framework: Static site (no framework detection needed)
- Root directory: `frontend`

---

## Backend (Railway)

Set these environment variables in Railway Project Settings → Environment:

### Required Variables

| Variable | Example | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Node environment |
| `SUPABASE_URL` | `https://your-project.supabase.co` | Supabase project URL |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIs...` | Supabase service role key (private) |
| `RAZORPAY_KEY_ID` | `rzp_test_abc123xyz...` | Razorpay public key |
| `RAZORPAY_KEY_SECRET` | `abcdefghijk123456...` | Razorpay secret key (private) |
| `RAZORPAY_WEBHOOK_SECRET` | `webhook_secret_xyz123...` | Razorpay webhook secret |
| `CORS_ORIGINS` | `https://your-frontend.vercel.app,https://www.your-frontend.vercel.app` | Comma-separated allowed origins |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | (Railway assigns) | Server port |
| `DEBUG_LOGGING` | `false` | Enable verbose logs |
| `CLIENT_URL` | (fallback) | Fallback for CORS origins |

### Build Configuration

- Railway will run: `npm run build`
- Build output: `dist/`
- Start command: `node dist/server.js`

---

## Supabase Database

### Tables Required

Run this SQL in Supabase SQL editor (copy from `backend/sql/create_supabase_schema.sql`):

1. **profiles** - User profiles with roles and purchased books
2. **books** - Book catalog 
3. **payments** - Payment records linked to Razorpay orders

### Row Level Security (RLS)

All tables have RLS policies:
- Users can only read/write their own data
- Admins can read all data
- Backend (service role) bypasses RLS for server operations
- Payments table: clients cannot insert/update/delete

---

## Razorpay Webhook

1. Go to Razorpay Dashboard → Settings → Webhooks
2. Add new webhook:
   - **URL**: `https://<your-railway-domain>/api/v1/payments/webhook`
   - **Events**: `order.paid`, `payment.authorized`
   - **Status**: Active
3. Copy Webhook Secret → set as `RAZORPAY_WEBHOOK_SECRET` in Railway

---

## Deployment Verification Checklist

- [ ] Backend builds: `npm --prefix backend run build`
- [ ] Frontend builds: `npm --prefix frontend run build`
- [ ] No syntax errors: `node -c frontend/auth.js`, `node -c frontend/payment.js`
- [ ] Supabase tables created and RLS enabled
- [ ] Railway deployed with all env vars set
- [ ] Vercel deployed with all env vars set
- [ ] Razorpay webhook configured
- [ ] Health endpoint works: `GET https://<railway-domain>/health`
- [ ] Frontend loads without console errors
- [ ] Auth functions available: `window.handleSignin`, `window.handleSignup`, `window.handleLogout`
- [ ] Can sign up → user created in Supabase
- [ ] Can sign in → session restored
- [ ] Can browse books → fetched from Supabase
- [ ] Can create payment order → Razorpay checkout opens
- [ ] Can verify payment → purchase recorded in Supabase

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `net::ERR_NAME_NOT_RESOLVED` | VITE_API_BASE URL is wrong or domain doesn't exist. Verify Railway domain. |
| `Supabase client not configured in production` | VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing in Vercel env. |
| CORS errors | Add Vercel frontend domain to CORS_ORIGINS in Railway. |
| Payment signature invalid | RAZORPAY_KEY_SECRET mismatch. Verify both keys are correct. |
| Webhook not triggering | Check webhook URL in Razorpay dashboard, verify RAZORPAY_WEBHOOK_SECRET. |
