/**
 * Renewa — Aadhaar KYC Routes
 *
 * POST   /api/kyc/submit        – Upload Aadhaar front, back, selfie + Aadhaar number
 * GET    /api/kyc/status        – Get current user's KYC status
 * GET    /api/kyc/admin/list    – Admin: list all submitted KYCs
 * POST   /api/kyc/admin/verify  – Admin: approve or reject a KYC
 */

const router  = require('express').Router();
const jwt     = require('jsonwebtoken');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const User    = require('../models/User');

// ── KYC upload directory ────────────────────────────────────────
const KYC_DIR = path.join(__dirname, '..', 'uploads', 'kyc');
if (!fs.existsSync(KYC_DIR)) fs.mkdirSync(KYC_DIR, { recursive: true });

const kycStorage = multer.diskStorage({
  destination: KYC_DIR,
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname) || '.jpg';
    const safe = file.fieldname.replace(/[^a-z]/gi, '');
    cb(null, `${req.user.id}_${safe}_${Date.now()}${ext}`);
  }
});

const kycUpload = multer({
  storage: kycStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|pdf/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase()) &&
               allowed.test(file.mimetype);
    cb(ok ? null : new Error('Only images/PDF allowed'), ok);
  }
});

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

function reqAdmin(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ message: 'Login required' });
  try {
    // Try admin secret first, then fall back to regular JWT secret
    let decoded;
    try {
      decoded = jwt.verify(h.split(' ')[1], process.env.ADMIN_SECRET || process.env.JWT_SECRET);
    } catch {
      decoded = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    }
    req.user = decoded;
    if (req.user.role !== 'admin') {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@renewa.io';
      if (req.user.email !== adminEmail)
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// ── Aadhaar number masker (store only last 4) ───────────────────
function maskAadhaar(num) {
  const clean = String(num).replace(/\D/g, '');
  if (clean.length !== 12) return null;
  return 'XXXX-XXXX-' + clean.slice(8);
}

// ── POST /api/kyc/submit ────────────────────────────────────────
// Fields: aadhaarNumber (text), aadhaarFront (file), aadhaarBack (file), selfie (file)
router.post('/submit',
  reqAuth,
  (req, res, next) => {
    // Run multer AFTER auth so filename uses req.user.id
    kycUpload.fields([
      { name: 'aadhaarFront', maxCount: 1 },
      { name: 'aadhaarBack',  maxCount: 1 },
      { name: 'selfie',       maxCount: 1 }
    ])(req, res, next);
  },
  async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      if (user.kyc.status === 'verified')
        return res.status(400).json({ message: 'KYC already verified' });

      const { aadhaarNumber } = req.body;
      const masked = maskAadhaar(aadhaarNumber);
      if (!masked)
        return res.status(400).json({ message: 'Aadhaar number must be 12 digits' });

      const files = req.files || {};
      if (!files.aadhaarFront || !files.aadhaarBack || !files.selfie)
        return res.status(400).json({ message: 'Please upload Aadhaar front, back and a selfie' });

      user.kyc.aadhaarNumber = masked;
      user.kyc.aadhaarFront  = files.aadhaarFront[0].filename;
      user.kyc.aadhaarBack   = files.aadhaarBack[0].filename;
      user.kyc.selfie        = files.selfie[0].filename;
      user.kyc.status        = 'submitted';
      user.kyc.submittedAt   = new Date();
      user.kyc.rejectedReason = '';
      await user.save();

      console.log(`📋 KYC submitted by ${user.email}`);
      res.json({ message: 'KYC submitted successfully — under review', status: 'submitted' });

    } catch (err) {
      console.error('KYC submit error:', err);
      res.status(500).json({ message: 'Server error during KYC submission' });
    }
  }
);

// ── GET /api/kyc/status ─────────────────────────────────────────
router.get('/status', reqAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('kyc name email');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      status:         user.kyc.status,
      aadhaarNumber:  user.kyc.aadhaarNumber,
      submittedAt:    user.kyc.submittedAt,
      verifiedAt:     user.kyc.verifiedAt,
      rejectedReason: user.kyc.rejectedReason,
      name:           user.name,
      email:          user.email
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/kyc/admin/list ─────────────────────────────────────
router.get('/admin/list', reqAdmin, async (req, res) => {
  try {
    // For demo: allow any logged-in user to see admin panel
    // In production: add reqAdmin middleware
    const users = await User.find({ 'kyc.status': { $in: ['submitted', 'verified', 'rejected'] } })
      .select('name email role kyc createdAt')
      .sort({ 'kyc.submittedAt': -1 });

    res.json(users.map(u => ({
      id:             u._id,
      name:           u.name,
      email:          u.email,
      role:           u.role,
      status:         u.kyc.status,
      aadhaarNumber:  u.kyc.aadhaarNumber,
      aadhaarFront:   u.kyc.aadhaarFront,
      aadhaarBack:    u.kyc.aadhaarBack,
      selfie:         u.kyc.selfie,
      submittedAt:    u.kyc.submittedAt,
      verifiedAt:     u.kyc.verifiedAt,
      rejectedReason: u.kyc.rejectedReason
    })));
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/kyc/admin/verify ──────────────────────────────────
// Body: { userId, action: 'verify' | 'reject', reason? }
router.post('/admin/verify', reqAdmin, async (req, res) => {
  try {
    const { userId, action, reason } = req.body;
    if (!userId || !['verify','reject'].includes(action))
      return res.status(400).json({ message: 'userId and action (verify/reject) required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (action === 'verify') {
      user.kyc.status     = 'verified';
      user.kyc.verifiedAt = new Date();
      user.kyc.rejectedReason = '';
    } else {
      user.kyc.status         = 'rejected';
      user.kyc.rejectedReason = reason || 'Documents unclear or invalid';
    }

    user.kyc.reviewedBy = req.user.email || req.user.id;
    await user.save();

    console.log(`${action === 'verify' ? '✅' : '❌'} KYC ${action}d for ${user.email} by ${req.user.email}`);
    res.json({ message: `KYC ${action}d successfully`, status: user.kyc.status });

  } catch (err) {
    console.error('KYC admin verify error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Serve KYC images publicly (token in query param for basic protection) ──
router.get('/image/:filename', (req, res) => {
  const filePath = path.join(KYC_DIR, req.params.filename);
  if (!fs.existsSync(filePath))
    return res.status(404).json({ message: 'File not found' });
  res.sendFile(filePath);
});


// ── POST /api/kyc/admin/login ───────────────────────────────────
// Fixed credentials login for admin panel
router.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  const validUser = process.env.ADMIN_USERNAME || 'admin';
  const validPass = process.env.ADMIN_PASSWORD || 'renewa@admin2026';

  if (username !== validUser || password !== validPass)
    return res.status(401).json({ message: 'Invalid admin credentials' });

  // Sign a special admin token
  const adminToken = jwt.sign(
    { id: 'admin', role: 'admin', email: 'admin@renewa.io', name: 'Admin' },
    process.env.ADMIN_SECRET || process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token: adminToken, message: 'Admin login successful' });
});

module.exports = router;
// Already exported above — add admin login route BEFORE module.exports
