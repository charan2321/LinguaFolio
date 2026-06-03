# PRODUCTION READINESS AUDIT REPORT
**Project**: LinguaFolio | Language Learning Books  
**Date**: June 3, 2026  
**Status**: NOT READY FOR PRODUCTION  
**Overall Score**: 32/100

---

## EXECUTIVE SUMMARY

The project has a working authentication and payment system, but contains **critical security vulnerabilities, hardcoded credentials, debug code, and database constraints that must be fixed before any production deployment.**

**Critical blockers**: 5  
**High priority issues**: 12  
**Medium priority issues**: 8  
**Low priority issues**: 10  

---

## 1. CRITICAL ISSUES (MUST FIX BEFORE LAUNCH)

### 🔴 CRITICAL #1: HARDCODED SUPABASE CREDENTIALS IN FRONTEND
**File**: `frontend/config.js` (lines 11-13)  
**Severity**: CRITICAL - PUBLIC SECURITY BREACH  
**Issue**:
```javascript
window.VITE_SUPABASE_ANON_KEY = '...' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1eHlpbXFlYWNsbnlpdm1tYXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNjM5ODYsImV4cCI6MjA5NDkzOTk4Nn0.Rwatpo8HZdiKSMIQ6ofkWG15Fp0z1oS8O3D-cTZhSMI';
```
**Impact**: 
- Anon key is public but should never be shown in commit history
- Anyone can now impersonate any user via Supabase API
- Scope this key and regenerate it immediately

**Fix**:
- Remove hardcoded key
- Use environment variables only
- Regenerate the exposed anon key in Supabase dashboard
- Add config.js to .gitignore or use build-time injection

---

### 🔴 CRITICAL #2: DATABASE CONSTRAINT ERROR ON PAYMENT INSERTION
**File**: `backend/src/modules/payments/payment.routes.ts` (line 82)  
**Severity**: CRITICAL - PAYMENTS FAILING  
**Issue**: Database shows:
```
new row for relation "payments" violates check constraint "payments_status_check"
```
**Impact**:
- Payment orders are created but database insert fails with constraint error
- Need to verify payments table schema matches expected values

**Fix**: Check Supabase payments table:
- Verify `status` column allows 'pending' value
- Check if constraint exists and what values are allowed
- Update schema if needed or adjust insert values

---

### 🔴 CRITICAL #3: DEBUG LOGGING ENABLED IN PRODUCTION CODE
**Files**:
- `backend/src/app.ts` (lines 83-85): DEBUG logs
- `backend/src/router.ts` (line 10): DEBUG Router logs
- `backend/src/middleware/requireAuth.ts`: [AUTH] logs
- `backend/src/modules/payments/payment.routes.ts`: [Razorpay], [Payment] logs
- Many more in `backend/src/`

**Severity**: CRITICAL - INFORMATION DISCLOSURE  
**Issue**: Debug console.log() statements leak internal system information

**Fix**: Remove or conditionally enable based on NODE_ENV:
```typescript
if (env.NODE_ENV === 'development') {
  console.log('[DEBUG] Router stack:', router.stack?.length);
}
```

---

### 🔴 CRITICAL #4: PRODUCTION BACKEND URL IS INCOMPLETE
**File**: `frontend/config.js` (lines 2-6)  
**Issue**:
```javascript
const API_BASE = (() => {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5005/api/v1';
  }
  return 'https://YOUR_BACKEND_DOMAIN.onrender.com/api/v1'; // ← PLACEHOLDER
})();
```
**Impact**: Production frontend cannot call backend

**Fix**: 
- Deploy backend to Render/Railway/Heroku
- Update placeholder with actual domain
- Use environment variable at build time

---

### 🔴 CRITICAL #5: TEST/DEV RAZORPAY KEYS IN PRODUCTION
**File**: `backend/.env.example` (lines 9-11)  
**Issue**:
```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx        # TEST key format
RAZORPAY_KEY_SECRET=replace_with_razorpay_secret
```
**Impact**: Using test Razorpay keys in production = real payments won't process

**Fix**:
- Ensure production .env uses `rzp_live_*` keys
- Never commit real keys to git
- Use .env.local or secrets manager

---

## 2. HIGH PRIORITY ISSUES

### 🟠 HIGH #1: CORS ALLOWS DEVELOPMENT PORTS
**File**: `backend/src/app.ts` (lines 24-27)  
**Issue**:
```typescript
const allowed = [
  "https://frontend-gamma-hazel-1nw9r3172x.vercel.app",
  "https://frontend-7ko9rb6i-charus-projects-f5d15d88.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",  // ← REMOVE IN PRODUCTION
];
```
**Impact**: Development ports exposed in production config

**Fix**: Use environment-based CORS:
```typescript
const allowed = [
  ...(env.NODE_ENV === 'development' 
    ? ['http://localhost:3000', 'http://localhost:5173'] 
    : [])
];
```

---

