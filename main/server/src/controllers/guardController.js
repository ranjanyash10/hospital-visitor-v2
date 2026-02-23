const { VisitorSlip, SlipVerification, User, Patient, Relative, Admission, SystemSetting, AuditLog, sequelize } = require('../models');
const { isAfter } = require('date-fns');
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

    // Assuming plain text match for "password123" if hash fails (for seed data compatibility or just bcrypt)
    // But proper way is bcrypt.compare. Seed data might not have valid bcrypt hash for "password123".
    // Let's assume we create a real user via a script or handle this.
    // For the POC, if password starts with '$2b', use bcrypt.
    let isMatch = false;
    if (user.password_hash.startsWith('$2b')) {
        isMatch = await bcrypt.compare(password, user.password_hash);
    } else {
        isMatch = (password === user.password_hash); // Fallback for simple seed
    }

    if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
        { id: user.id, role: user.role },
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
        // --- 1. Emergency Protocol Check ---
        const lockdown = await SystemSetting.findOne({ where: { key: 'SYSTEM_LOCKDOWN' } });
        if (lockdown?.value === 'TRUE') {
            await AuditLog.create({
                action: 'DENIED_DURING_LOCKDOWN',
                details: `Entry attempt blocked during active lockdown: ${slipToken}`,
                user_id: guardId
            });
            return res.status(403).json({
                valid: false,
                message: 'INSTITUTIONAL LOCKDOWN: All registry signatures currently frozen by Administration.'
            });
        }

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

        if (slip.status === 'EXPIRED' || slip.status === 'REVOKED' || slip.status === 'USED') {
            status = 'DENIED';
            reason = `Slip is ${slip.status}`;
        } else if (isAfter(new Date(), slip.valid_until)) {
            status = 'DENIED';
            reason = 'Slip Expired';
            slip.status = 'EXPIRED';
            await slip.save();
        } else if (slip.status === 'ACTIVE') {
            // Phase Alpha: First Scan - Transition to VISITING
            slip.status = 'VISITING';
            await slip.save();
            status = 'GRANTED';
            reason = 'Registry Handshake Successful: Access Granted';
        } else if (slip.status === 'VISITING') {
            // Phase Omega: Second Scan - Transition to EXPIRED (Checkout)
            slip.status = 'EXPIRED';
            slip.expiryReason = 'CHECKOUT';
            await slip.save();
            status = 'EXPIRED';
            isCheckout = true;
            reason = 'Terminal Handshake Successful: Visitor Checked Out';
        }

        // Log Verification Audit
        await SlipVerification.create({
            slip_id: slip.id,
            verified_by_user_id: guardId,
            status: status === 'GRANTED' || status === 'EXPIRED' ? 'GRANTED' : 'DENIED',
            rejection_reason: reason
        });

        if (isCheckout) {
            return res.json({ valid: true, message: reason, slip, checkout: true });
        }

        if (status === 'DENIED') {
            return res.status(200).json({ valid: false, message: reason, slip });
        }

        res.json({ valid: true, message: reason, slip });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// --- Admin Controller ---
exports.getDashboardStats = async (req, res) => {
    // Simple stats: Active includes both issued (ACTIVE) and currently present (VISITING)
    const activeSlips = await VisitorSlip.count({
        where: {
            status: { [Op.in]: ['ACTIVE', 'VISITING'] }
        }
    });
    const todaySlips = await VisitorSlip.count({
        where: {
            createdAt: { [Op.gt]: new Date(new Date().setHours(0, 0, 0, 0)) }
        }
    });

    const lockdownSetting = await SystemSetting.findOne({ where: { key: 'SYSTEM_LOCKDOWN' } });
    const lockdown = lockdownSetting?.value === 'TRUE';

    res.json({ activeSlips, todaySlips, lockdown });
};

exports.getSlips = async (req, res) => {
    try {
        const { page = 1, limit = 10, date, ward_type, sortBy = 'createdAt', order = 'DESC' } = req.query;
        const offset = (page - 1) * limit;

        const where = {};
        if (date) {
            where.createdAt = {
                [Op.between]: [
                    new Date(new Date(date).setHours(0, 0, 0, 0)),
                    new Date(new Date(date).setHours(23, 59, 59, 999))
                ]
            };
        }
        if (ward_type) {
            where.ward_type = ward_type;
        }

        const { count, rows: slips } = await VisitorSlip.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [[sortBy, order]],
            include: [
                {
                    model: Patient,
                    include: [{
                        model: Admission,
                        where: { status: 'ACTIVE' },
                        required: false
                    }]
                },
                { model: Relative }
            ]
        });

        res.json({
            slips,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.revokeSlip = async (req, res) => {
    try {
        const { id } = req.body;
        const slip = await VisitorSlip.findByPk(id);
        if (!slip) return res.status(404).json({ error: 'Slip not found' });

        slip.status = 'REVOKED';
        slip.expiryReason = 'REVOKED';
        await slip.save();

        await AuditLog.create({
            action: 'SLIP_REVOKED',
            details: `Manual revocation for slip ID: ${id}`,
            user_id: req.user.id
        });

        res.json({ success: true, message: 'Security Clearance Revoked' });
    } catch (error) {
        res.status(500).json({ error: 'Revocation failed' });
    }
};

exports.acceptSlip = async (req, res) => {
    try {
        const { id } = req.body;
        const slip = await VisitorSlip.findByPk(id, { include: [Relative, Patient] });
        if (!slip) return res.status(404).json({ error: 'Slip not found' });

        if (slip.status !== 'ACTIVE') {
            return res.status(400).json({ error: `Cannot accept slip in ${slip.status} state` });
        }

        slip.status = 'VISITING';
        await slip.save();

        // Log manual entry
        await SlipVerification.create({
            slip_id: slip.id,
            verified_by_user_id: req.user.id,
            status: 'GRANTED',
            rejection_reason: 'Manual Accept from Dashboard'
        });

        await AuditLog.create({
            action: 'MANUAL_ENTRY_GRANTED',
            details: `Guard manual entry for ${slip.Relative.name} visitng ${slip.Patient.full_name}`,
            user_id: req.user.id
        });

        res.json({ success: true, message: 'Registry Handshake Successful: Access Granted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Accept failed' });
    }
};
