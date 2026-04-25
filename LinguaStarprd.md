# 📘 LinguaStar — Product Requirements Document (PRD)

**Version:** 1.0  
**Brand:** LinguaStar  
**Industry:** Language Learning (Indian Languages)  
**Document Type:** Product Requirements Document  

---

## 1. Product Overview

### 1.1 Vision

LinguaStar is a web-based platform that enables users to learn Indian languages through curated digital books. The platform offers flexible subscription pricing, secure content access, and an admin-controlled book library — ensuring authors and publishers retain full control over content distribution.

### 1.2 Problem Statement

Learners of Indian languages lack a centralized, affordable, and secure digital platform to access quality learning materials. Existing solutions either allow easy content piracy or are priced out of reach for casual learners.

### 1.3 Solution

A subscription-gated, secure e-reader platform where users purchase time-limited access to a curated library of Indian language learning books. Content is non-downloadable and non-shareable by design.

---

## 2. Target Users

| User Type | Description |
|---|---|
| **Learner (End User)** | Individual wanting to learn one or more Indian languages |
| **Admin** | Platform operator who uploads, manages books and monitors users |

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Next.js, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB |
| Auth | Email-based (Register / Login / JWT) |
| Payment | Razorpay |
| Hosting (Frontend) | Vercel |
| Hosting (Backend) | Render / Railway |
| DB Hosting | MongoDB Atlas |

**Token Strategy:**
- Access JWT: 15 minutes, sent in `Authorization: Bearer` header
- Refresh token: 7 days, stored in `HttpOnly; Secure; SameSite=Strict` cookie

---

## 4. Pages & Navigation Structure

```
LinguaStar
├── Home
├── About Us
├── Login / Sign Up
├── Books
│   └── Indian Language Learning Books
│       └── Single Book — ₹59
└── Special Pricing
    ├── ₹299 / All Books / 60 Days
    └── ₹199 / All Books / 30 Days
```

### 4.1 Page Descriptions

**Home**
- Hero section with brand tagline
- Feature highlights (secure access, Indian language focus)
- CTA: "Browse Books" and "Get Started"
- Pricing summary cards linking to Special Pricing section
- Right-click disabled globally on book content areas

**About Us**
- Mission and story of LinguaStar
- Team or editorial notes
- Static content page

**Login / Sign Up**
- Email + Password registration
- Email + Password login
- JWT-based session with refresh token in HttpOnly cookie
- No social auth (email only per spec)
- Form validation with Zod on both client and server

**Books — Indian Language Learning Books**
- Grid of available books
- Each card shows: title, language, cover image, ₹59 price
- Books are blurred / locked preview until purchase
- Users cannot see content before purchase
- Individual book purchase: ₹59 per book

**Special Pricing**
- Two subscription tiers:

| Plan | Price | Duration | Access |
|---|---|---|---|
| Standard | ₹199 | 30 Days | All Books |
| Premium | ₹299 | 60 Days | All Books |

- Razorpay payment integration for both tiers
- On successful payment: access unlocked, countdown timer starts in user profile

---

## 5. Features

### 5.1 Admin Dashboard

- **3 Separate Admin Accounts** with separate login credentials and access panel
- Admins can upload new books at any time (title, language, cover image, PDF/content file)
- Admin dashboard is completely hidden from regular users — separate route, separate role guard
- Admin can view all users, their activity, and subscription status
- Admin cannot be accessed by regular users under any circumstance (role-based middleware enforced on backend)

### 5.2 User Profile & Activity Tracking

Each user has a profile page showing:
- Name and email
- Active subscription plan and expiry date
- **60-day or 30-day countdown timer** (visible and live)
- **Daily learned tracker** — tracks which books/pages the user has accessed each day
- History of purchased books or active subscription

### 5.3 Login / Signup

- Email and password only
- Passwords hashed with bcryptjs (cost factor ≥ 10)
- JWT access token (15 min) + HttpOnly refresh cookie (7 days)
- Account lockout after 5 failed attempts (15-minute cooldown via TTL index)

### 5.4 Content Protection — Disable Right-Click

