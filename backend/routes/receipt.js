const express = require('express');
const Receipt = require('../models/Receipt');
const router = express.Router();

router.post('/', async (req, res) => {
  const { volunteerName, donorName, denominations, total } = req.body;
  const receiptNumber = `REC${Date.now()}`;

  const receipt = new Receipt({ volunteerName, donorName, denominations, total, receiptNumber });

  await receipt.save();

  res.json({ message: 'Receipt Generated', receipt });
});

router.get('/', async (req, res) => {
  const receipts = await Receipt.find();
  res.json(receipts);
});

module.exports = router;
