/* ============================================================
   APP.JS — Navigation, utilities, and event listeners
   ============================================================ */

// ===== STATE VARIABLES =====
let currentUser = null;
let selectedUpiApp = 'gpay';
let cartItem = { bookId: null, name: '', price: '' };
// WARNING: These are fallback IDs only. Real UUIDs come from Supabase.
// Payments will fail if this fallback data is used — ensure Supabase books table is seeded.
let bookData = [
  { id: 1, name: 'Bonjour Paris', lang: 'French', level: 'Beginner', price: 499, color1: '#2c4a2c', color2: '#5a7a5c' },
  { id: 2, name: 'Nihongo Start', lang: 'Japanese', level: 'Beginner', price: 649, color1: '#7a3020', color2: '#b84c1a' },
  { id: 3, name: 'Viva España', lang: 'Spanish', level: 'Intermediate', price: 549, color1: '#1a3050', color2: '#2a6080' },
  { id: 4, name: 'Deutsch Perfekt', lang: 'German', level: 'Advanced', price: 699, color1: '#4a2c1a', color2: '#8a5c2a' },
  { id: 5, name: 'Ciao Italia!', lang: 'Italian', level: 'Beginner', price: 479, color1: '#5a2c1a', color2: '#a84c1a' },
  { id: 6, name: 'Hello China', lang: 'Mandarin', level: 'Beginner', price: 599, color1: '#2c3a5a', color2: '#5a7aa0' }
];

// ===== PAGE NAVIGATION =====
function show(pageId, navLink) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  // Show requested page
  const page = document.getElementById(pageId);
  if (page) {
    page.classList.add('active');
    window.scrollTo(0, 0);
  }
  
  // Update nav links
  if (navLink) {
    document.querySelectorAll('.nav-links li a').forEach(a => a.classList.remove('active'));
    navLink.classList.add('active');
  }
}

// ===== MOBILE MENU =====
function toggleMenu() {
  const menu = document.getElementById('mobileMenu');
  menu.classList.toggle('open');
}

// ===== TOAST NOTIFICATION =====
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// ===== PDF PREVIEW CANVAS =====
function drawFakePdfPage(canvasId, color1, color2) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  const ctx = canvas.getContext('2d');
  
  // Gradient background
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, color1);
  grad.addColorStop(1, color2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Add some texture
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 50, 50);
  }
}

// ===== PDF MODAL =====
function openPdfModal(bookTitle, bookPrice) {
  const modal = document.getElementById('pdfModal');
  document.getElementById('pdfModalTitle').textContent = bookTitle;
  document.getElementById('pdfModalPrice').textContent = bookPrice;
  
  // Draw sample PDF pages
  const colors = [
    { color1: '#2c4a2c', color2: '#5a7a5c' },
    { color1: '#7a3020', color2: '#b84c1a' },
    { color1: '#1a3050', color2: '#2a6080' },
    { color1: '#4a2c1a', color2: '#8a5c2a' },
    { color1: '#5a2c1a', color2: '#a84c1a' },
    { color1: '#2c3a5a', color2: '#5a7aa0' }
  ];
  const idx = bookData.findIndex(b => b.name === bookTitle) || 0;
  const c = colors[idx] || colors[0];
  
  drawFakePdfPage('pdfModalCanvas', c.color1, c.color2);
  modal.classList.add('open');
  
  // Set buy button action — lookup real book id from cached Supabase data
  document.getElementById('pdfModalBuy').onclick = () => {
    closePdfModal();
    const found = (window._books || []).find(b => b.title === bookTitle || b.name === bookTitle);
    const id = found?.id ?? (bookData.find(b => b.name === bookTitle)?.id ?? null);
    addToCart(id, bookTitle, bookPrice);
  };
}

function closePdfModal() {
  const modal = document.getElementById('pdfModal');
  modal.classList.remove('open');
}

