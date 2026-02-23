const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { addMinutes, isAfter } = require('date-fns');
const { OtpLog } = require('../models');
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

let client;
if (accountSid && authToken) {
    client = twilio(accountSid, authToken);
}

// Helper to ensure E.164 format for Twilio (defaults to India +91 if 10 digits)
const formatToE164 = (mobile) => {
    let cleaned = mobile.replace(/\D/g, ''); // Remove non-digits
    if (cleaned.length === 10) {
        return `+91${cleaned}`;
    }
    return mobile.startsWith('+') ? mobile : `+${mobile}`;
};

// Real WhatsApp Sender using Twilio
const sendSMS = async (mobile, message) => {
    try {
        if (!client) {
            console.error(`[TWILIO CONFIG ERROR] TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is missing in Environment Variables.`);
            console.log(`[FALLBACK MOCK ALERT] Dispatch skipped due to missing credentials.`);
            console.log(`[FALLBACK MOCK] To: ${mobile} | Message: ${message}`);
            return false;
        }
        const fullNumber = formatToE164(mobile);
        const to = `whatsapp:${fullNumber}`;
        const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

        const debugMsg = `[${new Date().toISOString()}] [TWILIO DEBUG] Attempting Dispatch -> From: ${from} | To: ${to} | Message: ${message}\n`;
        fs.appendFileSync(path.join(__dirname, '../../twilio_debug.log'), debugMsg);

        const response = await client.messages.create({
            body: message,
            from: from,
            to: to
        });

        const successMsg = `[${new Date().toISOString()}] [TWILIO SUCCESS] SID: ${response.sid}\n`;
        fs.appendFileSync(path.join(__dirname, '../../twilio_debug.log'), successMsg);

        console.log(`[TWILIO SUCCESS] SID: ${response.sid} | To: ${to}`);
        return true;
    } catch (error) {
        let errorDesc = `[${new Date().toISOString()}] [TWILIO ERROR] Status: ${error.status} | Code: ${error.code} | Message: ${error.message}\n`;
        if (error.code === 63015) {
            errorDesc += `[TIP] This error means the recipient (+919142577780) has not joined the Twilio Sandbox. They must send "join <your-sandbox-word>" to +1 415 523 8886.\n`;
        }
        fs.appendFileSync(path.join(__dirname, '../../twilio_debug.log'), errorDesc);

        console.error(`[TWILIO ERROR] Status: ${error.status} | Code: ${error.code} | Message: ${error.message}`);
        // Fallback to mock log so system doesn't crash if Twilio fails
        console.log(`[FALLBACK MOCK ALERT] Dispatch skipped. Check Twilio config or Sandbox JOIN status.`);
        console.log(`[FALLBACK MOCK] To: ${mobile} | Message: ${message}`);
        return false;
    }
};

const generateOtp = () => {
    return Math.floor(1000 + Math.random() * 9000).toString(); // 4 digit OTP
};

const sendOtpToRelative = async (mobileNumber) => {
    const otp = generateOtp();
    const expiresAt = addMinutes(new Date(), parseInt(process.env.OTP_EXPIRY_MINUTES) || 5);

    // Hash OTP before storing
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);

    await OtpLog.create({
        mobile_number: mobileNumber,
        otp_hash: otpHash,
        expires_at: expiresAt
    });

    await sendSMS(mobileNumber, `Your Visitor OTP is ${otp}. Valid for 5 mins.`);

    return { success: true, message: 'OTP sent' };
};

const verifyOtp = async (mobileNumber, otp) => {
    // Find the latest unused OTP for this mobile
    const otpRecord = await OtpLog.findOne({
        where: { mobile_number: mobileNumber, is_used: false },
        order: [['createdAt', 'DESC']]
    });

    if (!otpRecord) {
        return { valid: false, message: 'No OTP found or already used' };
    }

    // Check expiry
    if (isAfter(new Date(), otpRecord.expires_at)) {
        return { valid: false, message: 'OTP expired' };
    }

    // Check attempt count (Simple brute force protection)
    if (otpRecord.attempt_count >= 5) {
        return { valid: false, message: 'Too many attempts. Request new OTP.' };
    }

    // Check Match
    const isMatch = await bcrypt.compare(otp, otpRecord.otp_hash);

    if (!isMatch) {
        // Increment attempts
        await otpRecord.increment('attempt_count');
        return { valid: false, message: 'Invalid OTP' };
    }

    // Mark used
    otpRecord.is_used = true;
    await otpRecord.save();

    return { valid: true };
};

const sendRegistrationLink = async (mobileNumber, patientName, uhid, ward, bed) => {
    const portalUrl = process.env.VISITOR_PORTAL_URL || 'http://localhost:5173/visitor/register';
    const link = `${portalUrl}/${uhid}`;
    const message = `Sri Balaji Action Medical Institute: ${patientName} has been admitted (Ward: ${ward}, Bed: ${bed}). Please pre-register for your visitor pass here: ${link}`;

    return await sendSMS(mobileNumber, message);
};

module.exports = {
    sendOtpToRelative,
    verifyOtp,
    sendRegistrationLink
};
