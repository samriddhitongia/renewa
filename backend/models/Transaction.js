const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  // Buyer
  buyerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  buyerName:  { type: String, required: true },

  // Seller / Listing
  sellerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sellerName: { type: String, required: true },
  listingId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },

  // Energy details
  type:       { type: String, required: true },   // Solar / Wind / Biomass
  kwh:        { type: Number, required: true },
  pricePerKwh:{ type: Number, required: true },
  total:      { type: Number, required: true },

  // Razorpay payment reference
  razorpayOrderId:   { type: String, default: '' },
  razorpayPaymentId: { type: String, default: '' },

}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);
