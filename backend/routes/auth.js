const sendWelcomeEmail = require('../utils/sendMail');
const router = require('express').Router();
const User   = require('../models/User');
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');

// ── Auth middleware (for protected routes) ────────────────────
function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ message: 'No token provided' });
  try {
    req.user = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// ── REGISTER ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role)
      return res.status(400).json({ message: 'All fields are required' });

    if (await User.findOne({ email: email.toLowerCase() }))
      return res.status(400).json({ message: 'An account with that email already exists' });

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashed,
      role
    });

    // ✅ SEND EMAIL AFTER REGISTER
await sendWelcomeEmail(user.email, user.name, user.role);
    res.json({ message: 'Account created successfully' });

  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ message: 'Server error during registration' });
  }
});
// ── LOGIN ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(400).json({ message: 'No account found with that email' });

    if (!await bcrypt.compare(password, user.password))
      return res.status(400).json({ message: 'Incorrect password' });

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // ✅ FIX: return name + email so frontend can store them in Session
    res.json({ token, role: user.role, name: user.name, email: user.email });

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// ── GET /me (protected) ───────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
module.exports.requireAuth = requireAuth;