- Right-click context menu globally disabled on all book reader pages
- Users cannot inspect, save-as, or use browser tools to extract book content from reader view
- No text selection on book content (CSS `user-select: none`)
- Books are served as server-rendered or streamed content — not as static file URLs

### 5.5 Razorpay Payment Integration

- Razorpay order created server-side (never expose key_secret to frontend)
- Payment intent created on backend; frontend uses Razorpay checkout SDK
- On payment success webhook: user record updated with `subscriptionPlan`, `subscriptionStart`, `subscriptionEnd`
- Amounts stored in paise (smallest unit) — never floats
- Individual book: ₹59 → 5900 paise
- 30-day plan: ₹199 → 19900 paise
- 60-day plan: ₹299 → 29900 paise

### 5.6 Book Access Security

- **No download button** — download is disabled for all users (including subscribers)
- Books are accessible only within the LinguaStar website reader
- Sharing or exporting content outside the platform is technically prevented:
  - No downloadable PDF links
  - Content served via protected API routes (auth-gated)
  - No shareable direct URLs to book content
- Only users who have purchased a book or hold an active subscription can access the reader
- Subscription expiry check on every reader page load (server-side validation)

---

## 6. Data Models

### 6.1 User

```json
{
  "_id": "ObjectId",
  "name": "String",
  "email": "String (unique)",
  "passwordHash": "String",
  "role": "Enum [user, admin]",
  "subscription": {
    "plan": "Enum [none, 30day, 60day]",
    "startDate": "Date",
    "endDate": "Date",
    "isActive": "Boolean"
  },
  "purchasedBooks": ["ObjectId"],
  "loginAttempts": "Number",
  "lockUntil": "Date",
  "dailyActivity": [
    { "date": "Date", "bookId": "ObjectId", "pagesViewed": "Number" }
  ],
  "refreshTokenHash": "String",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 6.2 Book

```json
{
  "_id": "ObjectId",
  "title": "String",
  "language": "String",
  "coverImageUrl": "String",
  "contentKey": "String",
  "priceIndividual": "Number",
  "isPublished": "Boolean",
  "uploadedBy": "ObjectId",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 6.3 Payment / Order

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "razorpayOrderId": "String",
  "razorpayPaymentId": "String",
  "type": "Enum [individual_book, subscription_30, subscription_60]",
  "bookId": "ObjectId | null",
  "amountPaise": "Number",
  "status": "Enum [created, paid, failed]",
  "createdAt": "Date"
}
```

---

## 7. API Endpoints

### Auth

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/register` | No | Register with email + password |
| POST | `/api/v1/auth/login` | No | Login, returns access token + sets refresh cookie |
| POST | `/api/v1/auth/refresh` | Cookie | Rotate refresh token, return new access token |
| POST | `/api/v1/auth/logout` | Yes | Clear refresh cookie + invalidate token |

### Users

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/users/me` | Yes | Get current user profile + subscription status |
| PATCH | `/api/v1/users/me` | Yes | Update name or password |
| GET | `/api/v1/users/me/activity` | Yes | Get daily learned tracker data |

### Books

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/books` | No | List all published books (metadata only, no content) |
| GET | `/api/v1/books/:id` | Yes | Get book metadata (access-gated) |
| GET | `/api/v1/books/:id/read` | Yes | Serve book content (subscription or purchase check) |

