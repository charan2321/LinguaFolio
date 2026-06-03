import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { sendError } from "../utils/response.js";

const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

/**
 * SUPABASE-ONLY AUTH MIDDLEWARE
 * 
 * Verifies Supabase JWT access tokens sent from the frontend.
 * Frontend auth flow: Supabase JS SDK -> access_token -> Authorization: Bearer <token>
 * This middleware validates the token server-side and attaches user to req.user
 * 
 * No local JWT fallback - all auth goes through Supabase.
 */
export const requireAuth = async (req: any, res: any, next: any): Promise<any> => {
  try {
    // Step 1: Extract and validate Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("[AUTH] ❌ Missing Authorization header");
      return sendError(res, "UNAUTHORIZED", "Missing Authorization header", 401);
    }

    const accessToken = authHeader.slice(7); // Remove "Bearer " prefix

    // Step 2: Verify Supabase access token with Supabase admin client
    console.log("[AUTH] 🔐 Verifying Supabase access token...");
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !data?.user) {
      const errorMsg = error?.message || "Unknown verification error";
      console.error(`[AUTH] ❌ Token verification failed: ${errorMsg}`);
      return sendError(res, "UNAUTHORIZED", "Invalid or expired token", 401);
    }

    // Step 3: Attach user data to request for downstream handlers
    req.user = {
      id: data.user.id,
      email: data.user.email,
      phone: data.user.phone || null,
      role: data.user.user_metadata?.role || "user",
      metadata: data.user.user_metadata || {}
    };

    console.log(`[AUTH] ✅ Token verified. User: ${req.user.email} (${req.user.id})`);
    return next();

  } catch (err: any) {
    console.error(`[AUTH] ⚠️ Auth exception: ${err?.message || err}`);
    return sendError(res, "INTERNAL_ERROR", "Authentication processing failed", 500);
  }
};
