require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const { google } = require('googleapis');
const app = express();

const PORT = process.env.PORT || 5000;
const OWNER_EMAIL = process.env.OWNER_EMAIL;
const BASE_URL = process.env.BASE_URL;

app.use(cors());
app.use(express.json());

// Configure Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Configure Google Sheets API
const auth = new google.auth.GoogleAuth({
    keyFile: './service-account.json', // Path to your downloaded JSON key file
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = '1GiRuMOrjDAYlDK4JimgFLYpIdfv_TzEGuqWXcze3dq8'; // Replace with your Sheet ID

const bookings = new Map();

// Helper function to append data to Google Sheet
async function appendToSheet(bookingId, booking, status) {
    const timestamp = new Date().toISOString();
    const values = [
        [bookingId, booking.name, booking.email, booking.phone, booking.testType, status, timestamp]
    ];
    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:G', // Adjust if your sheet has a different name
            valueInputOption: 'RAW',
            resource: { values },
        });
        console.log('Data appended to Google Sheet:', values);
    } catch (error) {
        console.error('Error appending to Google Sheet:', error);
    }
}

// Submit a booking
app.post('/api/book-test', async (req, res) => {
    const { name, email, phone, testType } = req.body;

    if (!name || !email || !phone || !testType) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    const bookingId = uuidv4();
    bookings.set(bookingId, { name, email, phone, testType, status: 'pending' });

    // Append to Google Sheet
    await appendToSheet(bookingId, { name, email, phone, testType }, 'pending');

    const acceptLink = `${BASE_URL}/api/respond/${bookingId}/accept`;
    const rejectLink = `${BASE_URL}/api/respond/${bookingId}/reject`;
    const ownerMailOptions = {
        from: process.env.EMAIL_USER,
        to: OWNER_EMAIL,
        subject: 'New Test Booking Request',
        html: `
            <h3>New Booking Request</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Test Type:</strong> ${testType}</p>
            <p>
                <a href="${acceptLink}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Accept</a>
                <a href="${rejectLink}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-left: 10px;">Reject</a>
            </p>
        `,
    };

    try {
        await transporter.sendMail(ownerMailOptions);
        res.status(200).json({ message: 'Booking request sent successfully!' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ message: 'Failed to send booking request.' });
    }
});

// Get all bookings (for admin page)
app.get('/api/bookings', (req, res) => {
    const bookingList = Array.from(bookings.entries()).map(([id, data]) => ({
        id,
        ...data,
    }));
    res.status(200).json(bookingList);
});

// Approve or reject a booking (POST for admin page)
app.post('/api/respond/:bookingId/:action', async (req, res) => {
    const { bookingId, action } = req.params;
    const booking = bookings.get(bookingId);

    if (!booking) {
        return res.status(404).json({ message: 'Booking not found.' });
    }

    const clientMailOptions = {
        from: process.env.EMAIL_USER,
        to: booking.email,
        subject: `Booking Status Update`,
        html:
            action === 'accept'
                ? `
                    <h3>You are Appointed</h3>
                    <p>Dear ${booking.name},</p>
                    <p>You are appointed for your ${booking.testType}. Please await further instructions.</p>
                `
                : `
                    <h3>You are Not Appointed</h3>
                    <p>Dear ${booking.name},</p>
                    <p>You are not appointed for your ${booking.testType}. Please try again later or contact us at <strong>+1-234-567-890</strong>.</p>
                `,
    };

    try {
        await transporter.sendMail(clientMailOptions);
        if (action === 'accept') {
            bookings.set(bookingId, { ...booking, status: 'accepted' });
            await appendToSheet(bookingId, booking, 'accepted');
        } else {
            bookings.delete(bookingId);
            await appendToSheet(bookingId, booking, 'rejected');
        }
        res.status(200).json({ message: `Booking ${action}ed successfully.` });
    } catch (error) {
        console.error('Error sending response email:', error);
        res.status(500).json({ message: 'Failed to process response.' });
    }
});

// Legacy email link support (GET request)
app.get('/api/respond/:bookingId/:action', async (req, res) => {
    const { bookingId, action } = req.params;
    const booking = bookings.get(bookingId);

    if (!booking) {
        return res.status(404).send('Booking not found.');
    }

    const clientMailOptions = {
        from: process.env.EMAIL_USER,
        to: booking.email,
        subject: `Booking Status Update`,
        html:
            action === 'accept'
                ? `
                    <h3>You are Appointed</h3>
                    <p>Dear ${booking.name},</p>
                    <p>You are appointed for your ${booking.testType}. Please await further instructions.</p>
                `
                : `
                    <h3>You are Not Appointed</h3>
                    <p>Dear ${booking.name},</p>
                    <p>You are not appointed for your ${booking.testType}. Please try again later or contact us at <strong>+1-234-567-890</strong>.</p>
                `,
    };

    try {
        await transporter.sendMail(clientMailOptions);
        if (action === 'accept') {
            bookings.set(bookingId, { ...booking, status: 'accepted' });
            await appendToSheet(bookingId, booking, 'accepted');
        } else {
            bookings.delete(bookingId);
            await appendToSheet(bookingId, booking, 'rejected');
        }
        res.send(`<h1>Booking ${action === 'accept' ? 'Accepted' : 'Rejected'}</h1><p>The client has been notified.</p>`);
    } catch (error) {
        console.error('Error sending response email:', error);
        res.status(500).send('Failed to process your response.');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});