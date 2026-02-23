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

        // Validations
        let status = 'GRANTED';
        let reason = null;

        if (slip.status !== 'ACTIVE') {
            status = 'DENIED';
            reason = `Slip is ${slip.status}`;
        } else if (isAfter(new Date(), slip.valid_until)) {
            status = 'DENIED';
            reason = 'Slip Expired';
            // Auto-update status
            slip.status = 'EXPIRED';
            await slip.save();
        }

        // Log Verification
        await SlipVerification.create({
            slip_id: slip.id,
            verified_by_user_id: guardId,
            status: status,
            rejection_reason: reason
        });

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

    const lockdownSetting = await SystemSetting.findOne({ where: { key: 'SYSTEM_LOCKDOWN' } });
    const lockdown = lockdownSetting?.value === 'TRUE';

    res.json({ activeSlips, todaySlips, lockdown });
};

exports.getSlips = async (req, res) => {
    try {
        const { page = 1, limit = 10, date, ward_type, sortBy = 'createdAt', order = 'DESC', archive = 'false' } = req.query;
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

        // Archive logic: if archive=true, show only non-active slips
        if (archive === 'true') {
            where.status = { [Op.ne]: 'ACTIVE' };
        } else {
            where.status = 'ACTIVE';
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
            ],
            attributes: ['id', 'slip_token', 'ward_type', 'status', 'expiryReason', 'createdAt']
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
    const { id } = req.body;
    const slip = await VisitorSlip.findByPk(id);
    if (!slip) return res.status(404).json({ error: 'Slip not found' });

    slip.status = 'REVOKED';
    slip.expiryReason = 'REVOKED';
    await slip.save();

    // Audit Log
    await AuditLog.create({
        action: 'SLIP_REVOCATION',
        details: `Slip ${slip.slip_token} manually revoked by Admin`,
        user_id: req.user.id
    });

    res.json({ success: true, message: 'Slip revoked' });
};

// --- Human Assets (Guards) ---
exports.getGuards = async (req, res) => {
    const guards = await User.findAll({
        where: { role: 'GUARD' },
        attributes: ['id', 'username', 'createdAt']
    });
    res.json(guards);
};

exports.createGuard = async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const guard = await User.create({ username, password_hash: hashedPassword, role: 'GUARD' });

    await AuditLog.create({
        action: 'GUARD_CREATED',
        details: `Guard account created: ${username}`,
        user_id: req.user.id
    });

    res.json(guard);
};

