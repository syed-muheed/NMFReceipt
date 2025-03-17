const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const pdf = require('pdfkit');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(cors());

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

    const receiptNumber = `#NMF01/24-25/${receiptCounter}`;
    receiptCounter++;
    const pdfPath = path.join(receiptsDir, `${receiptNumber.replace(/[#/]/g, '-')}.pdf`);

    const currentDateTime = new Date();
    const formattedDate = currentDateTime.toLocaleDateString();
    const formattedTime = currentDateTime.toLocaleTimeString();

    // Log the PDF path
    console.log('Saving PDF at:', pdfPath);

    const doc = new pdf({ margin: 50 });

    const writeStream = fs.createWriteStream(pdfPath);
    writeStream.on('error', (err) => {
      console.error('Error writing PDF:', err);
      res.status(500).json({ message: 'Failed to write PDF', error: err.message });
    });

    doc.pipe(writeStream);

    // Draw top and bottom colored bars
    doc.rect(0, 0, doc.page.width, 50).fill('#4A90E2');
    doc.rect(0, doc.page.height - 50, doc.page.width, 50).fill('#4A90E2');

    // Insert Image
    const imagePath = 'images/NMF.png';
    const imageWidth = 90;
    const pageWidth = doc.page.width;
    
    const padding = 50;
    const leftX = 50;
const centerX = doc.page.width / 2 - 50;
const rightX = doc.page.width - 200;

    const x = (pageWidth - imageWidth) / 2;
    if (fs.existsSync(imagePath)) {
      doc.image(imagePath, x, 50, { fit: [90, 90] });
    } else {
      console.error('Image not found:', imagePath);
    }

    doc.moveDown(7);
   

    // Header Text
    doc.fontSize(12).fillColor('#7e7e7e').text('Nimal Maula Foundation', { align: 'center' });
    doc.fontSize(12).text(`Receipt: ${receiptNumber}`, { align: 'center' });
    doc.moveDown(1)

    const y=doc.y

    // Section Details
    doc.fillColor('#849091');
    doc.text(`Section 12AB Reg.No`, leftX,y);
    doc.text(`Section-80G Registration No`,rightX,y);
    
    doc.fillColor('black').text(`AAGCN5439HE20231`, );
    doc.text(`AAGCN5439HF20231`, { align: 'right' });

    
    doc.fillColor('#849091').text(`Corporate Identity No`, { align: 'left' });
    doc.text(`Darpan ID No`, { align: 'right' });
    
    doc.fillColor('black').text(`U85300TG2019NPL132903`, { align: 'left' });
    doc.text(`TS/2023/035306`, { align: 'right' });

    doc.moveDown(1);
    doc.strokeColor('#7e7e7e').moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(2);


    doc.fillColor('#849091');
    doc.text(`Amount Paid`, { align: 'left' });
    doc.text(`Date & Time`, { align: 'center' });
    doc.text(`Payment Method`, { align: 'right' });
    doc.fillColor('black');
    doc.text(`₹${total}`, { align: 'left' });
    doc.text(`${formattedDate} ${formattedTime}`, { align: 'center' });
    doc.text(`Cash`, { align: 'right' });

    doc.moveDown();

    // Left Box (Donor Details)
    const leftBoxX = 50;
    const leftBoxY = doc.y;
    const boxWidth = 250;
    const boxHeight = 150;

    doc.rect(leftBoxX, leftBoxY, boxWidth, boxHeight).fill('#fafafa');
    doc.lineWidth(1).strokeColor('#e1e1e1').rect(leftBoxX, leftBoxY, boxWidth, boxHeight).stroke();

    doc.fillColor('#000000')
      .fontSize(12)
      .text(`Email: ${email}`, leftBoxX + 10, leftBoxY + 10)
      .text(`Donor Name: ${donorName}`)
      .text(`Volunteer Name: ${volunteerName}`)
      .text(`PAN Number: ${donorPAN}`)
      .text(`Address: ${address}`)
      .text(`Mobile Number: ${mobileNo}`);

    // Right Box (Denominations)
    const rightBoxX = 320;
    doc.rect(rightBoxX, leftBoxY, boxWidth, boxHeight).fill('#fafafa');
    doc.lineWidth(1).strokeColor('#e1e1e1').rect(rightBoxX, leftBoxY, boxWidth, boxHeight).stroke();

    doc.fillColor('#000000').fontSize(12);
    Object.entries(denominations).forEach(([denom, count], index) => {
      doc.text(`${denom} Rs x ${count} = ₹${denom * count}`, rightBoxX + 10, leftBoxY + 10 + (index * 15));
    });

    doc.moveDown(10);

    // Total Amount Box
    const totalBoxY = doc.y;
    doc.rect(50, totalBoxY, 500, 30).fill('#FFF3E0');
    doc.lineWidth(1).strokeColor('#FF9800').rect(50, totalBoxY, 500, 30).stroke();
    doc.fillColor('#E65100').fontSize(14).text(`Total Amount: ₹${total}`, 60, totalBoxY + 8);
    doc.moveDown();

    // Thank You Note
    doc.fontSize(12).text('Thank you for your generous donation!', { align: 'center' });
    doc.text('We greatly appreciate your support.', { align: 'center' });

    doc.end();

    writeStream.on('finish', async () => {
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
      res.json({ message: 'Receipt Generated and Saved', receipt });
    });

  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
});

app.listen(5001, () => console.log('Server running on port 5001'));
