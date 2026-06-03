import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { router } from "./router.js";

export const app = express();

app.get("/health", (_req, res) => {
  res.status(200).json({ success: true, message: "LinguaFolio API healthy" });
});

app.use((helmet as unknown as () => any)());
const parseOrigins = (val: string) =>
  val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., curl, server-to-server)
    if (!origin) return callback(null, true);

    const configured = parseOrigins(env.CORS_ORIGINS || env.CLIENT_URL || '');

    const developmentOrigins = [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5500"
    ];

    const allowed = env.NODE_ENV === 'development' ? [...configured, ...developmentOrigins] : configured;

    if (allowed.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));

app.options(/.*/, cors());

app.use(cookieParser());
app.use(
  express.json({
    limit: "1mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString();
    }
  })
);
app.use((req, _res, next) => {
  const sanitize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sanitize);
    if (value && typeof value === "object") {
      const input = value as Record<string, unknown>;
      const output: Record<string, unknown> = {};
      for (const [key, nestedValue] of Object.entries(input)) {
        const cleanKey = key.replace(/\$/g, "").replace(/\./g, "");
        output[cleanKey] = sanitize(nestedValue);
      }
      return output;
    }
    return value;
  };

  req.body = sanitize(req.body);
  req.params = sanitize(req.params) as typeof req.params;
  next();
});
if (env.NODE_ENV === "development") app.use(morgan("dev"));

const rateLimitFactory = rateLimit as unknown as (options: Record<string, unknown>) => any;
const globalLimiter = rateLimitFactory({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

app.use("/api", globalLimiter);
app.use("/uploads", express.static("uploads"));

// Health check endpoint for API
app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({ success: true, message: "LinguaFolio API healthy" });
});

app.use("/api/v1", router);

// ── Root health check ──────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    status: "✅ LinguaStar API is running",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    endpoints: {
      architecture: "Supabase-first frontend with Express fallback for secure operations",
      client_handled: {
        auth: "Supabase SDK (_sb.auth)",
        users: "Supabase SDK (profiles table)",
        books: "Supabase SDK (books table)",
        admin: "Supabase SDK (_adminSb)"
      },
      server_handled: {
        payments: {
          create_order: "POST /api/v1/payments/create-order",
          verify:       "POST /api/v1/payments/verify",
          webhook:      "POST /api/v1/payments/webhook"
        }
      }
    },
  });
});

app.use((req, res) => res.status(404).json({ success: false, error: { message: "Route not found", code: "NOT_FOUND" } }));

app.use(errorHandler);
