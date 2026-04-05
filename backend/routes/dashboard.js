const router      = require('express').Router();
const User        = require('../models/User');
const Listing     = require('../models/Listing');
const Transaction = require('../models/Transaction');
const jwt         = require('jsonwebtoken');

function reqAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ message: 'Login required' });
  try { req.user = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ message: 'Invalid token' }); }
}

// ── Consumer stats ─────────────────────────────────────────────
router.get('/consumer', reqAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const listings = await Listing.find({ active: true }).sort({ createdAt: -1 }).limit(6);

    // Consumer's own recent purchases
    const transactions = await Transaction.find({ buyerId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      user,
      listings,
      transactions,
      stats: {
        walletBalance: user.walletBalance,
        totalEnergyPurchased: user.totalEnergyPurchased || 0
      }
    });
  } catch (err) {
    console.error(err); res.status(500).json({ message: 'Server error' });
  }
});

// ── Producer stats ─────────────────────────────────────────────
router.get('/producer', reqAuth, async (req, res) => {
  try {
    const user     = await User.findById(req.user.id).select('-password');
    const listings = await Listing.find({ sellerId: req.user.id }).sort({ createdAt: -1 });
    const active   = listings.filter(l => l.active).length;
    const revenue  = listings.reduce((s, l) => s + (l.sold * l.price), 0);
    const kwhSold  = listings.reduce((s, l) => s + l.sold, 0);

    // Real transactions — sales made on this producer's listings
    const transactions = await Transaction.find({ sellerId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(10);

    // AI price suggestion: avg price of all active listings +5% if any sold
    const allActive = await Listing.find({ active: true });
    let aiPrice = null;
    if (allActive.length) {
      const avgPrice = allActive.reduce((s, l) => s + l.price, 0) / allActive.length;
      const hasSales = allActive.some(l => l.sold > 0);
      aiPrice = +(avgPrice * (hasSales ? 1.07 : 1.0)).toFixed(3);
    }

    res.json({
      user,
      listings,
      transactions,
      stats: {
        active,
        revenue:  revenue.toFixed(2),
        kwhSold,
        total:    listings.length,
        walletBalance: user.walletBalance,
        aiPrice
      }
    });
  } catch (err) {
    console.error(err); res.status(500).json({ message: 'Server error' });
  }
});

// ── Investor stats ─────────────────────────────────────────────
router.get('/investor', reqAuth, async (req, res) => {
  try {
    const user      = await User.findById(req.user.id).select('-password');
    const producers = await User.countDocuments({ role: 'producer' });
    const listings  = await Listing.countDocuments({ active: true });
    const kwhAgg    = await Listing.aggregate([{ $group: { _id: null, total: { $sum: '$sold' } } }]);
    const totalKwh  = kwhAgg[0]?.total || 0;
    res.json({ user, stats: { producers, listings, totalKwh, walletBalance: user.walletBalance } });
  } catch (err) {
    console.error(err); res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
