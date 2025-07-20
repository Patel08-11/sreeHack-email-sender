const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config();

// Enhanced error handling for missing .env variables
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('🔴 ERROR: Missing email credentials in .env file');
    console.error('Please ensure EMAIL_USER and EMAIL_PASS are set');
    process.exit(1);
}

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Set up multer for file uploads in memory
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Enhanced Nodemailer transporter setup with better error handling
console.log('🔵 Initializing Nodemailer transporter...');
console.log(`Using email: ${process.env.EMAIL_USER}`);

let transporter;
try {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    console.log('🟢 Nodemailer transporter created successfully');
} catch (err) {
    console.error('🔴 Failed to create Nodemailer transporter:');
    console.error(err);
    process.exit(1);
}

// Verify transporter configuration
console.log('🔵 Verifying Nodemailer configuration...');
transporter.verify((error, success) => {
    if (error) {
        console.error('🔴 Nodemailer verification FAILED:');
        console.error('Error details:', error);
        console.error('\nPossible solutions:');
        console.error('1. Verify your Gmail App Password is correct');
        console.error('2. Check if "Less secure app access" is enabled');
        console.error('3. Ensure 2FA is enabled if using App Password');
        process.exit(1);
    } else {
        console.log('🟢 Nodemailer verified successfully!');
        startServer();
    }
});

function startServer() {
    app.post('/send-emails', upload.fields([{ name: 'jsonFile', maxCount: 1 }, { name: 'attachments' }]), async (req, res) => {
        console.log('Received request to /send-emails');

        try {
            const { subject, message } = req.body;
            const jsonFile = req.files.jsonFile ? req.files.jsonFile[0] : null;
            const generalAttachments = req.files.attachments || [];

            if (!jsonFile) {
                return res.status(400).json({ message: 'JSON file with emails is required.' });
            }
            if (!subject || !message) {
                return res.status(400).json({ message: 'Subject and message are required.' });
            }

            let recipients = [];
            try {
                const jsonContent = JSON.parse(jsonFile.buffer.toString('utf8'));
                if (Array.isArray(jsonContent)) {
                    recipients = jsonContent;
                } else if (jsonContent && Array.isArray(jsonContent.emails)) {
                    recipients = jsonContent.emails;
                } else {
                    throw new Error('Invalid JSON format. Expected an array of emails or an object with an "emails" array.');
                }
            } catch (e) {
                return res.status(400).json({ message: `Error parsing JSON file: ${e.message}` });
            }

            console.log(`Found ${recipients.length} recipients.`);

            const attachments = generalAttachments.map(file => ({
                filename: file.originalname,
                content: file.buffer,
                contentType: file.mimetype,
            }));

            const emailPromises = recipients.map(email => {
                const mailOptions = {
                    from: `"SreeHack2k25" <${process.env.EMAIL_USER}>`,
                    to: email,
                    subject: subject,
                    html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
                    attachments: attachments,
                };

                return transporter.sendMail(mailOptions)
                    .then(info => ({ email, status: 'success', message: `Email sent: ${info.response}` }))
                    .catch(err => ({ email, status: 'failure', message: `Failed to send: ${err.message}` }));
            });

            const results = await Promise.allSettled(emailPromises);

            const finalResults = results.map(result => {
                if (result.status === 'fulfilled') {
                    return result.value;
                }
                return { email: 'unknown', status: 'failure', message: 'An unexpected error occurred.' };
            });

            console.log('Finished sending emails. Results:', finalResults);
            res.status(200).json({ message: 'Email sending process completed.', results: finalResults });

        } catch (error) {
            console.error('🔴 An error occurred in /send-emails:', error);
            res.status(500).json({ message: 'An internal server error occurred.', error: error.message });
        }
    });

    app.use((err, req, res, next) => {
        console.error('🔴 UNHANDLED ERROR:', err.stack);
        res.status(err.status || 500).json({
            message: err.message || 'An internal server error occurred.'
        });
    });

    const server = app.listen(port, () => {
        console.log(`🚀 Server is running at http://localhost:${port}`);
    });

    // Handle server errors
    server.on('error', (err) => {
        console.error('🔴 Server error:', err);
        if (err.code === 'EADDRINUSE') {
            console.error(`Port ${port} is already in use`);
        }
    });
}