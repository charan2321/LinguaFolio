/* ============================================================
   PROFILE.JS — User profile and purchases management
   ============================================================ */

// ===== LOAD MY BOOKS (PURCHASES) =====
async function loadMyBooks() {
  if (!currentUser) {
    console.log('User not logged in, skipping loadMyBooks');
    return;
  }

  try {
    // Stage 1: Try full join query (requires books FK in Supabase)
    const { data, error } = await _sb
      .from('purchases')
      .select(`
        id,
        book_id,
        price_paise,
        created_at,
        books (
          id,
          title,
          language,
          level
        )
      `)
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (!error) {
      renderMyBooks(data || []);
      return;
    }

    // Stage 2: FK join failed (400) — try without join
    console.warn('[Profile] Join query failed, trying simple query:', error.message);
    const { data: simple, error: simpleErr } = await _sb
      .from('purchases')
      .select('id, book_id, price_paise, created_at')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (simpleErr) {
      console.error('[Profile] Error fetching purchases:', simpleErr);
      showToast('⚠️ Could not load your books', 'error');
      renderMyBooks([]);
      return;
    }

    renderMyBooks(simple || []);

  } catch (e) {
    console.error('[Profile] Load my books exception:', e);
    renderMyBooks([]);
  }
}

// ===== RENDER MY BOOKS =====
function renderMyBooks(purchases) {
  const list = document.getElementById('myBooksList');
  if (!list) return;
  
  if (!purchases || purchases.length === 0) {
    list.innerHTML = '<div style="color:#666;padding:20px;text-align:center">📚 No books yet. <a onclick="show(\'books\',null)">Browse the library</a></div>';
    return;
  }
  
  list.innerHTML = '';
  
  purchases.forEach(purchase => {
    const bookName = purchase.books?.title || 'Unknown Book';
    const lang = purchase.books?.language || 'Language';
    const purchaseDate = new Date(purchase.created_at).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric'
    });
    
    // Map language to emoji
    const langEmojiMap = {
      'French': '🇫🇷',
      'Japanese': '🇯🇵',
      'Spanish': '🇪🇸',
      'German': '🇩🇪',
      'Italian': '🇮🇹',
      'Mandarin': '🇨🇳',
      'Portuguese': '🇧🇷',
      'Arabic': '🇦🇪',
      'Korean': '🇰🇷',
      'Hindi': '🇮🇳',
      'Russian': '🇷🇺',
      'Greek': '🇬🇷'
    };
    
    const emoji = langEmojiMap[lang] || '📚';
    
    const colorMap = {
      'French': '#e8f5e9',
      'Japanese': '#fff3e0',
      'Spanish': '#fce4ec',
      'German': '#e3f2fd',
      'Italian': '#f3e5f5',
      'Mandarin': '#e0f2f1'
    };
    
    const bgColor = colorMap[lang] || '#f5f5f5';
    
    const item = document.createElement('div');
    item.className = 'purchase-item';
    item.style.backgroundColor = bgColor;
    item.innerHTML = `
      <div class="pi-icon" style="background:${bgColor}">${emoji}</div>
      <div class="pi-info">
        <h4>${bookName}</h4>
        <small>Purchased · ${purchaseDate}</small>
      </div>
    `;
    
    list.appendChild(item);
  });
}

// ===== SAVE SETTINGS =====
async function saveSettings() {
  if (!currentUser) {
    showToast('⚠️ Please sign in first', 'error');
    return;
  }
  
  const fullName = document.getElementById('settingsName').value.trim();
  
  if (!fullName) {
    showToast('⚠️ Please enter your name', 'error');
    return;
  }
  
  try {
    // Update profile in Supabase. Email is read-only and not updated here.
    const { data, error } = await _sb
      .from('profiles')
      .update({
        full_name: fullName,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentUser.id)
      .select();
    
    if (error) {
      console.error('Save settings error:', error);
      showToast('❌ ' + (error.message || 'Failed to save'), 'error');
      return;
    }
    
    // Update local display
    document.getElementById('profileName').textContent = fullName;
    showToast('✅ Settings saved successfully', 'success');
    
  } catch (e) {
    console.error('Save settings exception:', e);
    showToast('❌ Error: ' + e.message, 'error');
  }
}

// ===== INTEGRATION WITH AUTH =====
// Modify setLoggedIn to call loadMyBooks
const originalSetLoggedIn = window.setLoggedIn;
window.setLoggedIn = function(user) {
  originalSetLoggedIn.call(this, user);
  
  // Load user's books after setting logged in state
  if (typeof loadMyBooks === 'function') {
    setTimeout(() => {
      loadMyBooks();
    }, 500);
  }
};

console.log('✅ Profile module initialized');
