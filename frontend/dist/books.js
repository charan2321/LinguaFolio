/* ============================================================
   BOOKS.JS — Dynamic book loading from Supabase
   ============================================================ */

// Cache for books data
window._books = [];

// ===== LOAD BOOKS =====
async function loadBooks(filter = 'All') {
  try {
    // Fetch all books from Supabase
    let query = _sb.from('books').select('*');
    
    // Apply filter if not "All"
    if (filter && filter !== 'All') {
      if (filter === 'Beginner' || filter === 'Intermediate' || filter === 'Advanced') {
        query = query.eq('level', filter);
      } else if (['French', 'Japanese', 'Spanish', 'German', 'Italian', 'Mandarin'].includes(filter)) {
        query = query.eq('language', filter);
      }
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching books:', error);
      showToast('❌ Failed to load books', 'error');
      
      // Fallback to local bookData
      renderBooks(bookData);
      return;
    }
    
    // Cache books
    window._books = data || [];
    
    // Use Supabase data if available, otherwise fallback to local
    const booksToRender = window._books.length > 0 ? window._books : bookData;
    renderBooks(booksToRender);
    
  } catch (e) {
    console.error('Books loading exception:', e);
    // Fallback to local data
    renderBooks(bookData);
  }
}

// ===== RENDER BOOKS =====
function renderBooks(books) {
  const grid = document.getElementById('booksGrid');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  if (!books || books.length === 0) {
    grid.innerHTML = '<div class="empty-state">📚 No books found. Try another filter or check back later.</div>';
    return;
  }
  
  books.forEach((book, idx) => {
    // Map local bookData to book item structure
    const bookItem = document.createElement('div');
    bookItem.className = 'book-item';
    
    const price = typeof book.price === 'number'
      ? book.price
      : typeof book.price_paise === 'number'
      ? book.price_paise / 100
      : 499;
    const priceStr = '₹' + price;
    const title = book.title || book.name;
    const safeTitle = (title || '').replace(/'/g, "\\'");
    const lang = book.language || book.lang;
    const level = book.level;
    const author = book.author || 'Anonymous';
    const stars = book.rating ? '★'.repeat(Math.round(book.rating)) + '☆'.repeat(5 - Math.round(book.rating)) : '★★★★★';
    
    // Map to book colors
    const colorMap = {
      1: { c1: '#2c4a2c', c2: '#5a7a5c' },
      2: { c1: '#7a3020', c2: '#b84c1a' },
      3: { c1: '#1a3050', c2: '#2a6080' },
      4: { c1: '#4a2c1a', c2: '#8a5c2a' },
      5: { c1: '#5a2c1a', c2: '#a84c1a' },
      6: { c1: '#2c3a5a', c2: '#5a7aa0' }
    };
    const colors = colorMap[(idx % 6) + 1] || colorMap[1];
    
    bookItem.innerHTML = `
      <div class="pdf-preview-wrap" oncontextmenu="return false" ondragstart="return false">
        <canvas id="pdf-canvas-db-${idx}" style="width:100%;height:190px;object-fit:cover;filter:blur(6px) brightness(0.7);transform:scale(1.05);pointer-events:none"></canvas>
        <div class="pdf-lock">
          <div class="lock-icon">🔒</div>
          <span>PDF Preview</span>
          <button class="preview-btn" onclick="openPdfModal('${safeTitle}','${priceStr}')">Preview</button>
        </div>
      </div>
      <div class="book-info">
        <div class="book-lang">${lang} · ${level}</div>
        <h3>${title}</h3>
        <div class="author">${author}</div>
        <div class="book-stars">${stars}</div>
        <div class="book-price">
          <span class="price">${priceStr}</span>
          <button class="add-btn" onclick="addToCart('${book.id}','${safeTitle}','${priceStr}')">Buy</button>
        </div>
      </div>
    `;
    
    grid.appendChild(bookItem);
    
    // Draw fake PDF for each book
    setTimeout(() => {
      drawFakePdfPage(`pdf-canvas-db-${idx}`, colors.c1, colors.c2);
    }, 10);
  });
}

// ===== LOAD ON PAGE READY =====
document.addEventListener('DOMContentLoaded', () => {
  // Preload books when app initializes
  if (window._sb) {
    loadBooks();
  } else {
    // Fallback if Supabase not ready yet
    setTimeout(() => loadBooks(), 500);
  }
  
  console.log('✅ Books module initialized');
});
