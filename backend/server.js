require('dotenv').config();

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');

const app = express();

// ─────────────────────────────────────────────
// ENSURE UPLOADS DIRECTORY EXISTS
// ─────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory:', uploadsDir);
}

// ─────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

app.use(express.json());

// ─────────────────────────────────────────────
// SERVE UPLOADED IMAGES
// ─────────────────────────────────────────────
app.use('/uploads', express.static(uploadsDir));
app.use('/uploads/kyc', express.static(path.join(uploadsDir, 'kyc')));

// ─────────────────────────────────────────────
// SERVE FRONTEND (renewa_final)
// ─────────────────────────────────────────────
const frontendDir = path.join(__dirname, '..', 'renewa_final');
app.use(express.static(frontendDir));

// ─────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/listings',  require('./routes/listings'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/payment',   require('./routes/payment'));
app.use('/api/face',      require('./routes/face'));
app.use('/api/kyc',       require('./routes/kyc'));

// ─────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uploadsDir: uploadsDir,
    time: new Date().toISOString()
  });
});

// ─────────────────────────────────────────────
// SPA FALLBACK
// ─────────────────────────────────────────────
app.get('*', (req, res) => {
  const indexPath = path.join(frontendDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ message: 'Frontend not found' });
  }
});

// ─────────────────────────────────────────────
// MONGODB CONNECTION
// ─────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB Connected');
    await seedListings();
  })
  .catch(err => console.error('❌ MongoDB Error:', err.message));

// ─────────────────────────────────────────────
// SEED SAMPLE LISTINGS (ONLY IF EMPTY)
// ─────────────────────────────────────────────
async function seedListings() {
  const Listing = require('./models/Listing');
  const count = await Listing.countDocuments();
  if (count > 0) { console.log(`📦 ${count} listings already in database`); return; }

  const samples = [
    { seller:'SunFarm Co.', sellerInit:'SF', sellerId: new mongoose.Types.ObjectId(), type:'Solar', kwh:850, price:0.11, loc:'Phoenix', avail:'Available Now', cert:'REC Certified', sold:0, desc:'Large rooftop solar array' },
    { seller:'Coastal Winds', sellerInit:'CW', sellerId: new mongoose.Types.ObjectId(), type:'Wind', kwh:1200, price:0.10, loc:'Cape Cod', avail:'24/7', cert:'Green-e', sold:0, desc:'Offshore wind turbines' },
    { seller:'BioEnergy Hub', sellerInit:'BE', sellerId: new mongoose.Types.ObjectId(), type:'Biomass', kwh:400, price:0.13, loc:'Portland', avail:'Scheduled', cert:'ISO 50001', sold:0, desc:'Agricultural waste energy' }
  ];

  await Listing.insertMany(samples);
  console.log(`🌱 Seeded ${samples.length} listings`);
}

// ─────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n🚀 Renewa backend running at http://localhost:${PORT}`);
  console.log(`   Open site:  http://localhost:${PORT}/pages/auth.html`);
  console.log(`   API health: http://localhost:${PORT}/api/health`);
  console.log(`   Uploads at: ${uploadsDir}\n`);
});