/**
 * Renewa — Razorpay Payment Routes
 * POST /api/payment/create-order   → create a Razorpay order
 * POST /api/payment/verify         → verify signature & credit wallet / complete purchase
 */

const router   = require('express').Router();
const Razorpay = require('razorpay');
const crypto   = require('crypto');
const jwt      = require('jsonwebtoken');
const User     = require('../models/User');
const Listing  = require('../models/Listing');
const Transaction = require('../models/Transaction');

// ── Auth middleware ─────────────────────────────────────────────
function reqAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ message: 'Login required' });
  try {
    req.user = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// ── Razorpay instance ───────────────────────────────────────────
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ── POST /api/payment/create-order ─────────────────────────────
// body: { amount, purpose, listingId?, kwh? }
// purpose: "wallet_topup" | "energy_purchase"
router.post('/create-order', reqAuth, async (req, res) => {
  try {
    const { amount, purpose, listingId, kwh } = req.body;

    if (!amount || amount <= 0)
      return res.status(400).json({ message: 'Invalid amount' });

    // Razorpay expects paise (1 INR = 100 paise)
    const amountPaise = Math.round(+amount * 100);

    const options = {
      amount:   amountPaise,
      currency: 'INR',
      receipt:  `rcpt_${Date.now()}`,
      notes: {
        purpose,
        userId:    req.user.id,
        listingId: listingId || '',
        kwh:       kwh       || ''
      }
    };

    const order = await razorpay.orders.create(options);

    res.json({
      orderId:   order.id,
      amount:    order.amount,
      currency:  order.currency,
      keyId:     process.env.RAZORPAY_KEY_ID,
      purpose,
      listingId: listingId || null,
      kwh:       kwh       || null
    });

  } catch (err) {
    console.error('Razorpay create-order error:', err);
    res.status(500).json({ message: 'Could not create payment order' });
  }
});


// ── POST /api/payment/verify ────────────────────────────────────
// body: { razorpay_order_id, razorpay_payment_id, razorpay_signature,
//         purpose, amount, listingId?, kwh? }
router.post('/verify', reqAuth, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      purpose,
      amount,       // in INR (not paise)
      listingId,
      kwh
    } = req.body;

    // ── 1. Verify signature ─────────────────────────────────────
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature)
      return res.status(400).json({ message: 'Payment verification failed' });

    // ── 2. Handle based on purpose ──────────────────────────────

    // ── WALLET TOP-UP ───────────────────────────────────────────
    if (purpose === 'wallet_topup') {
      const topupAmount = +amount;
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      user.walletBalance = (user.walletBalance || 0) + topupAmount;
      await user.save();

      return res.json({
        message:       'Wallet topped up successfully',
        walletBalance: user.walletBalance,
        added:         topupAmount
      });
    }

    // ── ENERGY PURCHASE ─────────────────────────────────────────
    if (purpose === 'energy_purchase') {
      const purchaseKwh = +kwh;

      const listing = await Listing.findById(listingId);
      if (!listing || !listing.active)
        return res.status(404).json({ message: 'Listing unavailable' });

      const qty   = Math.min(purchaseKwh, listing.kwh);
      const total = +(qty * listing.price).toFixed(2);

      const buyer = await User.findById(req.user.id);
      if (!buyer) return res.status(404).json({ message: 'User not found' });

      // Update buyer stats (payment already collected via Razorpay)
      buyer.totalEnergyPurchased = (buyer.totalEnergyPurchased || 0) + qty;
      await buyer.save();

      // Credit seller wallet
      const seller = await User.findById(listing.sellerId);
      if (seller) {
        seller.walletBalance  = (seller.walletBalance || 0) + total;
        seller.totalEnergySold = (seller.totalEnergySold || 0) + qty;
        await seller.save();
      }

      // Update listing stock
      listing.kwh  -= qty;
      listing.sold += qty;
      if (listing.kwh <= 0) listing.active = false;
      await listing.save();

      // Record transaction
      await Transaction.create({
        buyerId:     buyer._id,
        buyerName:   buyer.name,
        sellerId:    listing.sellerId,
        sellerName:  listing.seller,
        listingId:   listing._id,
        type:        listing.type,
        kwh:         qty,
        pricePerKwh: listing.price,
        total,
        razorpayOrderId:   razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id
      });

      return res.json({
        message:       'Purchase successful',
        total,
        walletBalance: buyer.walletBalance
      });
    }

    res.status(400).json({ message: 'Unknown payment purpose' });

  } catch (err) {
    console.error('Razorpay verify error:', err);
    res.status(500).json({ message: 'Server error during payment verification' });
  }
});

module.exports = router;
