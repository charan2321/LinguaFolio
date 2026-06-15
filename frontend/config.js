// API Configuration
// Use the value set by config.prod.js (generated at build time)
// If not available, compute it based on hostname
const API_BASE = (() => {
  // First, try the pre-generated config.prod.js value
  if (typeof window !== 'undefined' && window.VITE_API_BASE) {
    return window.VITE_API_BASE;
  }

  // Fallback: compute based on hostname
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5005/api/v1';
  }

  // Production fallback (should be set by config.prod.js)
  return 'https://linguafolio-production.up.railway.app/api/v1';
})();

// Ensure it's accessible globally for payment.js and other modules
window.API_BASE = API_BASE;
if (window.API_BASE === 'https://linguafolio-production.up.railway.app') {
  window.API_BASE = 'https://linguafolio-production.up.railway.app/api/v1';
}

// Supabase Configuration
window.VITE_SUPABASE_URL = window.VITE_SUPABASE_URL || 'https://luxyimqeaclnyivmmatm.supabase.co';
window.VITE_SUPABASE_ANON_KEY = window.VITE_SUPABASE_ANON_KEY || '';

// Validate critical configuration
if (!window.VITE_SUPABASE_ANON_KEY) {
  console.warn('[config] ⚠️ WARNING: VITE_SUPABASE_ANON_KEY not configured. Auth will not work.');
}

// Masked logging for development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  try {
    const maskedUrl = window.VITE_SUPABASE_URL ? window.VITE_SUPABASE_URL.replace(/(https?:\/\/)([^@]{4}).*/, '$1$2...') : 'missing';
    const anon = window.VITE_SUPABASE_ANON_KEY ? (window.VITE_SUPABASE_ANON_KEY.slice(0, 6) + '...' + window.VITE_SUPABASE_ANON_KEY.slice(-6)) : 'missing';
    console.log('[config] Development setup:', { apiBase: API_BASE, supabaseUrl: maskedUrl, anonKey: anon });
  } catch (e) {
    /* ignore */
  }
}
