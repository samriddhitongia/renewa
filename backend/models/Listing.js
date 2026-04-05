const mongoose = require("mongoose");

const ListingSchema = new mongoose.Schema({

  // ================= OWNER =================
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  seller: {
    type: String,
    required: true
  },

  sellerInit: String,


  // ================= ENERGY DETAILS =================
  type: {
    type: String,
    required: true
  },

  kwh: {
    type: Number,
    required: true
  },

  price: {
    type: Number,
    required: true
  },

  loc: {
    type: String,
    required: true
  },

  avail: {
    type: String,
    default: "Available Now"
  },

  cert: {
    type: String,
    default: "REC Certified"
  },

  desc: {
    type: String,
    default: ""
  },


  // ================= IMAGE =================
  image: {
    type: String,
    default: ""
  },


  // ================= SALES DATA =================
  sold: {
    type: Number,
    default: 0
  },

  active: {
    type: Boolean,
    default: true
  }

}, { timestamps: true });

module.exports = mongoose.model("Listing", ListingSchema);