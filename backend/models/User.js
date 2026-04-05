const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },

  password: {
    type: String,
    required: true
  },

  role: {
    type: String,
    enum: ["producer", "consumer", "investor"],
    required: true
  },

  // ================= DIGITAL WALLET =================
  walletBalance: {
    type: Number,
    default: 1000,   // starting credits
    min: 0
  },

  // ================= FUTURE FEATURES (IMPORTANT) =================
  totalEnergyPurchased: {
    type: Number,
    default: 0
  },

  totalEnergySold: {
    type: Number,
    default: 0
  },

  totalInvested: {
    type: Number,
    default: 0
  },

  // ================= FACE RECOGNITION =================
  faceDescriptor: { type: [Number], default: null },
  faceRegistered:  { type: Boolean, default: false },

  // ================= AADHAAR KYC =================
  kyc: {
    status: {
      type: String,
      enum: ['pending', 'submitted', 'verified', 'rejected'],
      default: 'pending'
    },
    aadhaarNumber:   { type: String, default: '' },   // last 4 digits stored only
    aadhaarFront:    { type: String, default: '' },   // filename in uploads/kyc/
    aadhaarBack:     { type: String, default: '' },
    selfie:          { type: String, default: '' },   // live selfie for liveness check
    submittedAt:     { type: Date,   default: null },
    verifiedAt:      { type: Date,   default: null },
    rejectedReason:  { type: String, default: '' },
    // Admin review
    reviewedBy:      { type: String, default: '' }
  }

}, {
  timestamps: true
});

module.exports = mongoose.model("User", UserSchema);