### Payments

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/payments/create-order` | Yes | Create Razorpay order (book or subscription) |
| POST | `/api/v1/payments/verify` | Yes | Verify Razorpay signature + activate access |
| POST | `/api/v1/payments/webhook` | HMAC only | Razorpay webhook for async confirmation |

### Admin

| Method | Route | Auth | Role |
|---|---|---|---|
| GET | `/api/v1/admin/users` | Yes | admin |
| GET | `/api/v1/admin/books` | Yes | admin |
| POST | `/api/v1/admin/books` | Yes | admin — upload new book |
| PATCH | `/api/v1/admin/books/:id` | Yes | admin — edit book metadata |
| DELETE | `/api/v1/admin/books/:id` | Yes | admin — unpublish/delete |
| GET | `/api/v1/admin/payments` | Yes | admin — view all orders |

### Health

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Liveness check |
| GET | `/ready` | No | Readiness check (MongoDB connected) |

---

## 8. Security Requirements

### Backend

- Zod-validated environment variables — crash on misconfiguration
- `helmet()` — security headers
- `cors()` — explicit origin allowlist only
- `express-mongo-sanitize` — NoSQL injection prevention
- `express-rate-limit` — 10 req/min on auth routes, 100/min globally
- `express.json({ limit: '10kb' })` — payload size limit
- `assertOwnership()` on every resource — always 404, never 403
- `crypto.timingSafeEqual()` for all token comparisons
- bcryptjs cost factor ≥ 10 for passwords and hashed refresh tokens
- Refresh token rotation with breach detection (reuse → full revocation)
- Account lockout: 5 failed attempts → 15-min lock (TTL index)
- Razorpay webhook signature verified with HMAC-SHA256 before processing
- Book content served only through authenticated, access-checked API routes
- Winston structured logging — no passwords, tokens, or PII in logs
- Sentry error monitoring with `beforeSend` scrubbing

### Frontend

- Access token in memory only (`tokenStore.ts`) — never `localStorage`
- Single-flight refresh interceptor (no duplicate refresh calls)
- Right-click (`contextmenu`) event disabled on book reader pages
- CSS `user-select: none` on book content
- `DOMPurify` on any user-generated content rendered as HTML
- All forms validated with React Hook Form + Zod before submission
- No console logging of tokens or sensitive data in production
- `RequireAuth` wrapper on all protected routes

---

## 9. Repository Structure

```
linguastar/
├── backend/
│   ├── src/
│   │   ├── config/           env.ts, db.ts
│   │   ├── middleware/       requireAuth.ts, validate.ts, roleGuard.ts, errorHandler.ts
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── books/
│   │   │   ├── payments/
│   │   │   └── admin/
│   │   ├── services/         email.service.ts, razorpay.service.ts
│   │   ├── utils/            jwt.ts, tokenCompare.ts, ownershipCheck.ts
│   │   └── types/            express.d.ts
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/              Next.js app router pages
│   │   ├── components/       RequireAuth, ErrorBoundary, BookReader, AdminGuard
│   │   ├── features/
│   │   │   ├── books/
│   │   │   ├── payments/
│   │   │   └── admin/
│   │   ├── lib/
│   │   │   ├── api/          client.ts, refreshClient.ts
│   │   │   └── env.ts
│   │   └── auth/             AuthProvider.tsx, tokenStore.ts
│   ├── .env.example
│   └── package.json
│
└── docs/
    └── PRD.md
```

---

## 10. Environment Variables

### Backend `.env.example`

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/linguastar
JWT_ACCESS_SECRET=replace_with_64_char_hex
JWT_REFRESH_SECRET=replace_with_different_64_char_hex
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
ENCRYPTION_KEY=replace_with_64_char_hex
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=replace_with_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=replace_with_webhook_secret
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=your_smtp_api_key
EMAIL_FROM=noreply@linguastar.in
SENTRY_DSN=https://your_sentry_dsn
```

### Frontend `.env.example`

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
```

---

## 11. Pricing Summary

| Product | Price | Access Duration |
|---|---|---|
| Single Book | ₹59 | Permanent (for that book) |
| All Books — 30 Days | ₹199 | 30 days from purchase |
| All Books — 60 Days | ₹299 | 60 days from purchase |

---

## 12. Out of Scope (v1)

- Mobile app (iOS / Android)
- Social login (Google, Facebook)
- Multi-language UI (platform UI is English only)
- Video or audio learning content
- Community or discussion features
- Affiliate / referral system

---

## 13. Success Metrics

| Metric | Target (3 months post-launch) |
|---|---|
| Registered users | 500+ |
| Paid conversions | 15% of registered |
| Average session duration | > 20 minutes |
| Subscription renewal rate | > 40% |
| Admin book uploads | 20+ books live |

---

*LinguaStar PRD v1.0 — Language Learning Platform for Indian Languages*