/* ============================================================
   PAYMENT.JS — Payment processing & Supabase integration
   ============================================================ */

// ===== ADD TO CART =====
function addToCart(bookId, bookName, bookPrice) {
  if (!currentUser) {
    showToast('⚠️ Please sign in first', 'error');
    show('signin', null);
    return;
  }

  const price = parseInt(bookPrice.replace('₹', '')) || 499;
  const book = bookData.find((b) => b.id === bookId || b.name === bookName);

  cartItem = {
    bookId: bookId || book?.id || null,
    name: bookName,
    price
  };

  updatePaymentSummary(bookName, price);

  showToast('✅ Added to cart: ' + bookName, 'success');
  show('payment', null);
}

// ===== UPDATE PAYMENT SUMMARY =====
function updatePaymentSummary(bookName, price) {
  // Price already includes GST. Show base price and included GST so UI matches charge.
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

// ===== PROCESS PAYMENT =====
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

  if (!cartItem.name) {
    showToast('⚠️ No book in cart', 'error');
    return;
  }

  if (!cartItem.bookId) {
    showToast('No book selected — go to Books and click Buy', 'error');
    setTimeout(() => show('books', null), 1200);
    return;
  }

  try {
    showToast('💳 Creating Razorpay order…', 'success');

    const response = await fetch(window.API_BASE + '/payments/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(currentUser?.access_token ? { Authorization: `Bearer ${currentUser.access_token}` } : {})
      },
      body: JSON.stringify({
        type: 'individual_book',
        bookId: cartItem.bookId || bookData.find((b) => b.name === cartItem.name)?.id
      })
    });

    const result = await response.json();
    if (!response.ok || result.error) {
      const message = result?.error?.message || result?.message || 'Failed to create payment order';
      throw new Error(message);
    }

    const order = result.data;
    if (!order || !order.orderId) {
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
    currency: order.currency,
    name: 'LinguaFolio',
    description: cartItem.name,
    order_id: order.orderId,
    prefill: {
      name,
      email
    },
    theme: {
      color: '#c9922a'
    },
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

    const response = await fetch(window.API_BASE + '/payments/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(currentUser?.access_token ? { Authorization: `Bearer ${currentUser.access_token}` } : {})
      },
      body: JSON.stringify({
        razorpayOrderId: payload.razorpay_order_id,
        razorpayPaymentId: payload.razorpay_payment_id,
        razorpaySignature: payload.razorpay_signature
      })
    });

    const result = await response.json();
    if (!response.ok || result.error) {
      throw new Error(result?.error?.message || result?.message || 'Payment verification failed');
    }

    // Backend performs fulfillment and writes purchases. Do not call savePurchase from frontend.
    showSuccessModal(payload.razorpay_payment_id);
  } catch (e) {
    console.error('Payment verification failed:', e);
    showToast('❌ Payment verification failed: ' + e.message, 'error');
  }
}

// Purchases are recorded server-side. Frontend no longer writes purchases.

// ===== SUCCESS MODAL =====
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

console.log('✅ Payment module initialized');
