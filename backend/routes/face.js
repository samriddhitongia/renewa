/**
 * Renewa — Face Recognition Routes
 *
 * POST /api/face/register   – Save face descriptor for logged-in user
 * POST /api/face/login      – Match descriptor against all users, return token
 * GET  /api/face/status     – Check if current user has a face registered
 */

const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');

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

// ── Euclidean distance between two descriptors ─────────────────
function euclidean(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

// ── POST /api/face/register ─────────────────────────────────────
// Body: { descriptor: number[] }  (128 floats from face-api.js)
router.post('/register', reqAuth, async (req, res) => {
  try {
    const { descriptor } = req.body;

    if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128)
      return res.status(400).json({ message: 'Invalid face descriptor — must be 128 floats' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.faceDescriptor = descriptor;
    user.faceRegistered = true;
    await user.save();

    console.log(`✅ Face registered for ${user.email}`);
    res.json({ message: 'Face registered successfully', faceRegistered: true });

  } catch (err) {
    console.error('Face register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/face/login ────────────────────────────────────────
// Body: { descriptor: number[] }
// Matches against all users with faceRegistered = true
// Returns JWT + user info if match found (distance < 0.5)
router.post('/login', async (req, res) => {
  try {
    const { descriptor } = req.body;

    if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128)
      return res.status(400).json({ message: 'Invalid face descriptor' });

    // Fetch only users who have registered a face
    const users = await User.find({ faceRegistered: true }).select('+faceDescriptor');

    if (!users.length)
      return res.status(404).json({ message: 'No face data registered yet' });

    // Find best match
    let bestUser  = null;
    let bestDist  = Infinity;
    const THRESHOLD = 0.5;  // face-api.js default; lower = stricter

    for (const u of users) {
      const dist = euclidean(descriptor, u.faceDescriptor);
      if (dist < bestDist) {
        bestDist = dist;
        bestUser = u;
      }
    }

    console.log(`🔍 Best face match: ${bestUser?.email} dist=${bestDist.toFixed(4)}`);

    if (!bestUser || bestDist > THRESHOLD)
      return res.status(401).json({
        message: 'Face not recognised. Please use email/password login.',
        distance: bestDist
      });

    // Generate token
    const token = jwt.sign(
      { id: bestUser._id, role: bestUser.role, name: bestUser.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message:  'Face login successful',
      token,
      role:     bestUser.role,
      name:     bestUser.name,
      email:    bestUser.email,
      distance: bestDist
    });

  } catch (err) {
    console.error('Face login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/face/status ────────────────────────────────────────
router.get('/status', reqAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('faceRegistered name email');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ faceRegistered: !!user.faceRegistered, name: user.name, email: user.email });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── DELETE /api/face/remove ─────────────────────────────────────
router.delete('/remove', reqAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.faceDescriptor = null;
    user.faceRegistered = false;
    await user.save();
    res.json({ message: 'Face data removed' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
