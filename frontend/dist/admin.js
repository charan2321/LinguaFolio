/* ============================================================
   ADMIN.JS — Fixed: no duplicate supabase declaration,
   element IDs match current admin.html
   ============================================================ */

/* ── Supabase client ─────────────────────────────────────────
   Use window._sb when available (index.html loads lib/supabase.js
   before admin.js). In standalone admin.html we create our own.
   NEVER declare `const supabase` — that conflicts with the CDN's
   global `var supabase`.
   ──────────────────────────────────────────────────────────── */
const _adminUrl = 'https://luxyimqeaclnyivmmatm.supabase.co';
const _adminKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1eHlpbXFlYWNsbnlpdm1tYXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNjM5ODYsImV4cCI6MjA5NDkzOTk4Nn0.Rwatpo8HZdiKSMIQ6ofkWG15Fp0z1oS8O3D-cTZhSMI';

const _adminSb = (
  (typeof window !== 'undefined' && window._sb) ||
  (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function'
    ? window.supabase.createClient(_adminUrl, _adminKey)
    : null)
);

/* ── State ─────────────────────────────────────────────────── */
let _adminCurrentUser = null;
let _allBooks = [];
let _allUsers = [];
let _confirmCallback = null;
let _editingBookId = null;

/* ── Toast ─────────────────────────────────────────────────── */
function adminToast(msg, type) {
  const t = document.getElementById('toast');
  if (!t) return;
  const item = document.createElement('div');
  item.className = 'toast-item ' + (type || 'info');
  item.textContent = msg;
  t.appendChild(item);
  setTimeout(() => item.remove(), 3500);
}

/* ── Tab switching ─────────────────────────────────────────── */
function switchTab(tabName, el) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const tab = document.getElementById('tab-' + tabName);
  if (tab) tab.classList.add('active');
  if (el) el.classList.add('active');

  const titles = {
    dashboard: ['Dashboard', 'Overview of your platform'],
    books:     ['Book Management', 'Upload, edit and manage all books'],
    users:     ['User Management', 'View and manage platform users']
  };
  const t = titles[tabName] || ['Admin', ''];
  const el1 = document.getElementById('topbarTitle');
  const el2 = document.getElementById('topbarSub');
  if (el1) el1.textContent = t[0];
  if (el2) el2.textContent = t[1];

  if (tabName === 'books') loadAdminBooks();
  if (tabName === 'users') loadAdminUsers();
}

/* ── Sidebar mobile ────────────────────────────────────────── */
function openSidebar() {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('mobOverlay')?.classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('mobOverlay')?.classList.remove('open');
}

/* ── Auth ──────────────────────────────────────────────────── */
async function doAdminLogin(email, password) {
  if (!_adminSb) return { ok: false, error: 'Supabase not ready' };
  try {
    const { data, error } = await _adminSb.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    _adminCurrentUser = data.user;
    return { ok: true, user: data.user };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function doLogout() {
  if (_adminSb) await _adminSb.auth.signOut();
  const loginScreen = document.getElementById('loginScreen');
  const adminApp   = document.getElementById('adminApp');
  if (loginScreen) loginScreen.style.display = 'flex';
  if (adminApp)    adminApp.style.display = 'none';
  _adminCurrentUser = null;
}

/* ── Show app after login ──────────────────────────────────── */
function showAdminApp(user) {
  const loginScreen = document.getElementById('loginScreen');
  const adminApp   = document.getElementById('adminApp');
  if (loginScreen) loginScreen.style.display = 'none';
  if (adminApp)    adminApp.style.display    = 'block';

  const sidebarUser = document.getElementById('sidebarUser');
  if (sidebarUser) sidebarUser.textContent = user?.email || '—';

  const topbarDate = document.getElementById('topbarDate');
  if (topbarDate) topbarDate.textContent = new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });

  loadDashboard();
}

