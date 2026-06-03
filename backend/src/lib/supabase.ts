import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

// Initialize Supabase admin client with service role key (full admin access)
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
);

// Supabase client for user-level operations (anon key)
export const supabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY
);

export default supabaseAdmin;