// ===== CLOSE SUCCESS MODAL =====
function closeSuccess() {
  console.log('[app] 🎯 closeSuccess called');
  
  const overlay = document.getElementById('successOverlay');
  if (overlay) {
    overlay.classList.remove('open');
    console.log('[app] ✅ Success overlay closed');
  }
  
  // Reset cart
  window.cartItem = { bookId: null, name: '', price: '' };
  
  // Navigate to profile (my books)
  console.log('[app] 🔄 Navigating to profile page...');
  show('profile', null);
  
  // Reload my books if logged in
  if (currentUser && typeof loadMyBooks === 'function') {
    console.log('[app] 📚 Reloading user books...');
    setTimeout(() => loadMyBooks(), 500);
  }
}

// ===== BOOK FILTERING =====
function filterActive(btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  
  // Reload books with filter (implemented in books.js)
  if (typeof loadBooks === 'function') {
    const filterText = btn.textContent.trim();
    loadBooks(filterText);
  }
}

// ===== FORM VALIDATION =====
function clearErr(fieldId) {
  const field = document.getElementById(fieldId);
  const err = document.getElementById(fieldId + 'Err');
  if (field) field.classList.remove('error', 'ok');
  if (err) err.classList.remove('show');
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validateSignupEmail() {
  const email = document.getElementById('signupEmail').value;
  const err = document.getElementById('signupEmailErr');
  if (validateEmail(email)) {
    document.getElementById('signupEmail').classList.add('ok');
    if (err) err.classList.remove('show');
  } else if (email.length > 0) {
    document.getElementById('signupEmail').classList.add('error');
    if (err) err.classList.add('show');
  }
}

function checkStrength(pwd) {
  const fill = document.getElementById('strengthFill');
  const text = document.getElementById('strengthText');
  
  let strength = 0;
  if (pwd.length >= 8) strength++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
  if (/[0-9]/.test(pwd)) strength++;
  if (/[!@#$%^&*]/.test(pwd)) strength++;
  
  const colors = ['#e74c3c', '#e67e22', '#f1c40f', '#27ae60'];
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  
  fill.style.width = (strength * 25) + '%';
  fill.style.background = colors[strength - 1] || '#aaa';
  text.textContent = labels[strength - 1] || '';
}

function toggleEye(fieldId, btn) {
  const field = document.getElementById(fieldId);
  if (field.type === 'password') {
    field.type = 'text';
    btn.textContent = '🙈';
  } else {
    field.type = 'password';
    btn.textContent = '👁';
  }
}

// ===== UPI FUNCTIONS =====
function selectUpiApp(elem, appName) {
  document.querySelectorAll('.upi-app').forEach(a => a.classList.remove('sel'));
  elem.classList.add('sel');
  selectedUpiApp = appName;
  // UPI handled by Razorpay checkout modal — no custom UPI flow needed
}

// verifyUpiId removed; UPI verification handled by Razorpay

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', () => {
  // Draw fake PDF canvases for all books
  for (let i = 1; i <= 6; i++) {
    const book = bookData[i - 1];
    drawFakePdfPage(`pdf-canvas-${i}`, book.color1, book.color2);
  }
  
  // Password field eye toggles
  const eyeBtns = document.querySelectorAll('.eye-btn');
  eyeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
    });
  });
  
  // Password confirmation
  const pwd = document.getElementById('signupPwd');
  const pwd2 = document.getElementById('signupPwd2');
  if (pwd2) {
    pwd2.addEventListener('input', () => {
      if (pwd.value !== pwd2.value && pwd2.value.length > 0) {
        pwd2.classList.add('error');
        document.getElementById('signupPwd2Err').classList.add('show');
      } else {
        pwd2.classList.remove('error');
        document.getElementById('signupPwd2Err').classList.remove('show');
      }
    });
  }
  
  console.log('✅ App initialized');
});

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const pdf = document.getElementById('pdfModal');
    if (pdf) pdf.classList.remove('open');
    const success = document.getElementById('successOverlay');
    if (success) success.classList.remove('open');
  }
});
