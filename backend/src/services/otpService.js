const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { addMinutes, isAfter } = require('date-fns');
const { OtpLog } = require('../models');
const twilio = require('twilio');
const { sendWhatsAppMessage } = require('./whatsappService');

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

// Safe log writer to prevent crashes if writing is blocked by permissions (e.g. in read-only containers)
const writeDebugLog = (msg) => {
    try {
        fs.appendFileSync(path.join(__dirname, '../../twilio_debug.log'), msg);
    } catch (error) {
        console.warn(`[TWILIO LOG WARNING] Could not write to twilio_debug.log: ${error.message}`);
    }
};

// Real WhatsApp Sender using local whatsapp-web.js
const sendSMS = async (mobile, message) => {
    try {
        console.log(`[Notification Dispatch] Routing message to ${mobile} via WhatsApp Web Client...`);
        const result = await sendWhatsAppMessage(mobile, message);
        return result;
    } catch (error) {
        console.error(`[Notification Dispatch] WhatsApp Web sending failed:`, error.message);
        // Fallback to mock log so system doesn't crash if sending fails
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

const sendRegistrationLink = async (mobileNumber, patientName, uhid, ward, bed, wardCategory) => {
    const { VISITING_SCHEDULE, formatTimeDisplay } = require('../config/visitingSchedule');

    // If running on DigitalOcean/Cloud, process.env.VISITOR_PORTAL_URL will be set to https://app.ondigitalocean.app/visitor/register
    const portalUrl = process.env.VISITOR_PORTAL_URL || 'http://127.0.0.1:5173/visitor/register';

    // Ensure portalUrl doesn't have a trailing slash before appending UHID
    const base = portalUrl.endsWith('/') ? portalUrl.slice(0, -1) : portalUrl;
    const link = `${base}/${uhid}`;

    // Look up visiting hours for this ward
    const schedule = VISITING_SCHEDULE[wardCategory] || VISITING_SCHEDULE[ward] || VISITING_SCHEDULE['WARD'];
    const morningHours = `${formatTimeDisplay(schedule.morning.from)} - ${formatTimeDisplay(schedule.morning.to)}`;
    const eveningHours = `${formatTimeDisplay(schedule.evening.from)} - ${formatTimeDisplay(schedule.evening.to)}`;

    const message = `Sri Balaji Action Medical Institute: ${patientName} has been admitted (Ward: ${ward}, Bed: ${bed}).\n\nReply with *OK* or any message to receive details and your digital visitor pass link.`;

    return await sendSMS(mobileNumber, message);
};

module.exports = {
    sendOtpToRelative,
    verifyOtp,
    sendRegistrationLink
};
