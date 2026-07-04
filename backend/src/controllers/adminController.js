const { VisitorSlip, SlipVerification, User, Patient, Relative, Admission, AdmissionVisitor, SystemSetting, AuditLog, sequelize } = require('../models');
const { isAfter } = require('date-fns');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { WARD_CATEGORIES, getActiveVisitingWindow } = require('../config/visitingSchedule');

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
    const activeSlips = await VisitorSlip.sum('scanned_count', { where: { status: 'VISITING' } }) || 0;
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
            where.status = { [Op.ne]: 'VISITING' };
        } else {
            where.status = 'VISITING';
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
        const { page = 1, limit = 15, search = '' } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Build patient search condition
        const patientWhere = {};
        if (search && search.trim()) {
            patientWhere[Op.or] = [
                { uhid: { [Op.iLike]: `%${search.trim()}%` } },
                { full_name: { [Op.iLike]: `%${search.trim()}%` } }
            ];
        }

        // Count total matching admissions
        const totalCount = await Admission.count({
            where: { status: 'ACTIVE' },
            include: [{
                model: Patient,
                where: Object.keys(patientWhere).length > 0 ? patientWhere : undefined,
                required: true
            }]
        });

        const admissions = await Admission.findAll({
            where: { status: 'ACTIVE' },
            include: [{
                model: Patient,
                attributes: ['id', 'full_name', 'uhid'],
                where: Object.keys(patientWhere).length > 0 ? patientWhere : undefined,
                required: true
            }],
            order: [['admitted_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        // Filter out orphaned admissions (no linked patient)
        const validAdmissions = admissions.filter(adm => adm.Patient && adm.Patient.id);

        const patients = await Promise.all(validAdmissions.map(async (adm) => {
            const activeVisitorCount = await VisitorSlip.sum('visitor_count', {
                where: {
                    patient_id: adm.Patient.id,
                    status: 'VISITING'
                }
            }) || 0;

            // Find primary relative
            const primaryRelative = await Relative.findOne({
                where: { patient_id: adm.Patient.id, is_primary: true }
            });

            const visitingWindow = getActiveVisitingWindow(adm.ward_category || 'WARD');
            return {
                admission_id: adm.id,
                patient_id: adm.Patient.id,
                patient_name: adm.Patient.full_name,
                uhid: adm.Patient.uhid,
                room_number: adm.room_number,
                bed_number: adm.bed_number,
                ward_type: adm.ward_type,
                ward_category: adm.ward_category || 'WARD',
                max_visitors: adm.max_visitors || 1,
                visit_duration_hours: adm.visit_duration_hours || 1,
                active_visitors: activeVisitorCount,
                relative_name: primaryRelative?.name || '',
                relative_mobile: primaryRelative?.mobile_number || '',
                visiting_allowed: visitingWindow.allowed,
                visiting_session: visitingWindow.session,
                visiting_next: visitingWindow.nextWindow
            };
        }));

        res.json({
            patients,
            pagination: {
                total: totalCount,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalCount / parseInt(limit))
            }
        });
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

exports.updatePatientContact = async (req, res) => {
    try {
        const { id } = req.params; // admission_id
        const { name, mobile_number } = req.body;

        const admission = await Admission.findByPk(id, { include: [Patient] });
        if (!admission) {
            return res.status(404).json({ error: 'Admission not found' });
        }

        const changes = [];

        const cleanedMobile = mobile_number ? mobile_number.replace(/\D/g, '') : null;

        // 1. Update Relative
        const relative = await Relative.findOne({
            where: { patient_id: admission.patient_id, is_primary: true }
        });

        if (relative) {
            const oldMobile = relative.mobile_number;
            if (name) {
                relative.name = name;
                changes.push(`relative_name=${name}`);
            }
            if (cleanedMobile) {
                relative.mobile_number = cleanedMobile;
                changes.push(`relative_mobile=${cleanedMobile}`);
            }
            await relative.save();

            // 2. Aggressive AdmissionVisitor Sync (Kiosk Source of Truth)
            if (cleanedMobile) {
                // Try to find if there's already a visitor with this number for this admission
                const existingVisitor = await AdmissionVisitor.findOne({
                    where: { admission_id: id, mobile_number: cleanedMobile }
                });

                if (!existingVisitor) {
                    // If the new number isn't there, we must update the previous record
                    // We search by the old mobile OR the relationship to be very sure
                    const [updatedRows] = await AdmissionVisitor.update(
                        { mobile_number: cleanedMobile },
                        {
                            where: {
                                admission_id: id,
                                [Op.or]: [
                                    { mobile_number: oldMobile },
                                    { relationship: relative.relationship }
                                ]
                            }
                        }
                    );

                    // If still no rows updated, it means this admission has NO visitor records!
                    // We must create one to enable kiosk lookup.
                    if (updatedRows === 0) {
                        await AdmissionVisitor.create({
                            admission_id: id,
                            mobile_number: cleanedMobile,
                            relationship: relative.relationship || 'Relative'
                        });
                    }
                }
            }
        }

        if (changes.length > 0) {
            console.log(`[UpdateContact] DATABASE UPDATED for Admission ${id}: ${changes.join(', ')}`);
            await AuditLog.create({
                action: 'PATIENT_CONTACT_UPDATED',
                user_id: req.user.id,
                details: `${admission.Patient?.full_name}: ${changes.join(', ')}`,
                ip_address: req.ip
            });
        }

        res.json({ success: true, message: 'Contact details updated' });
    } catch (error) {
        console.error('Update Patient Contact Error:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.getAnalytics = async (req, res) => {
    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(new Date().setDate(now.getDate() - 30));
        const twelveMonthsAgo = new Date(new Date().setFullYear(now.getFullYear() - 1));

        // 1. Monthly Traffic (Last 12 Months)
        const monthlySlips = await VisitorSlip.findAll({
            where: { createdAt: { [Op.gte]: twelveMonthsAgo } },
            attributes: [
                [sequelize.fn('date_trunc', 'month', sequelize.col('createdAt')), 'month'],
                [sequelize.fn('count', sequelize.col('id')), 'count']
            ],
            group: [sequelize.fn('date_trunc', 'month', sequelize.col('createdAt'))],
            order: [[sequelize.fn('date_trunc', 'month', sequelize.col('createdAt')), 'ASC']],
            raw: true
        }).catch(async (err) => {
            // Fallback for SQLite (local dev) if date_trunc fails
            console.log('[Analytics] Falling back to SQLite date parsing');
            return await VisitorSlip.findAll({
                where: { createdAt: { [Op.gte]: twelveMonthsAgo } },
                attributes: ['createdAt'],
                raw: true
            });
        });

        // 2. Daily Trends (Last 30 Days)
        const dailySlips = await VisitorSlip.findAll({
            where: { createdAt: { [Op.gte]: thirtyDaysAgo } },
            attributes: [
                [sequelize.fn('date_trunc', 'day', sequelize.col('createdAt')), 'day'],
                [sequelize.fn('sum', sequelize.col('visitor_count')), 'count']
            ],
            group: [sequelize.fn('date_trunc', 'day', sequelize.col('createdAt'))],
            order: [[sequelize.fn('date_trunc', 'day', sequelize.col('createdAt')), 'ASC']],
            raw: true
        }).catch(async (err) => {
            return await VisitorSlip.findAll({
                where: { createdAt: { [Op.gte]: thirtyDaysAgo } },
                attributes: ['createdAt', 'visitor_count'],
                raw: true
            });
        });

        // 3. Zone Distribution (Now by ward_category for exact hospital location)
        const rawZones = await VisitorSlip.findAll({
            where: { status: { [Op.in]: ['ACTIVE', 'VISITING'] } },
            attributes: [
                ['ward_category', 'key'],
                [sequelize.fn('sum', sequelize.col('visitor_count')), 'value']
            ],
            group: ['ward_category'],
            raw: true
        });

        // Map keys to labels from WARD_CATEGORIES
        const zoneSlips = rawZones.map(z => {
            const val = parseInt(z.value) || 0;
            const categoryKey = z.key || 'GENERAL';
            const category = WARD_CATEGORIES.find(c => c.key === categoryKey) || { label: 'General Ward' };
            
            return {
                name: category.label,
                value: val
            };
        }).filter(z => z.value > 0);

        // Helper to format data in JS if DB grouping failed or for consistency
        const formatMonthly = (data) => {
            if (data.length === 0) return [];
            if (!data[0]?.month) {
                // Manual group by month
                const groups = {};
                data.forEach(s => {
                    const m = new Date(s.createdAt).toLocaleString('default', { month: 'short' });
                    groups[m] = (groups[m] || 0) + 1;
                });
                return Object.entries(groups).map(([name, visits]) => ({ name, visits }));
            }
            return data.map(d => ({
                name: d.month ? new Date(d.month).toLocaleString('default', { month: 'short' }) : 'Unknown',
                visits: parseInt(d.count) || 0
            }));
        };

        const formatDaily = (data) => {
            if (data.length === 0) return [];
            if (!data[0]?.day) {
                const groups = {};
                data.forEach(s => {
                    const d = new Date(s.createdAt).toDateString();
                    groups[d] = (groups[d] || 0) + (s.visitor_count || 1);
                });
                return Array.from({ length: 30 }, (_, i) => {
                    const dObj = new Date(new Date().setDate(now.getDate() - (29 - i)));
                    const dStr = dObj.toDateString();
                    return { day: dObj.getDate(), count: groups[dStr] || 0 };
                });
            }
            // Map real data to 30-day buckets
            const map = new Map();
            data.forEach(d => {
                if (d.day) map.set(new Date(d.day).toDateString(), parseInt(d.count) || 0);
            });
            return Array.from({ length: 30 }, (_, i) => {
                const dObj = new Date(new Date().setDate(now.getDate() - (29 - i)));
                const dStr = dObj.toDateString();
                return { day: dObj.getDate(), count: map.get(dStr) || 0 };
            });
        };

        // 4. Checkout Breakdown (Self vs Forced vs Auto)
        const rawExits = await VisitorSlip.findAll({
            where: { 
                status: 'EXPIRED',
                expiryReason: { [Op.ne]: null }
            },
            attributes: [
                'expiryReason',
                [sequelize.fn('count', sequelize.col('id')), 'count']
            ],
            group: ['expiryReason'],
            raw: true
        });

        const checkoutBreakdown = [
            { name: 'Self Exit', value: 0 },
            { name: 'Overstay / Expired', value: 0 }
        ];

        rawExits.forEach(e => {
            const count = parseInt(e.count) || 0;
            if (e.expiryReason === 'REGULAR_EXIT' || e.expiryReason === 'MANUAL_CHECKOUT') {
                checkoutBreakdown[0].value += count;
            } else {
                // Includes FORCED_EXIT, TIME_LAPSED, AUTO_TIMEOUT
                checkoutBreakdown[1].value += count;
            }
        });

        res.json({
            monthly: formatMonthly(monthlySlips),
            daily: formatDaily(dailySlips),
            zones: zoneSlips.map(z => ({ name: z.name || 'Unknown', value: parseInt(z.value) })),
            exits: checkoutBreakdown.filter(b => b.value > 0)
        });

    } catch (error) {
        console.error('Analytics Error:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.updateGuard = async (req, res) => {
    const { id } = req.params;
    const { username } = req.body;
    try {
        const guard = await User.findOne({ where: { id, role: 'GUARD' } });
        if (!guard) return res.status(404).json({ error: 'Guard not found' });

        const oldUsername = guard.username;
        guard.username = username;
        await guard.save();

        await AuditLog.create({
            action: 'GUARD_UPDATED',
            details: `Guard username changed from ${oldUsername} to ${username}`,
            user_id: req.user.id
        });

        res.json({ success: true, guard });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update guard' });
    }
};

exports.resetGuardPassword = async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;
    try {
        const guard = await User.findOne({ where: { id, role: 'GUARD' } });
        if (!guard) return res.status(404).json({ error: 'Guard not found' });

        guard.password_hash = await bcrypt.hash(newPassword, 10);
        await guard.save();

        await AuditLog.create({
            action: 'GUARD_PASSWORD_RESET',
            details: `Password reset for guard: ${guard.username} by Admin`,
            user_id: req.user.id
        });

        res.json({ success: true, message: 'Password reset successful' });
    } catch (error) {
        res.status(500).json({ error: 'Password reset failed' });
    }
};

exports.updateMyPassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;
    try {
        const user = await User.findByPk(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Verify old password
        let isMatch = false;
        if (user.password_hash.startsWith('$2b')) {
            isMatch = await bcrypt.compare(oldPassword, user.password_hash);
        } else {
            isMatch = (oldPassword === user.password_hash);
        }

        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect previous password' });
        }

        user.password_hash = await bcrypt.hash(newPassword, 10);
        await user.save();

        await AuditLog.create({
            action: 'ADMIN_PASSWORD_UPDATED',
            details: `Admin ${user.username} updated their own password`,
            user_id: userId
        });

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update password' });
    }
};

// --- Patient Admission Logic (V2 Simulation) ---
exports.admitPatient = async (req, res) => {
    try {
        const { uhid, full_name, mobile_number, relative_name, ward_type, ward_category, room_number, bed_number, max_visitors, visit_duration_hours } = req.body;

        if (!uhid || !full_name || !mobile_number) {
            return res.status(400).json({ error: 'UHID, Full Name, and Mobile are required' });
        }

        // 1. Transactional Update/Create
        const result = await sequelize.transaction(async (t) => {
            // Find or Create Patient
            const [patient] = await Patient.findOrCreate({
                where: { uhid },
                defaults: { full_name, gender: req.body.gender || 'Other' },
                transaction: t
            });

            // Create Admission
            const admission = await Admission.create({
                patient_id: patient.id,
                room_number,
                bed_number,
                ward_type: ward_type || 'GENERAL',
                ward_category: ward_category || 'WARD',
                max_visitors: max_visitors || 1,
                visit_duration_hours: visit_duration_hours || 1,
                status: 'ACTIVE',
                admitted_at: new Date()
            }, { transaction: t });

            // Create/Update Relative
            const [relative] = await Relative.findOrCreate({
                where: { patient_id: patient.id, is_primary: true },
                defaults: {
                    name: relative_name || 'Relative',
                    mobile_number,
                    relationship: 'Primary'
                },
                transaction: t
            });

            // Update relative if exists
            if (relative_name) relative.name = relative_name;
            relative.mobile_number = mobile_number;
            await relative.save({ transaction: t });

            // Create AdmissionVisitor (Authorization)
            const cleanedMobile = mobile_number.replace(/\D/g, '');
            await AdmissionVisitor.create({
                admission_id: admission.id,
                mobile_number: cleanedMobile,
                relationship: 'Primary'
            }, { transaction: t });

            return { patient, admission, relative };
        });

        // 2. Trigger WhatsApp (Async, non-blocking)
        const { sendRegistrationLink } = require('../services/otpService');
        // We use the cleaned mobile for Twilio
        const cleanedMobile = mobile_number.replace(/\D/g, '');
        sendRegistrationLink(cleanedMobile, full_name, uhid, ward_type, bed_number, ward_category).catch(err => console.error('WhatsApp failed:', err));

        res.json({
            success: true,
            message: 'Patient admitted and notification sent',
            admission_id: result.admission.id,
            uhid: uhid
        });
    } catch (error) {
        console.error('Admission Error:', error);
        res.status(500).json({ error: 'Failed to admit patient: ' + error.message });
    }
};

exports.resendWhatsAppLink = async (req, res) => {
    try {
        const { id } = req.params;
        const admission = await Admission.findByPk(id, {
            include: [
                { model: Patient, include: [{ model: Relative, where: { is_primary: true }, required: false }] }
            ]
        });

        if (!admission) {
            return res.status(404).json({ error: 'Admission not found' });
        }

        const patient = admission.Patient;
        if (!patient) {
            return res.status(404).json({ error: 'Linked Patient not found' });
        }

        const relative = patient.Relatives?.[0];
        if (!relative || !relative.mobile_number) {
            return res.status(400).json({ error: 'No primary relative contact with a valid mobile number found' });
        }

        const { sendRegistrationLink } = require('../services/otpService');
        const cleanedMobile = relative.mobile_number.replace(/\D/g, '');
        
        await sendRegistrationLink(
            cleanedMobile,
            patient.full_name,
            patient.uhid,
            admission.ward_type,
            admission.bed_number,
            admission.ward_category
        );

        res.json({ success: true, message: 'Invitation WhatsApp link resent successfully.' });
    } catch (error) {
        console.error('Resend Error:', error);
        res.status(500).json({ error: 'Failed to resend link: ' + error.message });
    }
};
