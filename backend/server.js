

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const pdf = require('pdfkit');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());


const allowedOrigins = ['http://52.66.201.236:3000',"http://localhost:3001","http://localhost:3000"];

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
app.use('/images', express.static(path.join(__dirname, 'public/images')));



// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/donations').then(() => {
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

let receiptCounter = 1;

// Ensure Receipts Directory Exists
const receiptsDir = path.join(__dirname, 'receipts');
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
  console.log('Receipts directory created.');
}

// API to Generate Receipt
const puppeteer = require('puppeteer');
const imagePath = path.join(__dirname, 'images', 'NMF.png');

function numberToWords(num) {
  const a = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const b = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];
  const g = ["", "thousand", "million", "billion", "trillion"];

  if (num === 0) return "zero";

  let words = "";

  function chunk(num) {
    if (num === 0) return "";
    if (num < 20) return a[num];
    if (num < 100)
      return b[Math.floor(num / 10)] + (num % 10 ? " " + a[num % 10] : "");
    if (num < 1000)
      return (
        a[Math.floor(num / 100)] +
        " hundred" +
        (num % 100 ? " and " + chunk(num % 100) : "")
      );
    return "";
  }

  function toWords(num) {
    let result = "";
    let group = 0;

    while (num > 0) {
      let word = chunk(num % 1000);
      if (word)
        result =
          word +
          (g[group] ? " " + g[group] : "") +
          (result ? " " + result : "");
      num = Math.floor(num / 1000);
      group++;
    }

    return result.trim();
  }

  return toWords(num);
}

app.post('/api/receipt', async (req, res) => {
    try {
        const { volunteerName, donorName, donorPAN, denominations, total, email, mobileNo, address } = req.body;

        const lastReceipt = await Receipt.findOne().sort({ date: -1 });
        let lastNumber = 1;

        if (lastReceipt && lastReceipt.receiptNumber) {
            const matches = lastReceipt.receiptNumber.match(/(\d+)$/);
            if (matches && matches[0]) {
                lastNumber = parseInt(matches[0]) + 1;
            }
        }

        const totalInWords = numberToWords(total).toUpperCase();
        const receiptNumber = `#NMF01/24-25/FSJB-0${lastNumber}`;
        const pdfFileName = `${receiptNumber.replace(/[#/]/g, '-')}.pdf`;
        const pdfPath = path.join(__dirname, 'receipts', pdfFileName);

        const currentDateTime = new Date();
        const formattedDate = currentDateTime.toLocaleDateString();
        const formattedTime = currentDateTime.toLocaleTimeString();

        console.log('Saving PDF at:', pdfPath);

        // Read the HTML template
        let template = fs.readFileSync(path.join(__dirname, 'templates', 'receipt.html'), 'utf8');


        const donorDetailsTable = `
  <tr>
    <td style="border: 1px solid #ccc; padding: 8px;">Donor Name</td>
    <td style="border: 1px solid #ccc; padding: 8px;">${donorName}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ccc; padding: 8px;">Donor PAN</td>
    <td style="border: 1px solid #ccc; padding: 8px;">${donorPAN}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ccc; padding: 8px;">Email</td>
    <td style="border: 1px solid #ccc; padding: 8px;">${email}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ccc; padding: 8px;">Mobile Number</td>
    <td style="border: 1px solid #ccc; padding: 8px;">${mobileNo}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ccc; padding: 8px;">Address</td>
    <td style="border: 1px solid #ccc; padding: 8px;"></td>
  </tr>
`;
        // Replace placeholders with actual values
        template = template
      .replace("{{receiptNumber}}", receiptNumber)
      .replace("{{formattedDate}}", formattedDate)
      .replace("{{formattedTime}}", formattedTime)
      .replace("{{donorDetailsTable}}", donorDetailsTable)
      .replace("{{volunteer}}", volunteerName)
      .replace("{{address}}", address)
      .replace(/{{total}}/g, total)
      .replace('{{totalInWords}}', totalInWords)
      .replace("{{imagePath}}", `file://${imagePath}`);

        // Convert denominations to HTML
        let denominationsTable = "";
        Object.entries(denominations).forEach(([denom, count]) => {
            if (count > 0) {
             const total = denom * count;
             denominationsTable += `
             <tr> <td style="border: 1px solid #ccc; padding: 8px;">${denom} Rs</td>
                  <td style="border: 1px solid #ccc; padding: 8px;">${count}</td> 
            <td style="border: 1px solid #ccc; padding: 8px; display:flex; text-align:right;">₹ ${total}</td>
            </tr>
           `;
        }
        });
        template = template.replace("{{denominationsTable}}", denominationsTable);

        // Generate PDF using Puppeteer
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        await page.setContent(template, { waitUntil: 'domcontentloaded' });

        // ✅ Force Background Color
        await page.evaluate(() => {
            document.body.style.background = '#f4f4f4'; // Ensure background is applied
        });

        // ✅ Ensure fonts are fully loaded before rendering
        await page.evaluateHandle('document.fonts.ready');

        // ✅ Generate the PDF with Background
        await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });

        await browser.close();

        // Save receipt to MongoDB
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

        // Respond with PDF URL
        res.json({
            message: 'Receipt Generated and Saved',
            receipt,
            pdfUrl: `http://52.66.201.236:5001/receipts/${pdfFileName}`,
        });

    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ message: 'Internal Server Error', error: err.message });
    }
});

app.get('/api/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'receipts', req.params.filename);

    // Check if the file exists
    if (fs.existsSync(filePath)) {
        res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
        res.setHeader('Content-Type', 'application/pdf');
        res.download(filePath); // This will trigger the file download
    } else {
        res.status(404).json({ message: 'File not found' });
    }
});

  

app.listen(5001, () => console.log('Server running on port 5001'));
