// Supabase client initialization.
// Prefer Vite-style `import.meta.env.VITE_*` when available, then fall back to
// runtime globals that can be injected during deployment (but never the
// service role key).
const SUPABASE_URL =
  (typeof window !== 'undefined' && window.VITE_SUPABASE_URL) ||
  (typeof window !== 'undefined' && window.SUPABASE_URL) ||
  'https://luxyimqeaclnyivmmatm.supabase.co';

const SUPABASE_ANON_KEY =
  (typeof window !== 'undefined' && window.VITE_SUPABASE_ANON_KEY) ||
  (typeof window !== 'undefined' && window.SUPABASE_ANON_KEY) ||
  '';

function makeMockClient() {
  const users = new Map();
  const books = [
    { id: 'b1', title: 'Bonjour Paris', language: 'French', level: 'Beginner', price: 499, author: 'Claire Dubois' },
    { id: 'b2', title: 'Nihongo Start', language: 'Japanese', level: 'Beginner', price: 649, author: 'Yuki Tanaka' },
    { id: 'b3', title: 'Viva España', language: 'Spanish', level: 'Intermediate', price: 549, author: 'Miguel Ruiz' }
  ];
  const purchases = [];
  const profiles = new Map();
  let currentUser = null;
  let authListeners = [];

  const buildResult = (data, error = null) => ({ data, error });

  const queryBuilder = (table, rows = []) => {
    const filters = [];
    let orderBy = null;
    let singleMode = false;
    let selectedColumns = null;

    const applyFilters = () => {
      let result = rows.slice();
      for (const f of filters) {
        if (f.type === 'eq') {
          result = result.filter((row) => String(row[f.col]) === String(f.val));
        }
      }
      if (orderBy) {
        result = result.sort((a, b) => {
          if (a[orderBy.col] < b[orderBy.col]) return orderBy.ascending ? -1 : 1;
          if (a[orderBy.col] > b[orderBy.col]) return orderBy.ascending ? 1 : -1;
          return 0;
        });
      }
      if (singleMode) {
        result = result[0] ? [result[0]] : [];
      }
      result = applyJoin(result);
      return result;
    };

    let resultRows = null;

    const applyJoin = (rows) => {
      if (!selectedColumns || !/\bbooks\s*\(/.test(selectedColumns)) {
        return rows;
      }
      return rows.map((row) => {
        if (table === 'purchases') {
          return {
            ...row,
            books: books.find((book) => String(book.id) === String(row.book_id)) || null
          };
        }
        return row;
      });
    };

    const result = {
      select(columns) {
        selectedColumns = columns;
        return this;
      },
      eq(col, val) {
        filters.push({ type: 'eq', col, val });
        return this;
      },
      order(col, opts = { ascending: true }) {
        orderBy = { col, ascending: opts.ascending };
        return this;
      },
      single() {
        singleMode = true;
        return this;
      },
      insert(recordOrRecords) {
        const items = Array.isArray(recordOrRecords) ? recordOrRecords : [recordOrRecords];
        resultRows = items.map((item) => {
          const row = { id: item.id || `${table.slice(0, 1)}_${Math.random().toString(36).slice(2, 10)}`, ...item };
          if (table === 'purchases') {
            purchases.push(row);
          } else if (table === 'profiles') {
            profiles.set(row.id, row);
          } else if (table === 'books') {
            books.push(row);
          }
          return row;
        });
        return this;
      },
      upsert(record) {
        const row = { ...record };
        if (table === 'profiles') {
          const existing = profiles.get(row.id) || {};
          profiles.set(row.id, { ...existing, ...row });
          resultRows = [profiles.get(row.id)];
        } else if (table === 'purchases') {
          const idx = purchases.findIndex((item) => item.id === row.id);
          if (idx >= 0) {
            purchases[idx] = { ...purchases[idx], ...row };
            resultRows = [purchases[idx]];
          } else {
            purchases.push(row);
            resultRows = [row];
          }
        } else {
          resultRows = [row];
        }
        return this;
      },
      update(record) {
        const updates = { ...record };
        const rows = table === 'profiles' ? Array.from(profiles.values()) : table === 'purchases' ? purchases : table === 'books' ? books : [];
        const matched = rows.filter((row) => filters.every((f) => String(row[f.col]) === String(f.val)));
        resultRows = matched.map((row) => {
          const updated = { ...row, ...updates };
          if (table === 'profiles') {
            profiles.set(updated.id, updated);
          } else if (table === 'purchases') {
            const idx = purchases.findIndex((item) => item.id === row.id);
            if (idx >= 0) purchases[idx] = updated;
          } else if (table === 'books') {
            const idx = books.findIndex((item) => item.id === row.id);
            if (idx >= 0) books[idx] = updated;
          }
          return updated;
        });
        return this;
      },
      delete() {
        const rows = table === 'profiles' ? Array.from(profiles.values()) : table === 'purchases' ? purchases : table === 'books' ? books : [];
        const removed = rows.filter((row) => filters.every((f) => String(row[f.col]) === String(f.val)));
        if (table === 'profiles') {
          removed.forEach((row) => profiles.delete(row.id));
        } else if (table === 'purchases') {
          removed.forEach((row) => {
            const idx = purchases.findIndex((item) => item.id === row.id);
            if (idx >= 0) purchases.splice(idx, 1);
          });
        } else if (table === 'books') {
          removed.forEach((row) => {
            const idx = books.findIndex((item) => item.id === row.id);
            if (idx >= 0) books.splice(idx, 1);
          });
        }
        resultRows = removed;
        return this;
      },
      async then(resolve) {
        if (resultRows !== null) {
          return resolve(buildResult(resultRows, null));
        }
        const data = applyFilters();
        return resolve(buildResult(singleMode ? data[0] || null : data, null));
      },
      catch(onRejected) {
        return Promise.resolve(this).catch(onRejected);
      }
    };

    return result;
  };

  const auth = {
    async signInWithPassword({ email, password }) {
      const user = users.get(email);
      if (!user || user.password !== password) {
        return { data: null, error: { message: 'Invalid credentials' } };
      }
      currentUser = {
        id: user.id,
        email: user.email,
        user_metadata: { full_name: user.full_name },
        role: user.role || 'user',
        access_token: 'mock_access_token_' + user.id
      };
      authListeners.forEach((listener) => listener('SIGNED_IN', { user: currentUser, access_token: currentUser.access_token }));
      return { data: { user: currentUser, session: { user: currentUser, access_token: currentUser.access_token } }, error: null };
    },
    async signUp({ email, password, options }) {
      if (users.has(email)) {
        return { data: null, error: { message: 'User already exists' } };
      }
      const id = 'u_' + Math.random().toString(36).slice(2, 10);
      const full_name = options?.data?.full_name || email.split('@')[0];
      const user = { id, email, password, full_name, role: 'user' };
      users.set(email, user);
      profiles.set(id, { id, email, full_name, role: user.role, created_at: new Date().toISOString() });
      currentUser = {
        id,
        email,
        user_metadata: { full_name },
        role: user.role,
        access_token: 'mock_access_token_' + id
      };
      authListeners.forEach((listener) => listener('SIGNED_IN', { user: currentUser, access_token: currentUser.access_token }));
      return { data: { user: currentUser, session: { user: currentUser, access_token: currentUser.access_token } }, error: null };
    },
    async signInWithOAuth({ provider, options }) {
      return {
        data: null,
        error: {
          message: 'OAuth login is not supported in the mock Supabase client. Use the real Supabase SDK in production.'
        }
      };
    },
    async signOut() {
      currentUser = null;
      authListeners.forEach((listener) => listener('SIGNED_OUT', null));
      return { error: null };
    },
    async getSession() {
      return { data: { session: currentUser ? { user: currentUser, access_token: currentUser.access_token } : null } };
    },
    onAuthStateChange(cb) {
      authListeners.push(cb);
      const sub = { unsubscribe() { const idx = authListeners.indexOf(cb); if (idx > -1) authListeners.splice(idx, 1); } };
      setTimeout(() => cb(
        currentUser ? 'SIGNED_IN' : 'SIGNED_OUT',
        currentUser ? { user: currentUser, access_token: currentUser.access_token } : null
      ), 0);
      return { data: { subscription: sub } };
    },
    async resetPasswordForEmail(_email, _opts) {
      return { error: null };
    }
  };

  function from(table) {
    const rows = table === 'books' ? books : table === 'purchases' ? purchases : table === 'profiles' ? Array.from(profiles.values()) : [];
    return queryBuilder(table, rows);
  }

  return { auth, from, __internal: { users, books, purchases, profiles } };
}

let _sb;
  try {
    // Debug log: show that envs are loaded (masked)
    try {
      const maskedUrl = SUPABASE_URL ? SUPABASE_URL.replace(/(https?:\/\/)([^@]{4}).*/, '$1$2...') : 'missing';
      const maskedAnon = SUPABASE_ANON_KEY ? (SUPABASE_ANON_KEY.slice(0, 6) + '...' + SUPABASE_ANON_KEY.slice(-6)) : 'missing';
      console.log('[supabase] config', { url: maskedUrl, anon: maskedAnon });
    } catch (e) {
      /* ignore logging errors */
    }

    if (window.supabase && typeof window.supabase.createClient === 'function' && SUPABASE_URL && SUPABASE_ANON_KEY) {
      _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      // In development (localhost) allow mock client for local testing only.
      const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      if (isLocal) {
        _sb = makeMockClient();
        console.warn('⚠️ Using mock Supabase client for local testing');
      } else {
        // In production do NOT use mock — provide a fail-fast client so issues are visible
        console.error('Missing Supabase configuration (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Aborting client initialization.');
        const fail = () => Promise.reject(new Error('Supabase client not configured in production'));
        const failClient = new Proxy({}, {
          get: () => () => fail()
        });
        _sb = failClient;
      }
    }
  } catch (e) {
    _sb = makeMockClient();
    console.warn('⚠️ Supabase SDK not available — using mock client', e);
  }

  window._sb = _sb;
  console.log('✅ Supabase client ready (real or mock)');
