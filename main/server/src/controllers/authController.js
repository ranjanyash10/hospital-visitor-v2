const { VisitorSlip, SlipVerification, User, Patient, Relative, Admission, StaffSession, sequelize } = require('../models');
const { isAfter, addHours } = require('date-fns');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');

// --- Auth Controller ---
exports.login = async (req, res) => {
    const { username, password } = req.body;

    const user = await User.findOne({ where: { username } });
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify Password (Strict Bicrypt)
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create Opaque Staff Session
    const session = await StaffSession.create({
        user_id: user.id,
        expires_at: addHours(new Date(), 12) // 12h session matching JWT
    });

    const token = jwt.sign(
        { sessionId: session.id }, // Only Session ID in JWT
        process.env.JWT_SECRET,
        { expiresIn: '12h' }
    );

    res.json({ token, role: user.role });
};

// --- Guard Controller ---
exports.verifySlip = async (req, res) => {
    const { slipToken } = req.body;
    const guardId = req.user.id; // From middleware

    try {
        const slip = await VisitorSlip.findOne({
            where: { slip_token: slipToken },
            include: [
                { model: Patient, attributes: ['full_name', 'uhid'] },
                { model: Relative, attributes: ['name', 'relationship'] }
            ]
        });

        if (!slip) {
            return res.status(404).json({ valid: false, message: 'Slip not found' });
        }

        // Check for checkout: If slip is ACTIVE but already has a GRANTED verification
        const previousVerification = await SlipVerification.findOne({
            where: {
                slip_id: slip.id,
                status: 'GRANTED'
            }
        });

        let status = 'GRANTED';
        let reason = null;
        let isCheckout = false;

        if (slip.status !== 'ACTIVE') {
            status = 'DENIED';
            reason = `Slip is ${slip.status}`;
        } else if (isAfter(new Date(), slip.valid_until)) {
            status = 'DENIED';
            reason = 'Slip Expired';
            slip.status = 'EXPIRED';
            await slip.save();
        } else if (previousVerification) {
            // Second scan of an active slip = Check-out
            status = 'EXPIRED'; // Mark as expired on checkout per user request
            slip.status = 'EXPIRED';
            await slip.save();
            isCheckout = true;
            reason = 'Visitor Checked Out';
        }

        // Log Verification
        await SlipVerification.create({
            slip_id: slip.id,
            verified_by_user_id: guardId,
            status: status === 'GRANTED' ? 'GRANTED' : 'DENIED', // Log as DENIED if it's already used/checked out
            rejection_reason: reason
        });

        if (isCheckout) {
            return res.json({ valid: true, message: 'Checked Out Successfully', slip, checkout: true });
        }

        if (status === 'DENIED') {
            return res.status(200).json({ valid: false, message: reason, slip });
        }

        res.json({ valid: true, message: 'Access Granted', slip });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// --- Admin Controller ---
exports.getDashboardStats = async (req, res) => {
    // Simple stats
    const activeSlips = await VisitorSlip.count({ where: { status: 'ACTIVE' } });
    const todaySlips = await VisitorSlip.count({
        where: {
            createdAt: { [Op.gt]: new Date(new Date().setHours(0, 0, 0, 0)) }
        }
    });

    res.json({ activeSlips, todaySlips });
};

exports.getSlips = async (req, res) => {
    const slips = await VisitorSlip.findAll({
        limit: 50,
        order: [['createdAt', 'DESC']],
        include: [
            { model: Patient, attributes: ['full_name'] },
            { model: Relative, attributes: ['name'] }
        ],
        attributes: ['id', 'slip_token', 'ward_type', 'status', 'expiryReason', 'createdAt']
    });
    res.json(slips);
};

exports.revokeSlip = async (req, res) => {
    const { id } = req.body;
    const slip = await VisitorSlip.findByPk(id);
    if (!slip) return res.status(404).json({ error: 'Slip not found' });

    slip.status = 'REVOKED';
    slip.expiryReason = 'REVOKED';
    await slip.save();
    res.json({ success: true, message: 'Slip revoked' });
};
