const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema({
  volunteerName: String,
  donorName: String,
  donorPAN: String,
  email: String,
  mobileNo: Number,
  Address: String,
  denominations: Object,
  total: Number,
  date: { type: Date, default: Date.now },
  receiptNumber: String,
});

module.exports = mongoose.model('Receipt', receiptSchema);
