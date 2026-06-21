const { VisitorSlip, SlipVerification, User, Patient, Relative, Admission, SystemSetting, AuditLog, sequelize } = require('../models');
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
                { model: Relative, attributes: ['name', 'relationship'] },
                { model: Admission, attributes: ['max_visitors', 'status', 'room_number', 'bed_number', 'visit_duration_hours'] }
            ]
        });

        if (!slip) {
            return res.status(404).json({ valid: false, message: 'Slip not found' });
        }

        let status = 'DENIED';
        let reason = 'Unknown error';

        // 1. Basic Status Checks
        if (slip.status === 'REVOKED') {
            status = 'DENIED';
            reason = 'Slip Revoked by Administration';
        } else if (slip.status === 'EXPIRED' || slip.status === 'USED') {
            if (slip.expiryReason === 'AUTO_TIMEOUT' && slip.scanned_count > 0) {
                slip.expiryReason = 'REGULAR_EXIT';
                await slip.save();
                status = 'EXIT_GRANTED';
                reason = 'Checkout Successful: Thank you for visiting.';
            } else {
                status = 'DENIED';
                reason = 'Slip already used or expired';
            }
        } else if (slip.valid_until && isAfter(new Date(), slip.valid_until)) {
            if (slip.status === 'VISITING') {
                slip.status = 'EXPIRED';
                slip.expiryReason = 'REGULAR_EXIT';
                await slip.save();
                status = 'EXIT_GRANTED';
                reason = 'Checkout Successful: Thank you for visiting.';
            } else {
                status = 'DENIED';
                reason = 'Slip Expired (Time limit reached)';
                slip.status = 'EXPIRED';
                slip.expiryReason = 'TIME_LAPSED';
                await slip.save();
            }
        } 
        // 2. EXIT LOGIC (If they are already inside)
        else if (slip.status === 'VISITING') {
            slip.status = 'EXPIRED';
            slip.expiryReason = 'REGULAR_EXIT';
            await slip.save();
            status = 'EXIT_GRANTED';
            reason = 'Checkout Successful: Thank you for visiting.';
        }
        // 3. ENTRY LOGIC (If they are trying to enter)
        else if (slip.status === 'ACTIVE') {
            const maxAllowed = slip.Admission?.max_visitors || 1;

            // Strict Concurrency: Check how many people are ALREADY inside for this patient
            const currentVisitingCount = await VisitorSlip.sum('visitor_count', {
                where: {
                    patient_id: slip.patient_id,
                    status: 'VISITING'
                }
            }) || 0;

            if (currentVisitingCount + slip.visitor_count > maxAllowed) {
                status = 'DENIED';
                reason = `Access Denied: Patient already has ${currentVisitingCount} visitor(s) inside. Max allowed is ${maxAllowed}. Please wait for others to exit.`;
            } else {
                if (slip.ward_category === 'ICU') {
                    if (slip.scanned_count === 0) {
                        slip.scanned_count = 1;
                        await slip.save();
                        status = 'GRANTED';
                        reason = 'Access Granted: Welcome to the hospital entrance (ICU visitor).';
                    } else if (slip.scanned_count === 1) {
                        if (!slip.valid_until) {
                            const durationHours = slip.Admission?.visit_duration_hours || parseFloat(process.env.SLIP_VALIDITY_HOURS) || 1;
                            slip.valid_until = addHours(new Date(), durationHours);
                        }
                        slip.scanned_count = 2;
                        slip.status = 'VISITING';
                        await slip.save();
                        status = 'GRANTED';
                        reason = 'Access Granted: Welcome to the ICU.';
                    }
                } else {
                    if (!slip.valid_until) {
                        const durationHours = slip.Admission?.visit_duration_hours || parseFloat(process.env.SLIP_VALIDITY_HOURS) || 1;
                        slip.valid_until = addHours(new Date(), durationHours);
                    }
                    slip.scanned_count = 1;
                    slip.status = 'VISITING';
                    await slip.save();
                    status = 'GRANTED';
                    reason = 'Access Granted: Welcome to the facility.';
                }
            }
        }

        // Log Verification Audit
        await SlipVerification.create({
            slip_id: slip.id,
            verified_by_user_id: guardId,
            status: (status === 'GRANTED' || status === 'EXIT_GRANTED') ? 'GRANTED' : 'DENIED',
            rejection_reason: reason
        });

        if (status === 'DENIED') {
            return res.status(200).json({ valid: false, message: reason, slip });
        }

        res.json({
            valid: true,
            status: status, // GRANTED or EXIT_GRANTED
            message: reason,
            slip: {
                ...slip.toJSON(),
                patient_name: slip.Patient?.full_name,
                uhid: slip.Patient?.uhid,
                room_number: slip.Admission?.room_number,
                bed_number: slip.Admission?.bed_number,
                scanned_count: slip.scanned_count,
                max_visitors: slip.Admission?.max_visitors || 1,
                permit_type: slip.permit_type || 'REGULAR',
                valid_until: slip.valid_until
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// --- Admin Controller ---
exports.getDashboardStats = async (req, res) => {
    // Active slips refers ONLY to visitors currently present in the building (status: VISITING)
    const activeSlips = await VisitorSlip.sum('scanned_count', {
        where: {
            status: 'VISITING'
        }
    }) || 0;
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
        const slip = await VisitorSlip.findByPk(id, { include: [Relative, Patient, Admission] });
        if (!slip) return res.status(404).json({ error: 'Slip not found' });

        if (slip.status !== 'ACTIVE') {
            return res.status(400).json({ error: `Cannot accept slip in ${slip.status} state` });
        }

        if (slip.ward_category === 'ICU') {
            if (slip.scanned_count === 0) {
                slip.scanned_count = 1;
            } else if (slip.scanned_count === 1) {
                if (!slip.valid_until) {
                    const durationHours = slip.Admission?.visit_duration_hours || parseFloat(process.env.SLIP_VALIDITY_HOURS) || 1;
                    slip.valid_until = addHours(new Date(), durationHours);
                }
                slip.scanned_count = 2;
                slip.status = 'VISITING';
            }
        } else {
            if (!slip.valid_until) {
                const durationHours = slip.Admission?.visit_duration_hours || parseFloat(process.env.SLIP_VALIDITY_HOURS) || 1;
                slip.valid_until = addHours(new Date(), durationHours);
            }
            slip.scanned_count = 1;
            slip.status = 'VISITING';
        }
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
            details: `Guard manual entry for ${slip.Relative?.name || 'GUEST'} visiting ${slip.Patient?.full_name || 'Patient'}`,
            user_id: req.user.id
        });

        res.json({ success: true, message: 'Registry Handshake Successful: Access Granted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Accept failed' });
    }
};

exports.checkoutSlip = async (req, res) => {
    try {
        const { id, forced = false } = req.body;
        const slip = await VisitorSlip.findByPk(id);
        if (!slip) return res.status(404).json({ error: 'Slip not found' });

        slip.status = 'EXPIRED';
        slip.expiryReason = forced ? 'FORCED_EXIT' : 'MANUAL_CHECKOUT';
        await slip.save();

        await AuditLog.create({
            action: forced ? 'GUARD_FORCED_EXIT' : 'SLIP_CHECKOUT',
            details: `${forced ? 'FORCED EXIT' : 'Manual checkout'} for slip ID: ${id}`,
            user_id: req.user.id
        });

        res.json({ success: true, message: forced ? 'Visitor Removed and Logged' : 'Visitor Checked Out Successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Checkout failed' });
    }
};