/* ── Dashboard ─────────────────────────────────────────────── */
async function loadDashboard() {
  if (!_adminSb) return;
  try {
    const [booksRes, usersRes] = await Promise.all([
      _adminSb.from('books').select('id, is_published, isPublished'),
      _adminSb.from('profiles').select('id', { count: 'exact' })
    ]);

    const books     = booksRes.data || [];
    const published = books.filter(b => b.is_published !== false && b.isPublished !== false).length;

    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('statBooks',     books.length);
    el('statUsers',     usersRes.count ?? (usersRes.data || []).length);
    el('statPublished', published);

    // purchases count — graceful if table missing
    try {
      const { count } = await _adminSb.from('purchases').select('id', { count: 'exact', head: true });
      el('statSubs', count ?? 0);
    } catch (_) { el('statSubs', '—'); }

    // Recent uploads
    const { data: recent } = await _adminSb
      .from('books').select('id, title, language, level, created_at')
      .order('created_at', { ascending: false }).limit(5);

    const recentList = document.getElementById('recentList');
    if (recentList) {
      const rows = (recent || []);
      recentList.innerHTML = rows.length === 0
        ? '<div style="color:#aaa;text-align:center;padding:32px">No books yet.</div>'
        : rows.map(b => `
            <div class="recent-item">
              <div class="recent-thumb">📚</div>
              <div class="recent-info">
                <div class="recent-title">${b.title || 'Untitled'}</div>
                <div class="recent-meta">${b.language || ''} · ${b.level || ''}</div>
              </div>
              <div class="recent-time">${b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN') : '—'}</div>
            </div>`).join('');
    }
  } catch (err) {
    console.error('[Admin] Dashboard error:', err);
  }
}

