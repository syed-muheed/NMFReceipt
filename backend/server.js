

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const pdf = require('pdfkit');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());


const allowedOrigins = ['http://52.66.201.236:3000',"http://localhost:3001"];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Handle preflight requests
app.options('*', cors());

app.use('/receipts', express.static(path.join(__dirname, 'receipts')));



// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/donations', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('MongoDB Connected');
}).catch((err) => {
  console.error('MongoDB Connection Error:', err);
});

// Receipt Schema
const receiptSchema = new mongoose.Schema({
  volunteerName: String,
  donorName: String,
  donorPAN: String,
  email: String,
  mobileNo: String,
  address: String,
  denominations: Object,
  total: Number,
  date: { type: Date, default: Date.now },
  receiptNumber: String,
  pdfPath: String,
});

const Receipt = mongoose.model('Receipt', receiptSchema);

let receiptCounter = 230;

// Ensure Receipts Directory Exists
const receiptsDir = path.join(__dirname, 'receipts');
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
  console.log('Receipts directory created.');
}

// API to Generate Receipt
app.post('/api/receipt', async (req, res) => {
    try {
      const { volunteerName, donorName, donorPAN, denominations, total, email, mobileNo, address } = req.body;
  
      const lastReceipt = await Receipt.findOne().sort({ date: -1 });
      let lastNumber = 230; // Default starting number if no receipt exists
  
      if (lastReceipt && lastReceipt.receiptNumber) {
        const matches = lastReceipt.receiptNumber.match(/(\d+)$/);
        if (matches && matches[0]) {
          lastNumber = parseInt(matches[0]) + 1;
        }
      }
  
      const receiptNumber = `#NMF01/24-25/${lastNumber}`;
      const pdfFileName = `${receiptNumber.replace(/[#/]/g, '-')}.pdf`;
      const pdfPath = path.join(__dirname, 'receipts', pdfFileName);
  
      const currentDateTime = new Date();
      const formattedDate = currentDateTime.toLocaleDateString();
      const formattedTime = currentDateTime.toLocaleTimeString();
  
      console.log('Saving PDF at:', pdfPath);
  
      const doc = new pdf({ margin: 50 });
  
      // Ensure the receipts directory exists
      if (!fs.existsSync(path.join(__dirname, 'receipts'))) {
        fs.mkdirSync(path.join(__dirname, 'receipts'));
      }
  
      const writeStream = fs.createWriteStream(pdfPath);
  
      // Handle stream errors
      writeStream.on('error', (err) => {
        console.error('Error writing PDF:', err);
        return res.status(500).json({ message: 'Failed to write PDF', error: err.message });
      });
  
      doc.pipe(writeStream);
  
      // Draw top and bottom colored bars
      doc.rect(0, 0, doc.page.width, 50).fill('#4A90E2');
      doc.rect(0, doc.page.height - 50, doc.page.width, 50).fill('#4A90E2');
  
      // Insert Image
      const imagePath = 'images/NMF.png';
      if (fs.existsSync(imagePath)) {
        doc.image(imagePath, doc.page.width / 2 - 45, 50, { width: 90 });
      } else {
        console.error('Image not found:', imagePath);
      }
  
      doc.moveDown(7);
  
      // Header Text
      doc.fontSize(12).fillColor('#7e7e7e').text('Nimal Maula Foundation', { align: 'center' });
      doc.fontSize(12).text(`Receipt: ${receiptNumber}`, { align: 'center' });
  
      doc.moveDown(2);
      doc.strokeColor('#7e7e7e').moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(2);
  
      // Receipt Details
      doc.fillColor('#849091');
      doc.text(`Amount Paid: ₹${total}`, { align: 'left' });
      doc.text(`Date & Time: ${formattedDate} ${formattedTime}`, { align: 'center' });
      doc.text(`Payment Method: Cash`, { align: 'right' });
  
      doc.moveDown();
  
      // Save PDF and respond once it’s fully written
      writeStream.on('finish', async () => {
        try {
          const receipt = new Receipt({
            volunteerName,
            donorName,
            donorPAN,
            email,
            mobileNo,
            address,
            denominations,
            total,
            receiptNumber,
            pdfPath,
          });
  
          await receipt.save();
          console.log('Receipt saved successfully:', receipt);
  
          // Send response only once after PDF is saved
          res.json({
            message: 'Receipt Generated and Saved',
            receipt,
            pdfUrl: `http://52.66.201.236:5001/receipts/${pdfFileName}`,
          });
        } catch (err) {
          console.error('Error saving receipt:', err);
          res.status(500).json({ message: 'Failed to save receipt', error: err.message });
        }
      });
  
      doc.end();
    } catch (err) {
      console.error('Error:', err);
      res.status(500).json({ message: 'Internal Server Error', error: err.message });
    }
  });
  

app.listen(5001, () => console.log('Server running on port 5001'));
