import { Router } from "express";
import { paymentRouter } from "./modules/payments/payment.routes.js";

export const router = Router();

// Frontend now uses Supabase SDK directly for Auth, Users, Books, and Admin.
// Only Payment needs a backend route (for Razorpay order creation & webhooks).
router.use("/payments", paymentRouter);

console.log("📌 DEBUG Router.ts: Router stack:", router.stack?.length, "routes");
