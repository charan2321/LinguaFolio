const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.resolve(root, 'dist');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const item of fs.readdirSync(src)) {
      if (item === 'node_modules' || item === 'dist' || item === 'scripts') continue;
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
  } else if (stat.isFile()) {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}

// Generate config.prod.js
const viteUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const viteAnon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const apiBase = process.env.VITE_API_BASE || process.env.API_BASE || '';

if (!viteUrl || !viteAnon) {
  console.warn('Warning: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set. Auth will not work in production.');
}

// If API_BASE is not set at build time, it MUST be injected at runtime by Vercel
const configContent = `// GENERATED config.prod.js — do not edit
window.VITE_SUPABASE_URL = "${viteUrl.replace(/"/g, '\\"')}";
window.VITE_SUPABASE_ANON_KEY = "${viteAnon.replace(/"/g, '\\"')}";
window.VITE_API_BASE = "${apiBase.replace(/"/g, '\\"')}";

// Initialize API_BASE from environment or runtime detection
if (!window.VITE_API_BASE) {
  // Fallback for development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.VITE_API_BASE = 'http://localhost:5005/api/v1';
  } else {
    // For production: wait for config.js to set it, or use Railway domain
    window.VITE_API_BASE = 'https://linguafolio-production.up.railway.app/api/v1';
  }
}
// Backwards compatibility
window.API_BASE = window.VITE_API_BASE || '';
console.log('[config.prod.js] API_BASE configured as:', window.VITE_API_BASE);
`;

ensureDir(out);
fs.writeFileSync(path.join(out, 'config.prod.js'), configContent, 'utf8');

// Copy all static files
copyRecursive(root, out);

console.log('Build complete. Output in dist/');
