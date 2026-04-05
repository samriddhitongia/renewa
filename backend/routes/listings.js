const router = require("express").Router();
const Listing = require("../models/Listing");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const multer = require("multer");


const path = require("path");

// =====================================================
// IMAGE UPLOAD CONFIG
// =====================================================
const uploadDir = path.join(__dirname, "..", "uploads");  // backend/uploads
const fs = require("fs");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_"));
  }
});

const upload = multer({ storage });


// =====================================================
// AUTH MIDDLEWARE
// =====================================================
function optAuth(req, res, next) {
  const h = req.headers.authorization;
  if (h) {
    try {
      req.user = jwt.verify(h.split(" ")[1], process.env.JWT_SECRET);
    } catch {}
  }
  next();
}

function reqAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ message: "Login required" });

  try {
    req.user = jwt.verify(h.split(" ")[1], process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}


// =====================================================
// GET PRODUCER'S OWN LISTINGS
// =====================================================
router.get("/mine/producer", reqAuth, async (req, res) => {
  try {
    if (req.user.role !== "producer")
      return res.status(403).json({ message: "Producers only" });

    const listings = await Listing.find({ sellerId: req.user.id }).sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// =====================================================
// GET ALL LISTINGS (Marketplace)
// =====================================================
router.get("/", optAuth, async (req, res) => {
  try {

    const filter = { active: true };

    if (req.query.type) filter.type = req.query.type;

    if (req.query.minPrice || req.query.maxPrice) {
      filter.price = {};
      if (req.query.minPrice) filter.price.$gte = +req.query.minPrice;
      if (req.query.maxPrice) filter.price.$lte = +req.query.maxPrice;
    }

    const listings = await Listing.find(filter)
      .sort({ createdAt: -1 });

    res.json(listings);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// =====================================================
// CREATE LISTING (PRODUCER ONLY + IMAGE)
// =====================================================
router.post("/", reqAuth, upload.single("image"), async (req, res) => {
  try {

    if (req.user.role !== "producer")
      return res.status(403).json({ message: "Only producers allowed" });

    const { type, kwh, price, loc, avail, cert, desc } = req.body;

    if (!type || !kwh || !price || !loc)
      return res.status(400).json({
        message: "type, kwh, price and location required"
      });

    const user = await User.findById(req.user.id).select("name");

    const init = user.name
      .split(" ")
      .map(w => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    const listing = await Listing.create({
      seller: user.name,
      sellerId: req.user.id,
      sellerInit: init,

      type,
      kwh: +kwh,
      price: +price,
      loc,
      avail: avail || "Available Now",
      cert: cert || "REC Certified",
      desc: desc || "",

      image: req.file ? req.file.filename : ""
    });

    res.status(201).json(listing);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// =====================================================
// UPDATE LISTING (OWNER ONLY)
// =====================================================
router.put("/:id", reqAuth, async (req, res) => {
  try {

    const listing = await Listing.findById(req.params.id);

    if (!listing)
      return res.status(404).json({ message: "Listing not found" });

    if (String(listing.sellerId) !== String(req.user.id))
      return res.status(403).json({ message: "Not your listing" });

    Object.assign(listing, req.body);

    await listing.save();

    res.json(listing);

  } catch {
    res.status(500).json({ message: "Server error" });
  }
});


// =====================================================
// DELETE LISTING
// =====================================================
router.delete("/:id", reqAuth, async (req, res) => {
  try {

    const listing = await Listing.findById(req.params.id);

    if (!listing)
      return res.status(404).json({ message: "Listing not found" });

    if (String(listing.sellerId) !== String(req.user.id))
      return res.status(403).json({ message: "Not your listing" });

    await listing.deleteOne();

    res.json({ message: "Listing deleted" });

  } catch {
    res.status(500).json({ message: "Server error" });
  }
});


// =====================================================
// PURCHASE ENERGY (CONSUMER)
// =====================================================
router.post("/:id/purchase", reqAuth, async (req, res) => {
  try {

    if (req.user.role !== "consumer")
      return res.status(403).json({ message: "Consumers only" });

    const listing = await Listing.findById(req.params.id);

    if (!listing || !listing.active)
      return res.status(404).json({ message: "Listing unavailable" });

    const qty = Math.min(+req.body.kwh || 100, listing.kwh);

    const total = +(qty * listing.price).toFixed(2);

    const buyer = await User.findById(req.user.id);

    if (buyer.walletBalance < total)
      return res.status(400).json({
        message: "Insufficient wallet balance"
      });

    // Deduct from buyer
    buyer.walletBalance -= total;
    buyer.totalEnergyPurchased = (buyer.totalEnergyPurchased || 0) + qty;
    await buyer.save();

    // Credit seller wallet
    const seller = await User.findById(listing.sellerId);
    if (seller) {
      seller.walletBalance = (seller.walletBalance || 0) + total;
      seller.totalEnergySold = (seller.totalEnergySold || 0) + qty;
      await seller.save();
    }

    // Update listing
    listing.kwh -= qty;
    listing.sold += qty;
    if (listing.kwh <= 0) listing.active = false;
    await listing.save();

    // Record transaction
    const Transaction = require('../models/Transaction');
    await Transaction.create({
      buyerId:     buyer._id,
      buyerName:   buyer.name,
      sellerId:    listing.sellerId,
      sellerName:  listing.seller,
      listingId:   listing._id,
      type:        listing.type,
      kwh:         qty,
      pricePerKwh: listing.price,
      total
    });

    res.json({
      message: "Purchase successful",
      total,
      remainingWallet: buyer.walletBalance
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// =====================================================
module.exports = router;