### 🟠 HIGH #2: DEAD CODE - JWT UTILITY FUNCTIONS
**File**: `backend/src/utils/jwt.ts`  
**Issue**: Entire JWT module with `signAccessToken`, `verifyAccessToken`, etc. not used

**Impact**:
- Dead code adds maintenance burden
- Confuses developers about auth method
- Increases bundle size

**Fix**: Delete or comment with explanation that Supabase handles auth

---

### 🟠 HIGH #3: UNUSED DEPENDENCIES (MONGODB, BCRYPTJS)
**File**: `backend/package.json`  
**Dependencies to remove**:
```json
"bcryptjs": "^3.0.3",           // Not using
"mongoose": "^9.5.0",           // Not using
"express-mongo-sanitize": "^2.2.0",  // Not for SQL
"pg": "^8.11.1",                // Not using directly
```

**Impact**:
- Unnecessary bloat (+50MB of dependencies)
- False indication of architecture
- Supply chain risk

**Fix**: Run `npm prune` and remove from package.json

---

### 🟠 HIGH #4: DEBUG TEST ROUTE EXISTS
**File**: `backend/src/app.ts` (lines 39-41)  
**Code**:
```typescript
app.get("/test", (req, res) => {
  res.json({ message: "CORS working" });
});
```

**Fix**: Remove in production or at least in non-development

---

### 🟠 HIGH #5: NO HTTPS ENFORCEMENT
**Issue**: Backend doesn't redirect HTTP → HTTPS or set HSTS

**Fix**: Add to `app.ts`:
```typescript
if (env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

---

### 🟠 HIGH #6: NO HELMET SECURITY HEADERS
**File**: `backend/src/app.ts` (line 19)  
**Issue**: Helmet is imported but may not be fully configured

**Fix**: Ensure production configuration:
```typescript
app.use(helmet({
  contentSecurityPolicy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}));
```

---

### 🟠 HIGH #7: ERROR HANDLING IN PAYMENT WEBHOOK
**File**: `backend/src/modules/payments/payment.routes.ts` (line 200)  
**Issue**: Webhook catches errors but doesn't log or retry

**Fix**: Add proper error logging and dead-letter queue

---

### 🟠 HIGH #8: NO PAYMENT IDEMPOTENCY
**Issue**: If payment verification request is retried, it will create duplicate entries

**Fix**: Add idempotency key checking

---

### 🟠 HIGH #9: SESSION NOT REFRESHING
**Issue**: Frontend doesn't handle token expiration

**Fix**: Implement token refresh logic in auth.js

---

### 🟠 HIGH #10: NO RATE LIMITING PER USER
**Issue**: Global rate limit is 100 req/60s, but not per-user

**Fix**: Implement user-based rate limiting

---

### 🟠 HIGH #11: ENVIRONMENT EXAMPLE NOT UPDATED
**File**: `backend/.env.example`  
**Issue**: Still lists MongoDB and JWT secrets (legacy)

**Fix**: Update to only list Supabase keys

---

### 🟠 HIGH #12: NO VALIDATION ON PROFILE UPDATE
**Issue**: Frontend can update user metadata without backend validation

**Fix**: Add backend endpoint for profile updates with validation

---

## 3. MEDIUM PRIORITY ISSUES

### 🟡 MEDIUM #1: PAYMENT STATUS CONSTRAINT
**File**: Database schema issue  
**Issue**: Payments table `status` column has constraint preventing 'pending' value

**Fix**: Execute SQL in Supabase:
```sql
ALTER TABLE payments DROP CONSTRAINT payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check 
  CHECK (status IN ('pending', 'paid', 'failed', 'cancelled'));