// --- Facility Topology ---
exports.getTopology = async (req, res) => {
    try {
        // Return all active admissions, including visitor telemetry if available
        const topology = await Admission.findAll({
            where: { status: 'ACTIVE' },
            include: [{
                model: Patient,
                attributes: ['full_name'],
                include: [{
                    model: VisitorSlip,
                    required: false,
                    include: [{ model: Relative, attributes: ['name', 'mobile_number'] }]
                }]
            }],
            order: [
                ['room_number', 'ASC'],
                ['bed_number', 'ASC'],
                [Patient, VisitorSlip, 'createdAt', 'DESC']
            ]
        });
        res.json(topology);
    } catch (error) {
        console.error('Topology fetch error:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// --- Security Audit ---
exports.getAudits = async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows: audits } = await AuditLog.findAndCountAll({
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']],
        include: [{ model: User, attributes: ['username'] }]
    });

    res.json({ audits, total: count });
};

// --- Node Settings ---
exports.getSettings = async (req, res) => {
    const settings = await SystemSetting.findAll();
    res.json(settings);
};

exports.updateSetting = async (req, res) => {
    const { key, value } = req.body;
    await SystemSetting.upsert({ key, value });

    await AuditLog.create({
        action: 'SETTING_UPDATE',
        details: `Configuration changed: ${key} = ${value}`,
        user_id: req.user.id
    });

    res.json({ success: true });
};

// --- Emergency Protocol ---
exports.toggleLockdown = async (req, res) => {
    const setting = await SystemSetting.findOne({ where: { key: 'SYSTEM_LOCKDOWN' } });
    const newState = setting?.value === 'TRUE' ? 'FALSE' : 'TRUE';

    await SystemSetting.upsert({ key: 'SYSTEM_LOCKDOWN', value: newState });

    await AuditLog.create({
        action: newState === 'TRUE' ? 'EMERGENCY_LOCKDOWN' : 'SYSTEM_RECOVERY',
        details: newState === 'TRUE' ? 'Emergency Protocol Initiated: Institutional Secure State' : 'Emergency Protocol Terminated: Resume Normal Operations',
        user_id: req.user.id
    });

    res.json({ lockdown: newState === 'TRUE' });
};

// --- Patient Visitor Management ---
exports.getPatients = async (req, res) => {
    try {
        const admissions = await Admission.findAll({
            where: { status: 'ACTIVE' },
            include: [{
                model: Patient,
                attributes: ['id', 'full_name', 'uhid']
            }],
            order: [['admitted_at', 'DESC']]
        });

        const patients = await Promise.all(admissions.map(async (adm) => {
            const activeVisitorCount = await VisitorSlip.sum('visitor_count', {
                where: {
                    patient_id: adm.Patient.id,
                    status: { [Op.in]: ['ACTIVE', 'VISITING'] }
                }
            }) || 0;

            return {
                admission_id: adm.id,
                patient_id: adm.Patient.id,
                patient_name: adm.Patient.full_name,
                uhid: adm.Patient.uhid,
                room_number: adm.room_number,
                bed_number: adm.bed_number,
                ward_type: adm.ward_type,
                max_visitors: adm.max_visitors || 1,
                visit_duration_hours: adm.visit_duration_hours || 1,
                active_visitors: activeVisitorCount
            };
        }));

        res.json(patients);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.updateMaxVisitors = async (req, res) => {
    try {
        const { id } = req.params;
        const { max_visitors, visit_duration_hours } = req.body;

        const admission = await Admission.findByPk(id, {
            include: [{ model: Patient, attributes: ['full_name'] }]
        });

        if (!admission) {
            return res.status(404).json({ error: 'Admission not found' });
        }

        const changes = [];

        if (max_visitors !== undefined) {
            if (max_visitors < 1 || max_visitors > 20) {
                return res.status(400).json({ error: 'max_visitors must be between 1 and 20' });
            }
            admission.max_visitors = max_visitors;
            changes.push(`max_visitors=${max_visitors}`);
        }

        if (visit_duration_hours !== undefined) {
            if (visit_duration_hours < 0.5 || visit_duration_hours > 24) {
                return res.status(400).json({ error: 'visit_duration_hours must be between 0.5 and 24' });
            }
            admission.visit_duration_hours = visit_duration_hours;
            changes.push(`visit_duration=${visit_duration_hours}h`);
        }

        if (changes.length === 0) {
            return res.json({ success: true, message: 'No changes made' });
        }

        try {
            await admission.save();
            console.log(`Saved admission ${id} with changes: ${changes.join(', ')}`);
        } catch (saveError) {
            console.error('Failed to save admission:', saveError);
            return res.status(500).json({ error: `Save failed: ${saveError.message}` });
        }

        try {
            await AuditLog.create({
                action: 'ADMISSION_SETTINGS_UPDATED',
                user_id: req.user.id,
                details: `${admission.Patient?.full_name || 'Patient'}: ${changes.join(', ')} by ${req.user.username}`,
                ip_address: req.ip
            });
        } catch (auditError) {
            console.error('Audit Log failed (non-blocking):', auditError);
            // We don't return error here because the main update succeeded
        }

        res.json({
            success: true,
            max_visitors: admission.max_visitors,
            visit_duration_hours: admission.visit_duration_hours
        });
    } catch (error) {
        console.error('Update Max Visitors Error:', error);
        res.status(500).json({ error: error.message || 'Server Error' });
    }
};
