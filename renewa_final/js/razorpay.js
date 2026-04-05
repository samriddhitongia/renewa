/* ============================================================
   RENEWA — Razorpay Payment Helper
   Handles both:
     1. Wallet Top-Up (any user role)
     2. Energy Purchase (consumer — replaces old wallet-deduct flow)
   ============================================================ */

const PAYMENT_API = 'http://localhost:5000/api/payment';

/**
 * Opens Razorpay checkout for WALLET TOP-UP.
 * @param {number} amount – INR amount to add to wallet
 */
async function razorpayWalletTopup(amount) {
  const token = getToken();
  const user  = Session.get();

  if (!token || !user) {
    showToast('Login Required', 'Please login first');
    setTimeout(() => location.href = 'auth.html', 1200);
    return;
  }

  try {
    // 1. Create order on backend
    const orderRes = await fetch(`${PAYMENT_API}/create-order`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body:    JSON.stringify({ amount, purpose: 'wallet_topup' })
    });
    const order = await orderRes.json();
    if (!orderRes.ok) throw new Error(order.message);

    // 2. Open Razorpay checkout
    openRazorpay({
      orderId:  order.orderId,
      amount:   order.amount,
      currency: order.currency,
      keyId:    order.keyId,
      name:     user.name || 'User',
      email:    user.email || '',
      description: `Wallet Top-Up ₹${amount}`,
      onSuccess: async (paymentData) => {
        // 3. Verify on backend and credit wallet
        const verRes = await fetch(`${PAYMENT_API}/verify`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body:    JSON.stringify({
            ...paymentData,
            purpose: 'wallet_topup',
            amount
          })
        });
        const verData = await verRes.json();
        if (!verRes.ok) throw new Error(verData.message);

        // Update session wallet
        Session.set({ walletBalance: verData.walletBalance });

        showToast('Wallet Topped Up ✅', `₹${amount} added · New balance ₹${verData.walletBalance.toFixed(2)}`);

        // Refresh page data if function exists
        if (typeof loadDashboard === 'function') loadDashboard();
        if (typeof updateWalletDisplay === 'function') updateWalletDisplay(verData.walletBalance);
      }
    });

  } catch (err) {
    console.error(err);
    showToast('Payment Error', err.message || 'Could not initiate payment');
  }
}


/**
 * Opens Razorpay checkout for ENERGY PURCHASE.
 * @param {string} listingId
 * @param {number} kwh
 * @param {number} totalAmount – INR total (kwh × price)
 * @param {function} onComplete – callback after success
 */
async function razorpayEnergyPurchase(listingId, kwh, totalAmount, onComplete) {
  const token = getToken();
  const user  = Session.get();

  if (!token || !user) {
    showToast('Login Required', 'Please login first');
    setTimeout(() => location.href = 'auth.html', 1200);
    return;
  }

  try {
    // 1. Create order
    const orderRes = await fetch(`${PAYMENT_API}/create-order`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body:    JSON.stringify({ amount: totalAmount, purpose: 'energy_purchase', listingId, kwh })
    });
    const order = await orderRes.json();
    if (!orderRes.ok) throw new Error(order.message);

    // 2. Open Razorpay checkout
    openRazorpay({
      orderId:  order.orderId,
      amount:   order.amount,
      currency: order.currency,
      keyId:    order.keyId,
      name:     user.name || 'User',
      email:    user.email || '',
      description: `${kwh} kWh Energy Purchase`,
      onSuccess: async (paymentData) => {
        // 3. Verify & complete purchase
        const verRes = await fetch(`${PAYMENT_API}/verify`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body:    JSON.stringify({
            ...paymentData,
            purpose: 'energy_purchase',
            amount:  totalAmount,
            listingId,
            kwh
          })
        });
        const verData = await verRes.json();
        if (!verRes.ok) throw new Error(verData.message);

        showToast('Purchase Successful ✅', `${kwh} kWh purchased · ₹${totalAmount} paid`);

        if (typeof onComplete === 'function') onComplete(verData);
      }
    });

  } catch (err) {
    console.error(err);
    showToast('Payment Error', err.message || 'Could not initiate payment');
  }
}


/**
 * Core helper — opens Razorpay modal.
 * @param {object} opts
 */
function openRazorpay({ orderId, amount, currency, keyId, name, email, description, onSuccess }) {
  const options = {
    key:         keyId,
    amount:      amount,        // in paise
    currency:    currency || 'INR',
    name:        'Renewa',
    description: description,
    image:       '/favicon.ico',  // optional logo
    order_id:    orderId,
    prefill: {
      name:  name,
      email: email
    },
    theme: { color: '#22c55e' }, // Renewa green
    handler: function (response) {
      // response = { razorpay_payment_id, razorpay_order_id, razorpay_signature }
      onSuccess({
        razorpay_order_id:   response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature:  response.razorpay_signature
      });
    },
    modal: {
      ondismiss: function () {
        showToast('Payment Cancelled', 'You closed the payment window');
      }
    }
  };

  const rzp = new window.Razorpay(options);
  rzp.on('payment.failed', function (response) {
    showToast('Payment Failed', response.error.description || 'Payment was not completed');
    console.error('Razorpay failed:', response.error);
  });
  rzp.open();
}