```

---

### 🟡 MEDIUM #2: NO USER ROLE MANAGEMENT UI
**Issue**: Admin role not easily managed in frontend

**Fix**: Add admin panel to manage user roles

---

### 🟡 MEDIUM #3: PURCHASED BOOKS NOT UNLOCKED IN FRONTEND
**Issue**: Books.js shows blurred PDF for all users

**Fix**: Check `profile.purchased_books` before blurring

---

### 🟡 MEDIUM #4: NO PAYMENT HISTORY VALIDATION
**Issue**: Payment history endpoint shows all columns

**Fix**: Limit to safe columns (id, type, amount, status, created_at)

---

### 🟡 MEDIUM #5: FALLBACK BOOK DATA IN BOOKS.JS
**Issue**: If Supabase fails, uses hardcoded `bookData` variable

**Fix**: Ensure bookData is defined or show error

---

### 🟡 MEDIUM #6: NO RLS POLICIES DOCUMENTED
**Issue**: Supabase RLS might not prevent unauthorized access

**Fix**: Verify and document all RLS policies

---

### 🟡 MEDIUM #7: TOAST NOTIFICATIONS NOT PERSISTENT
**Issue**: Error toast disappears too quickly

**Fix**: Increase timeout for errors

---

### 🟡 MEDIUM #8: NO PAGINATION ON BOOKS
**Issue**: If books table has 1000+ rows, frontend loads all at once

**Fix**: Implement pagination

---

## 4. LOW PRIORITY ISSUES

### 🟢 LOW #1: MISSING LEGAL PAGES
**Missing**:
- Privacy Policy
- Terms and Conditions
- Refund Policy
- Contact/Support page

**Fix**: Create static pages

---

### 🟢 LOW #2: NO ROBOTS.TXT
**Fix**: Create `frontend/robots.txt`:
```
User-agent: *
Allow: /
Disallow: /admin.html
```

---

### 🟢 LOW #3: NO SITEMAP.XML
**Fix**: Create `frontend/sitemap.xml`

---

### 🟢 LOW #4: NO META TAGS / SEO
**Issue**: index.html has basic meta tags but no Open Graph

**Fix**: Add to `frontend/index.html`:
```html
<meta property="og:title" content="LinguaFolio">
<meta property="og:description" content="Master Any Language Through Books">
<meta property="og:image" content="/og-image.png">
```

---

### 🟢 LOW #5: NO FAVICON
**Fix**: Add to `frontend/index.html`:
```html
<link rel="icon" href="/favicon.ico">
```

---

### 🟢 LOW #6: MOBILE MENU ANIMATION
**Issue**: Menu slides in abruptly

**Fix**: Add CSS transition

---

### 🟢 LOW #7: NO LOADING SPINNER
**Issue**: API calls show no loading state

**Fix**: Add spinner while loading

---

### 🟢 LOW #8: PDF PREVIEW NOT WORKING
**Issue**: PDF.js canvas is blurred but doesn't actually render

**Fix**: Implement PDF rendering with pdf.js

---

### 🟢 LOW #9: BOOK COLORS HARDCODED
**Issue**: Color map doesn't match language/level

**Fix**: Get colors from database or use consistent scheme

---

### 🟢 LOW #10: NO SEARCH FUNCTIONALITY
**Issue**: Books page has no search

**Fix**: Add search box with Supabase full-text search

---

## 5. SECURITY RISKS

| Risk | Severity | File | Fix |
|------|----------|------|-----|
| Hardcoded Supabase anon key | CRITICAL | config.js | Use env vars only |
| Debug logging leaks info | CRITICAL | app.ts, requireAuth.ts | Remove debug logs |
| Test Razorpay keys used | CRITICAL | .env | Use production keys |
| CORS too permissive | HIGH | app.ts | Remove localhost:5173 |
| No HTTPS enforcement | HIGH | app.ts | Add redirect middleware |
| JWT utils still in codebase | MEDIUM | jwt.ts | Delete unused code |
| No helmet CSP headers | MEDIUM | app.ts | Configure CSP |
| Payment webhook no error handling | MEDIUM | payment.routes.ts | Add try-catch logging |

---

## 6. PERFORMANCE ISSUES

| Issue | Impact | File | Fix |
|-------|--------|------|-----|
| All books loaded at once | HIGH | books.js | Implement pagination |
| No caching headers | MEDIUM | app.ts | Add cache-control |
| Large PDF previews | MEDIUM | books.js | Compress images |
| No database indexes | MEDIUM | Supabase | Add indexes on user_id, razorpay_order_id |
| Unused dependencies | LOW | package.json | npm prune |

---

## 7. PRODUCTION CHECKLIST

### Before Deployment
- [ ] Remove all console.log() statements (or wrap with NODE_ENV check)
- [ ] Regenerate Supabase anon key (current one is exposed)
- [ ] Replace backend URL placeholder with production domain
- [ ] Verify Razorpay keys are production (rzp_live_*)
- [ ] Fix payments table constraint issue
- [ ] Remove debug test route GET /test
- [ ] Remove CORS localhost entries (or env-gate them)
- [ ] Add HTTPS redirect middleware
- [ ] Test payment flow end-to-end
- [ ] Verify RLS policies on Supabase tables
- [ ] Set up error tracking (Sentry)
- [ ] Set up monitoring (Datadog/New Relic)
- [ ] Create privacy policy
- [ ] Create terms of service

### After Deployment
- [ ] Monitor error logs
- [ ] Monitor payment webhook
- [ ] Monitor API response times
- [ ] Set up alerts for failed payments

---

## 8. FINAL PRODUCTION SCORE

**Overall: 32/100**

| Category | Score |
|----------|-------|
| Security | 40/100 |
| Database | 65/100 |
| API | 70/100 |
| Frontend | 50/100 |
| DevOps | 20/100 |
| Documentation | 15/100 |

### Verdict: ❌ NOT PRODUCTION READY

**Minimum fixes required before launch**:
1. ✅ Regenerate hardcoded Supabase anon key
2. ✅ Fix payment constraint error
3. ✅ Remove/hide debug logging
4. ✅ Deploy backend to production
5. ✅ Update production backend URL in frontend
6. ✅ Verify Razorpay keys are production
7. ✅ Test complete payment flow

**Timeline**: ~2 days for critical fixes + testing

---

*Generated by: QA Audit System*  
*Date: June 3, 2026*
