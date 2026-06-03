import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { validate } from "../../middleware/validate.js";
import { razorpay, verifyRazorpaySignature } from "../../services/razorpay.service.js";
import { sendError, sendSuccess } from "../../utils/response.js";

// ── Supabase admin client (uses service role so it bypasses RLS) ────────────
function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL ?? (env as any).SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? (env as any).SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    console.warn("[Payment] Supabase admin env vars missing — payments will record without DB write");
    return null;
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

const router = Router();

// ── Validation schemas ──────────────────────────────────────────────────────
const createOrderSchema = z.object({
  body: z.object({
    type: z.enum(["individual_book", "subscription_30", "subscription_60"]),
    bookId: z.string().nullable().optional()
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

const verifySchema = z.object({
  body: z.object({
    razorpayOrderId: z.string(),
    razorpayPaymentId: z.string(),
    razorpaySignature: z.string()
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

// Default amount map (paise) — used when book is not found or type is subscription
const amountMap: Record<string, number> = {
  individual_book:  5900,
  subscription_30: 19900,
  subscription_60: 29900
};

// ── POST /create-order ──────────────────────────────────────────────────────
router.post("/create-order", requireAuth, validate(createOrderSchema), async (req, res, next) => {
  try {
    const { type, bookId } = req.body as { type: keyof typeof amountMap; bookId?: string | null };
    const userId = req.user?.id as string;

    console.log(`[Payment] create-order → type=${type} bookId=${bookId} userId=${userId}`);

    // Guard: bookId must not be a bare numeric string (old static IDs like "1", "2")
    // Only attempt DB lookup for real UUIDs (36-char format) or long alphanumeric IDs
    const isRealId = (id: string) =>
      id && id.length > 8 && !/^\d+$/.test(id);

    let amount = amountMap[type] ?? 5900;

    if (type === "individual_book" && bookId && isRealId(bookId)) {
      try {
        const sb = getSupabaseAdmin();
        if (sb) {
          const { data: book, error } = await sb
            .from("books")
            .select("id, price, price_paise, priceIndividual")
            .eq("id", bookId)
            .maybeSingle();

          if (error) {
            console.warn(`[Payment] Book lookup error (non-fatal): ${error.message}`);
          } else if (book) {
            // Support multiple price field names
            const bookPrice =
              book.price_paise ??
              (book.price ? book.price * 100 : null) ??
              book.priceIndividual ??
              amountMap.individual_book;
            amount = Math.round(Number(bookPrice));
            console.log(`[Payment] Book found: ${book.id}, amount=${amount} paise`);
          } else {
            console.warn(`[Payment] Book ${bookId} not found in Supabase — using default amount`);
          }
        }
      } catch (lookupErr: any) {
        console.warn(`[Payment] Book lookup exception (non-fatal): ${lookupErr.message}`);
      }
    }

    if (amount <= 0) {
      console.warn(`[Payment] Invalid amount ${amount} — using default`);
      amount = amountMap[type] ?? 5900;
    }

    // ── Create Razorpay order ───────────────────────────────────────────────
    let order: any;
    try {
      order = await razorpay.orders.create({
        amount: Math.round(amount),
        currency: "INR",
        receipt: `ls_${Date.now()}`
      });
      console.log(`[Payment] Razorpay order created: ${order.id}`);
    } catch (rzpErr: any) {
      console.error(`[Payment] Razorpay API error:`, rzpErr);
      return sendError(res, "PAYMENT_ERROR", rzpErr.description || "Razorpay order creation failed", 500);
    }

    // ── Record pending payment in Supabase (best-effort) ──────────────────
    try {
      const sb = getSupabaseAdmin();
      if (sb) {
        const { error: dbErr } = await sb.from("payments").insert({
          user_id: userId,
          razorpay_order_id: order.id,
          type,
          book_id: (bookId && isRealId(bookId)) ? bookId : null,
          amount_paise: amount,
          status: "created",
          created_at: new Date().toISOString()
        });
        if (dbErr) {
          console.warn(`[Payment] DB insert warning (non-fatal): ${dbErr.message}`);
        }
      }
    } catch (dbEx: any) {
      console.warn(`[Payment] DB insert exception (non-fatal): ${dbEx.message}`);
    }

    return sendSuccess(res, {
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
      keyId:    env.RAZORPAY_KEY_ID
    }, 201);

  } catch (error) {
    console.error(`[Payment] create-order unexpected error:`, error);
    next(error);
  }
});

// ── POST /verify ────────────────────────────────────────────────────────────
router.post("/verify", requireAuth, validate(verifySchema), async (req, res, next) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body as {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    };
    const userId = req.user?.id as string;

    console.log(`[Payment] verify → orderId=${razorpayOrderId} paymentId=${razorpayPaymentId}`);

    // ── Verify HMAC signature ───────────────────────────────────────────────
    const digest = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (digest !== razorpaySignature) {
      console.error(`[Payment] Signature mismatch`);
      return sendError(res, "INVALID_REQUEST", "Invalid payment signature", 400);
    }

    // ── Fulfil purchase in Supabase (best-effort) ──────────────────────────
    try {
      const sb = getSupabaseAdmin();
      if (sb) {
        // 1. Fetch the pending payment record
        const { data: payment, error: fetchErr } = await sb
          .from("payments")
          .select("id, book_id, type, status")
          .eq("razorpay_order_id", razorpayOrderId)
          .eq("user_id", userId)
          .maybeSingle();

        if (fetchErr) console.warn(`[Payment] Fetch payment warning: ${fetchErr.message}`);

        if (payment && payment.status !== "paid") {
          // 2. Mark payment paid
          const { error: updateErr } = await sb
            .from("payments")
            .update({ status: "paid", razorpay_payment_id: razorpayPaymentId, updated_at: new Date().toISOString() })
            .eq("id", payment.id);

          if (updateErr) console.warn(`[Payment] Update payment warning: ${updateErr.message}`);

          // 3. Record purchase
          if (payment.type === "individual_book" && payment.book_id) {
            const { error: purchaseErr } = await sb.from("purchases").insert({
              user_id: userId,
              book_id: payment.book_id,
              price_paise: 0, // filled from payment record if needed
              razorpay_payment_id: razorpayPaymentId,
              created_at: new Date().toISOString()
            });
            if (purchaseErr) console.warn(`[Payment] Purchase insert warning: ${purchaseErr.message}`);
          } else if (payment.type?.startsWith("subscription_")) {
            const days = payment.type === "subscription_60" ? 60 : 30;
            const start = new Date();
            const end   = new Date(start.getTime() + days * 86400_000);
            const { error: subErr } = await sb
              .from("profiles")
              .update({
                subscription: { is_active: true, plan: `${days}day`, start_date: start.toISOString(), end_date: end.toISOString() },
                updated_at: new Date().toISOString()
              })
              .eq("id", userId);
            if (subErr) console.warn(`[Payment] Subscription update warning: ${subErr.message}`);
          }
        }
      }
    } catch (fulfillErr: any) {
      // Non-fatal — payment is already verified, just log
      console.error(`[Payment] Fulfillment error (non-fatal): ${fulfillErr.message}`);
    }

    console.log(`[Payment] Verification successful for order ${razorpayOrderId}`);
    return sendSuccess(res, { verified: true });

  } catch (error) {
    console.error(`[Payment] verify unexpected error:`, error);
    next(error);
  }
});

// ── POST /webhook ───────────────────────────────────────────────────────────
router.post("/webhook", async (req: any, res, next) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    if (typeof signature !== "string") return sendError(res, "UNAUTHORIZED", "Missing signature", 401);

    const body = req.rawBody;
    if (!body) return sendError(res, "INVALID_REQUEST", "Missing payload", 400);

    if (!verifyRazorpaySignature(body, signature)) {
      return sendError(res, "UNAUTHORIZED", "Invalid signature", 401);
    }

    const event = JSON.parse(body);
    console.log(`[Payment] Webhook event: ${event.event}`);

    if (event.event === "order.paid") {
      const razorpayOrderId  = event.payload?.order?.entity?.id;
      const razorpayPaymentId = event.payload?.payment?.entity?.id;
      if (razorpayOrderId) {
        try {
          const sb = getSupabaseAdmin();
          if (sb) {
            const { data: payment } = await sb
              .from("payments")
              .select("id, book_id, type, user_id, status")
              .eq("razorpay_order_id", razorpayOrderId)
              .maybeSingle();

            if (payment && payment.status !== "paid") {
              await sb.from("payments").update({ status: "paid", razorpay_payment_id: razorpayPaymentId }).eq("id", payment.id);

              if (payment.type === "individual_book" && payment.book_id) {
                await sb.from("purchases").insert({
                  user_id: payment.user_id,
                  book_id: payment.book_id,
                  razorpay_payment_id: razorpayPaymentId,
                  created_at: new Date().toISOString()
                });
              }
              console.log(`[Payment] Webhook fulfillment done for order ${razorpayOrderId}`);
            }
          }
        } catch (whErr: any) {
          console.error(`[Payment] Webhook fulfillment error: ${whErr.message}`);
        }
      }
    }

    return sendSuccess(res, { received: true });
  } catch (error) {
    next(error);
  }
});

export { router as paymentRouter };
