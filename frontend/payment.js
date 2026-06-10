/* ============================================================
   PAYMENT.JS — Payment processing & Supabase integration
   ============================================================ */

function getApiBase() {
  const base = window.API_BASE || window.VITE_API_BASE || '';
  return base.replace(/\/+$/, '');
}

async function getPaymentHeaders() {
  let token = currentUser?.access_token;

  if (!token && window._sb?.auth) {
    const { data } = await window._sb.auth.getSession();
    token = data?.session?.access_token;

    if (token && data?.session?.user) {
      currentUser = {
        ...data.session.user,
        access_token: token
      };
    }
  }

  if (!token) {
    throw new Error('Please login again before payment');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
}

function addToCart(bookId, bookName, bookPrice) {
  if (!currentUser) {
    showToast('⚠️ Please sign in first', 'error');
    show('signin', null);
    return;
  }

  const price = parseInt(String(bookPrice).replace(/[^\d]/g, ''), 10) || 499;

  const foundBook =
    (window._books || []).find(b => String(b.id) === String(bookId) || b.title === bookName || b.name === bookName) ||
    (bookData || []).find(b => String(b.id) === String(bookId) || b.name === bookName || b.title === bookName);

  cartItem = {
    bookId: foundBook?.id || bookId || null,
    name: bookName,
    price
  };

  updatePaymentSummary(bookName, price);
  showToast('✅ Added to cart: ' + bookName, 'success');
  show('payment', null);
}

function updatePaymentSummary(bookName, price) {
  const basePrice = Math.round(price / 1.18);
  const gst = price - basePrice;
  const total = price;

  document.getElementById('cartBookName').textContent = bookName;
  document.getElementById('cartBookPrice').textContent = '₹' + basePrice;
  document.getElementById('cartGST').textContent = 'incl. ₹' + gst;
  document.getElementById('cartTotal').textContent = '₹' + total;

  const payButton = document.querySelector('#payment .btn-pay');
  if (payButton) {
    payButton.textContent = `💳 Pay ₹${total} with Razorpay`;
  }
}

async function processPayment() {
  const name = document.getElementById('payName').value.trim();
  const email = document.getElementById('payEmail').value.trim();

  if (!name || !email) {
    showToast('⚠️ Please fill in name and email', 'error');
    return;
  }

  if (!validateEmail(email)) {
    showToast('⚠️ Invalid email', 'error');
    return;
  }

  if (!cartItem?.name || !cartItem?.bookId) {
    showToast('⚠️ No book selected', 'error');
    show('books', null);
    return;
  }

  try {
    showToast('💳 Creating Razorpay order…', 'success');

    const apiBase = getApiBase();
    const headers = await getPaymentHeaders();

    const url = `${apiBase}/payments/create-order`;
    console.log('[payment] create-order URL:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 'individual_book',
        bookId: cartItem.bookId
      })
    });

    const text = await response.text();
    let result;

    try {
      result = JSON.parse(text);
    } catch {
      throw new Error('Backend returned non-JSON response: ' + text.slice(0, 120));
    }

    if (!response.ok || result.error) {
      throw new Error(result?.error?.message || result?.message || 'Failed to create payment order');
    }

    const order = result.data;
    if (!order?.orderId) {
      throw new Error('Payment order unavailable');
    }

    openRazorpayCheckout(order, name, email);
  } catch (e) {
    console.error('Payment error:', e);
    showToast('❌ Payment failed: ' + e.message, 'error');
  }
}

function openRazorpayCheckout(order, name, email) {
  if (typeof Razorpay === 'undefined') {
    showToast('❌ Razorpay SDK not loaded', 'error');
    return;
  }

  const options = {
    key: order.keyId,
    amount: order.amount,
    currency: order.currency || 'INR',
    name: 'LinguaFolio',
    description: cartItem.name,
    order_id: order.orderId,
    prefill: { name, email },
    theme: { color: '#c9922a' },
    handler: async function (response) {
      if (!response.razorpay_payment_id || !response.razorpay_signature) {
        showToast('❌ Payment was not completed', 'error');
        return;
      }

      await verifyRazorpayPayment(response);
    },
    modal: {
      ondismiss: function () {
        showToast('Payment cancelled', 'error');
      }
    }
  };

  const rzp = new Razorpay(options);
  rzp.open();
}

async function verifyRazorpayPayment(payload) {
  try {
    showToast('🔎 Verifying payment…', 'success');

    const apiBase = getApiBase();
    const headers = await getPaymentHeaders();

    const url = `${apiBase}/payments/verify`;
    console.log('[payment] verify URL:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        razorpayOrderId: payload.razorpay_order_id,
        razorpayPaymentId: payload.razorpay_payment_id,
        razorpaySignature: payload.razorpay_signature,
        bookId: cartItem.bookId
      })
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(result?.error?.message || result?.message || 'Payment verification failed');
    }

    showSuccessModal(payload.razorpay_payment_id);
  } catch (e) {
    console.error('Payment verification failed:', e);
    showToast('❌ Payment verification failed: ' + e.message, 'error');
  }
}

function showSuccessModal(txId) {
  const overlay = document.getElementById('successOverlay');
  document.getElementById('txIdDisplay').textContent = 'Transaction ID: ' + txId;
  overlay.classList.add('open');
}

function closeSuccess() {
  const overlay = document.getElementById('successOverlay');
  overlay.classList.remove('open');

  cartItem = { bookId: null, name: '', price: '' };
  document.getElementById('payName').value = '';
  document.getElementById('payEmail').value = '';

  showToast('✅ Welcome to your library!', 'success');
  show('profile', null);
}

window.addToCart = addToCart;
window.processPayment = processPayment;
window.closeSuccess = closeSuccess;

console.log('✅ Payment module initialized');