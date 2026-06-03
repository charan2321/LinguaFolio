# Production Deployment Checklist

## Pre-Deployment

### Database & Supabase
- [ ] Create Supabase project or use existing
- [ ] Run all migrations to create tables:
  - [ ] `books` table with columns: id, title, author, language, level, price_individual, price, cover_url, pdf_url, is_published, created_at, updated_at
  - [ ] `profiles` table with columns: id, email, full_name, role (admin/user), purchased_books (array), subscription (json), created_at, updated_at
  - [ ] `payments` table with columns: id, user_id, razorpay_order_id, razorpay_payment_id, type, book_id, amount_paise, status (pending/paid/failed), created_at, updated_at
- [ ] Set up Row-Level Security (RLS) policies:
  - [ ] `profiles` - users can only read/update their own profile
  - [ ] `payments` - users can only read their own payments
  - [ ] `books` - everyone can read, only admins can write
- [ ] Create admin user:
  ```sql
  UPDATE profiles SET role = 'admin' WHERE id = 'your-user-id';
  ```

### Backend Deployment
- [ ] Build TypeScript: `npm run build`
- [ ] Set environment variables on hosting (Render, Railway, etc.):
  - [ ] `NODE_ENV=production`
  - [ ] `PORT=5005`
  - [ ] `SUPABASE_URL=...` (from Supabase)
  - [ ] `SUPABASE_ANON_KEY=...` (from Supabase)
  - [ ] `SUPABASE_SERVICE_ROLE_KEY=...` (from Supabase - KEEP SECRET)
  - [ ] `RAZORPAY_KEY_ID=rzp_live_...` (production key)
  - [ ] `RAZORPAY_KEY_SECRET=...` (keep secret)
  - [ ] `RAZORPAY_WEBHOOK_SECRET=...` (from Razorpay)
  - [ ] `CLIENT_URLS=https://yourdomain.com,https://www.yourdomain.com`
  - [ ] `DEBUG_LOGGING=false`
- [ ] Deploy to production URL
- [ ] Test health endpoint: `GET https://your-backend.com/health`
- [ ] Test CORS: `GET https://your-backend.com/test` from frontend origin

### Frontend Deployment
- [ ] Update `frontend/config.js`:
  - [ ] Replace `https://api.linguafolio.com/api/v1` with actual backend URL
- [ ] Set environment variables in hosting provider:
  - [ ] `VITE_SUPABASE_URL=...` (from Supabase)
  - [ ] `VITE_SUPABASE_ANON_KEY=...` (from Supabase)
- [ ] Deploy to production URL

### Razorpay Setup
- [ ] Switch from test keys to production keys
- [ ] Set webhook URL in Razorpay dashboard:
  - URL: `https://your-backend.com/api/v1/payments/webhook`
  - Events: `order.paid`, `payment.authorized`
- [ ] Test webhook by creating test payment

### Security Checklist
- [ ] Remove all console.log() from production build
- [ ] All secrets in .env.local (never in git)
- [ ] .env.local in .gitignore
- [ ] HTTPS enforced on frontend
- [ ] Supabase JWT key is not hardcoded
- [ ] Razorpay secret is not exposed in frontend
- [ ] CORS whitelist configured for production domains only
- [ ] Rate limiting enabled

### DNS & SSL
- [ ] Point domain to hosting provider
- [ ] SSL certificate generated (automatic with Vercel/Render)
- [ ] Test HTTPS: `https://yourdomain.com`

## Post-Deployment

### Testing
- [ ] [ ] Test user signup with valid email
- [ ] [ ] Test user login
- [ ] [ ] Test book browsing (from Supabase)
- [ ] [ ] Test adding book to cart
- [ ] [ ] Test payment flow (Razorpay test mode first)
- [ ] [ ] Verify payment recorded in `payments` table
- [ ] [ ] Verify book appears in user's profile
- [ ] [ ] Test payment history endpoint
- [ ] [ ] Test admin panel access
- [ ] [ ] Test non-admin cannot access admin panel

### Monitoring
- [ ] Set up error logging (Sentry/LogRocket)
- [ ] Set up uptime monitoring (Uptimerobot)
- [ ] Monitor payment webhook failures
- [ ] Monitor database query performance
- [ ] Set up alerts for errors

### Optional Enhancements
- [ ] Email notifications for purchases (SendGrid integration)
- [ ] SMS notifications (Twilio integration)
- [ ] Analytics (Mixpanel/GA4)
- [ ] Customer support (Intercom/Zendesk)

## Rollback Procedure
If deployment fails:
1. Revert frontend to last known good version
2. Revert backend to last known good version
3. Restart payment webhook processing
4. Monitor error logs
5. Notify admin users via email

## Support & Troubleshooting

### Payment Issues
- Check Razorpay webhook logs
- Verify RAZORPAY_KEY_SECRET matches
- Check Supabase `payments` table for failed records

### Auth Issues
- Verify SUPABASE_*_KEY values
- Check Supabase auth logs
- Verify JWT token expiration settings

### CORS Issues
- Verify frontend domain in CLIENT_URLS
- Check browser Network tab for preflight requests
- Verify origin header matches whitelist

### Database Issues
- Verify RLS policies allow operations
- Check Supabase query performance logs
- Verify table schemas match migrations