/* ── Books table ───────────────────────────────────────────── */
async function loadAdminBooks() {
  if (!_adminSb) return;
  const tbody = document.getElementById('booksTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Loading…</td></tr>';
  try {
    const { data, error } = await _adminSb.from('books').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    _allBooks = data || [];
    renderBooksTable(_allBooks);
  } catch (err) {
    console.error('[Admin] Load books error:', err);
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Error: ${err.message}</td></tr>`;
  }
}

function renderBooksTable(books) {
  const tbody = document.getElementById('booksTableBody');
  if (!tbody) return;
  if (!books || books.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No books found.</td></tr>';
    return;
  }
  tbody.innerHTML = books.map(book => {
    const price      = book.price ?? (book.price_paise ? book.price_paise / 100 : (book.priceIndividual ? book.priceIndividual / 100 : '—'));
    const isPublished = book.is_published !== false && book.isPublished !== false;
    const date       = book.created_at ? new Date(book.created_at).toLocaleDateString('en-IN') : '—';
    const safeTitle  = (book.title || '').replace(/'/g, "\\'");
    return `<tr>
      <td><div class="cell-book">
        <div class="book-thumb">📚</div>
        <div class="cell-book-info">
          <div class="book-title">${book.title || 'Untitled'}</div>
          <div class="book-meta">${book.author || 'Anonymous'}</div>
        </div>
      </div></td>
      <td>${book.language || '—'}</td>
      <td>${book.level || '—'}</td>
      <td>₹${price}</td>
      <td><span class="badge ${isPublished ? 'badge-pub' : 'badge-unpub'}">${isPublished ? 'Published' : 'Unpublished'}</span></td>
      <td>${date}</td>
      <td><div class="actions-cell">
        <button class="btn btn-sm btn-ghost" onclick="openEditBook('${book.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="confirmDeleteBook('${book.id}','${safeTitle}')">Delete</button>
      </div></td>
    </tr>`;
  }).join('');
}

function filterBooks() {
  const search = (document.getElementById('bookSearch')?.value || '').toLowerCase();
  const lang   = document.getElementById('bookLangFilter')?.value || '';
  const status = document.getElementById('bookStatusFilter')?.value;
  renderBooksTable(_allBooks.filter(b => {
    const match1 = !search || (b.title || '').toLowerCase().includes(search) || (b.author || '').toLowerCase().includes(search);
    const match2 = !lang || b.language === lang;
    const isPub  = b.is_published !== false && b.isPublished !== false;
    const match3 = !status ? true : (status === 'true' ? isPub : !isPub);
    return match1 && match2 && match3;
  }));
}

/* ── Users table ───────────────────────────────────────────── */
async function loadAdminUsers() {
  if (!_adminSb) return;
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Loading…</td></tr>';
  try {
    const { data, error } = await _adminSb.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    _allUsers = data || [];
    renderUsersTable(_allUsers);
  } catch (err) {
    console.error('[Admin] Load users error:', err);
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">Error: ${err.message}</td></tr>`;
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No users found.</td></tr>';
    return;
  }
  tbody.innerHTML = users.map(u => {
    const date = u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '—';
    const role = u.role || 'user';
    const sub  = u.subscription?.is_active ? 'Active' : 'None';
    const safeEmail = (u.email || '').replace(/'/g, "\\'");
    return `<tr>
      <td>${u.email || u.full_name || u.name || '—'}</td>
      <td><span class="badge ${role === 'admin' ? 'badge-admin' : 'badge-user'}">${role}</span></td>
      <td>${sub}</td>
      <td>${date}</td>
      <td><div class="actions-cell">
        <button class="btn btn-sm btn-danger" onclick="confirmDeleteUser('${u.id}','${safeEmail}')">Remove</button>
      </div></td>
    </tr>`;
  }).join('');
}

function filterUsers() {
  const search = (document.getElementById('userSearch')?.value || '').toLowerCase();
  const role   = document.getElementById('userRoleFilter')?.value || '';
  renderUsersTable(_allUsers.filter(u => {
    const match1 = !search || (u.email || '').toLowerCase().includes(search) || (u.full_name || u.name || '').toLowerCase().includes(search);
    const match2 = !role || u.role === role;
    return match1 && match2;
  }));
}

/* ── Book modal ────────────────────────────────────────────── */
function openBookModal() {
  _editingBookId = null;
  const titleEl = document.getElementById('bookModalTitle');
  if (titleEl) titleEl.textContent = 'Add New Book';
  ['bookId','bookTitle','bookAuthor','bookDesc','bookCoverUrl','bookPdfUrl'].forEach(id => {
    const e = document.getElementById(id);
    if (e) e.value = '';
  });
  document.getElementById('bookModal')?.classList.add('open');
}

function openEditBook(id) {
  const book = _allBooks.find(b => String(b.id) === String(id));
  if (!book) return;
  _editingBookId = id;
  const titleEl = document.getElementById('bookModalTitle');
  if (titleEl) titleEl.textContent = 'Edit Book';

  const set = (elId, val) => { const e = document.getElementById(elId); if (e) e.value = val ?? ''; };
  set('bookId',        book.id);
  set('bookTitle',     book.title);
  set('bookAuthor',    book.author);
  set('bookLang',      book.language);
  set('bookLevel',     book.level || 'Beginner');
  set('bookPrice',     book.price ?? (book.price_paise ? book.price_paise / 100 : ''));
  set('bookPublished', (book.is_published !== false).toString());
  set('bookDesc',      book.description);
  set('bookCoverUrl',  book.cover_url || book.coverImageUrl);
  set('bookPdfUrl',    book.pdf_url   || book.pdfUrl);
  document.getElementById('bookModal')?.classList.add('open');
}

function closeBookModal() {
  document.getElementById('bookModal')?.classList.remove('open');
}

async function saveBook() {
  if (!_adminSb) return;
  const title    = document.getElementById('bookTitle')?.value.trim();
  const language = document.getElementById('bookLang')?.value;
  if (!title || !language) { adminToast('Title and language are required', 'error'); return; }

  const btn = document.getElementById('saveBookBtn');
  if (btn) btn.disabled = true;

  const payload = {
    title,
    author:      document.getElementById('bookAuthor')?.value.trim() || null,
    language,
    level:       document.getElementById('bookLevel')?.value || 'Beginner',
    price:       Number(document.getElementById('bookPrice')?.value) || 499,
    is_published: document.getElementById('bookPublished')?.value === 'true',
    description: document.getElementById('bookDesc')?.value.trim() || null,
    cover_url:   document.getElementById('bookCoverUrl')?.value.trim() || null,
    pdf_url:     document.getElementById('bookPdfUrl')?.value.trim() || null,
    updated_at:  new Date().toISOString()
  };

  try {
    let error;
    if (_editingBookId) {
      ({ error } = await _adminSb.from('books').update(payload).eq('id', _editingBookId));
    } else {
      payload.created_at = new Date().toISOString();
      ({ error } = await _adminSb.from('books').insert(payload));
    }
    if (error) throw error;
    adminToast(_editingBookId ? '✅ Book updated' : '✅ Book added', 'success');
    closeBookModal();
    loadAdminBooks();
    loadDashboard();
  } catch (err) {
    console.error('[Admin] Save book error:', err);
    adminToast('❌ ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ── File upload preview helpers ───────────────────────────── */
function handleCoverChange(e) {
  const file = e.target?.files?.[0];
  if (!file) return;
  const prev = document.getElementById('coverPreview');
  const img  = document.getElementById('coverPreviewImg');
  const name = document.getElementById('coverPreviewName');
  const size = document.getElementById('coverPreviewSize');
  if (prev) prev.classList.add('show');
  if (img)  img.src = URL.createObjectURL(file);
  if (name) name.textContent = file.name;
  if (size) size.textContent = (file.size / 1024).toFixed(1) + ' KB';
}
function handlePdfChange(e) {
  const file = e.target?.files?.[0];
  if (!file) return;
  const prev = document.getElementById('pdfPreview');
  const name = document.getElementById('pdfPreviewName');
  const size = document.getElementById('pdfPreviewSize');
  if (prev) prev.classList.add('show');
  if (name) name.textContent = file.name;
  if (size) size.textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';
}

/* ── Confirm dialog ────────────────────────────────────────── */
function openConfirm(icon, title, msg, onOk) {
  _confirmCallback = onOk;
  const elIcon  = document.getElementById('confirmIcon');
  const elTitle = document.getElementById('confirmTitle');
  const elMsg   = document.getElementById('confirmMsg');
  const elOk    = document.getElementById('confirmOkBtn');
  if (elIcon)  elIcon.textContent  = icon;
  if (elTitle) elTitle.textContent = title;
  if (elMsg)   elMsg.textContent   = msg;
  if (elOk)    elOk.onclick = async () => { closeConfirm(); if (_confirmCallback) await _confirmCallback(); };
  document.getElementById('confirmModal')?.classList.add('open');
}
function closeConfirm() {
  document.getElementById('confirmModal')?.classList.remove('open');
}

function confirmDeleteBook(id, title) {
  openConfirm('🗑️', 'Delete Book', `Delete "${title}"? This cannot be undone.`, async () => {
    if (!_adminSb) return;
    const { error } = await _adminSb.from('books').delete().eq('id', id);
    if (error) { adminToast('❌ ' + error.message, 'error'); return; }
    adminToast('✅ Book deleted', 'success');
    loadAdminBooks();
    loadDashboard();
  });
}

function confirmDeleteUser(id, email) {
  openConfirm('⚠️', 'Remove User', `Remove user "${email}"?`, async () => {
    if (!_adminSb) return;
    const { error } = await _adminSb.from('profiles').delete().eq('id', id);
    if (error) { adminToast('❌ ' + error.message, 'error'); return; }
    adminToast('✅ User removed', 'success');
    loadAdminUsers();
  });
}

/* ── DOMContentLoaded — only runs admin logic on admin.html ── */
document.addEventListener('DOMContentLoaded', function () {
  // admin.html has #loginScreen; index.html does not
  const loginScreen = document.getElementById('loginScreen');
  if (!loginScreen) return;

  const loginBtn   = document.getElementById('loginBtn');
  const loginEmail = document.getElementById('loginEmail');
  const loginPass  = document.getElementById('loginPass');
  const loginErr   = document.getElementById('loginErr');

  // Resume existing session
  if (_adminSb) {
    _adminSb.auth.getSession().then(({ data }) => {
      if (data?.session?.user) {
        _adminCurrentUser = data.session.user;
        showAdminApp(_adminCurrentUser);
      }
    });
  }

  if (loginBtn) {
    loginBtn.addEventListener('click', async function () {
      const email    = loginEmail?.value?.trim();
      const password = loginPass?.value;
      if (!email || !password) {
        if (loginErr) loginErr.textContent = 'Please enter email and password.';
        return;
      }
      loginBtn.disabled    = true;
      loginBtn.textContent = 'Signing in…';
      if (loginErr) loginErr.textContent = '';

      const result = await doAdminLogin(email, password);

      loginBtn.disabled    = false;
      loginBtn.textContent = 'Sign In';

      if (!result.ok) {
        if (loginErr) loginErr.textContent = 'Login failed: ' + result.error;
        return;
      }
      showAdminApp(result.user);
    });
  }

  if (loginPass) {
    loginPass.addEventListener('keydown', e => {
      if (e.key === 'Enter' && loginBtn) loginBtn.click();
    });
  }
});

console.log('✅ Admin JS loaded');