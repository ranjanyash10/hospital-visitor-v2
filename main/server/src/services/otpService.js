const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { addMinutes, isAfter } = require('date-fns');
const { OtpLog } = require('../models');

// Mock SMS Sender
const sendSMS = async (mobile, message) => {
    // In a real app, integrate with Twilio, AWS SNS, etc.
    console.log(`[MOCK SMS] To: ${mobile} | Message: ${message}`);
    return true;
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

module.exports = {
    sendOtpToRelative,
    verifyOtp
};
