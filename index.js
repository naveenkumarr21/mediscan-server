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

// Hardcoded Google Sheets API credentials
const credentials = {
    "type": "service_account",
    "project_id": "booking-system-453516",
    "private_key_id": "817cb007bf6fb151fb483974fe07493bfb1479e7",
    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC9D8X4xZkrsnwL\noClNlPKmIPyNJ4jxpXrzKFu6FSC3TXxCcaaAbwGAqtTLbohd8HqsfIlqtd97gNIz\ndqI8PZ6nuQrj0z1rUhtFhO0y25ZlQacgKfmtvLRRx1t+FmdTsWcXicdoL6zUS5mU\nfn9ZnfaeZbPKS+V/xmSl7KHTfcdbVwCSw8QBCpiGCqsS4maBlkE3y/DTqZWYBZtS\nS5yeFrkeCYyB9OZ0HUbXub8Xo0gUwZolG6iIVmIGPV7tqBXCUBkWZWhHOu2pI+8b\n2ytVqP8jrRaKa0O/7RBdI0NNDg8qkcPNdEFQXUupzMzy0V6y9arEpE5NPuuTYQah\nTDZYlP9tAgMBAAECggEAAQap42IRz7vl58Y/EyMLd2gBwYkFDuf//9EolkebvYLt\nJAsr2nyVEdaw1Z3MSFOQHDQyJrhv9bf1lr6TvidIyiOQnJCT6muFUbOZT0eudu7h\nR6USrCUJsXvsfNsFmohW7+Nuh/E3oJCnImLWsWzQXtGxz8I+WkWAXFTUGAARvzwk\n6oVLPs7tcw5kAz1z4XHYz770SlylI0Ibe3Z/aQ0gkvUvGjMwEeSFTZBqZhJ8d0cY\nqEDkLBu9XUd1Q7jcEWXCtEPE3rs32Wez02c2fiUUmKYwcA3GZUMIJks+J3HZd3E6\nA/Q8TMSLpcCbFaj6fYLbVBxFZufh77PXqCRzPIEsfQKBgQDlDqvCegmr5gH0L0fc\n5Xnp/IIANZLvbZ+QIq9DesjAiX3Uoh88DlqeceUrUKO2deeAxluR/6GcZQqxVIhH\nJ1RV1w2qEU6U5KS4e3NExrCbnSZJdWA5Xkz6fxZD2xkErC74AfMu/DiTuaAhftJd\nzCER+9BboLfU2Yp02i5uXHJncwKBgQDTTMKFaZu6+Ovfs8N6VBbgwwPbCWGgPLJJ\nZV5MgbAhTmwBQUZ53+/c4Vq42sFH5L7LYfRTPDu/26Cm/ZA+ObKDK1QMEOlKKdP7\nDJWPsCWuVjdSyRLf41tpIHeuk03giWdD3gmlZn0xIDeVbbZwHUiYkXQWxnmG1GOg\nbJZuSRiFnwKBgEvsd/xHbUtAOyeQQHa0zZtEambdWy3nnTsuc/+fBEnliQLhFg9X\nBqx8PiUEXq+NF0Y0+YdEP3JSf5/V0DIdlDO7y7iyceSigQLxUHzciw+ZoGY69MEv\nQ77IPz4QspM863ijVNMfITW+Epjnq50Rm2iVmjO06xovXVhsNXW5SOaHAoGAek+E\nihWHv8M3RlaYYMcsNw6rvK7BhC+eRD4ZR9AKVD1A57kRQpsODZ2lFjwKhcMzbidV\ndpj3PSe05vT/+gUMAEGkdReU8wkjW779FB+ysCfX/mPGOTMyRrg0jylVexQOYoq0\nqrmY3kb35deMM3m//BC2UjixQArRYJt6uHw3ZaECgYAG1PaqM1rjwrfJYUw5SR1C\nMjFmhw/SkW9QVzBfy21S5zzgWIrrbO5B6x8dUPyuL7dZerS7mo/L3nwBT8MWUnsl\nAEhJsTff3TA0CsAWtt6DdXRRRz14V33rd/orujYwMiq2RMBhZ28loLJUxwA4HCWO\nzgOp/u2LyEbmxmcQ7uSW2A==\n-----END PRIVATE KEY-----\n",
    "client_email": "bookingservice@booking-system-453516.iam.gserviceaccount.com",
    "client_id": "116391789445600507631",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/bookingservice%40booking-system-453516.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com"
};

// Configure Google Sheets API
const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID; // Use environment variable for Spreadsheet ID

const bookings = new Map();

// Helper function to append data to Google Sheet
async function appendToSheet(bookingId, booking, status) {
    const timestamp = new Date().toISOString();
    const values = [
        [bookingId, booking.name, booking.email, booking.phone, booking.testType, status, timestamp]
    ];
    try {
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:G', // Adjust if your sheet has a different name
            valueInputOption: 'RAW',
            resource: { values },
        });
        console.log('Data appended to Google Sheet:', response.data);
    } catch (error) {
        console.error('Error appending to Google Sheet:', error.message);
        if (error.response) {
            console.error('Error details:', error.response.data);
        }
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