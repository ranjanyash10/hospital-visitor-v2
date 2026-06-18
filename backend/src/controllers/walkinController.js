const { Patient, Admission, Relative, VisitorSlip, AuditLog, sequelize } = require('../models');
const { Op } = require('sequelize');
const { subHours } = require('date-fns');
const crypto = require('crypto');
const { getActiveVisitingWindow } = require('../config/visitingSchedule');

const DAILY_LIMITS = {
    GENERAL: 2,
    PRIVATE: 3
};

// 1. Patient Lookup by UHID or Name
exports.lookupPatient = async (req, res) => {
    try {
        const { query } = req.body;

        if (!query || query.trim().length < 2) {
            return res.status(400).json({ error: 'Search query must be at least 2 characters' });
        }

        const searchTerm = query.trim();

        // Search by UHID (exact) or name (partial)
        const patients = await Patient.findAll({
            where: {
                [Op.or]: [
                    { uhid: searchTerm.toUpperCase() },
                    { full_name: { [Op.iLike]: `%${searchTerm}%` } }
                ]
            },
            include: [{
                model: Admission,
                where: { status: 'ACTIVE' },
                required: true
            }],
            limit: 10
        });

        if (patients.length === 0) {
            return res.status(404).json({ error: 'No active admissions found for this search' });
        }

        const results = patients.map(p => {
            const admission = p.Admissions[0];
            const wardCategory = admission.ward_category || 'WARD';
            const visitingWindow = getActiveVisitingWindow(wardCategory);

            return {
                patient_id: p.id,
                name: p.full_name,
                uhid: p.uhid,
                admission_id: admission.id,
                room_number: admission.room_number,
                bed_number: admission.bed_number,
                ward_type: admission.ward_type,
                ward_category: wardCategory,
                category_label: visitingWindow.categoryLabel,
                visiting_allowed: visitingWindow.allowed,
                visiting_session: visitingWindow.session,
                visiting_next: visitingWindow.nextWindow,
                max_visitors: admission.max_visitors
            };
        });

        await AuditLog.create({
            action: 'WALKIN_PATIENT_LOOKUP',
            details: `Walk-in kiosk lookup: "${searchTerm}" → ${results.length} result(s)`,
            ip_address: req.ip
        });

        res.json({ success: true, patients: results });

    } catch (error) {
        console.error('Walk-in lookup error:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// 2. Register Walk-In Visitor & Generate Slip
exports.registerWalkIn = async (req, res) => {
    try {
        const {
            patient_id,
            admission_id,
            visitor_name,
            visitor_age,
            visitor_gender,
            id_type,
            id_number,
            visitor_count = 1
        } = req.body;

        // Validate required fields
        if (!patient_id || !admission_id || !visitor_name) {
            return res.status(400).json({ error: 'Missing required fields: visitor_name' });
        }

        // Get active admission
        const admission = await Admission.findOne({
            where: { id: admission_id, patient_id, status: 'ACTIVE' },
            include: [{ model: Patient, attributes: ['full_name', 'uhid'] }]
        });

        if (!admission) {
            return res.status(404).json({ error: 'No active admission found' });
        }

        const wardType = admission.ward_type;
        const wardCategory = admission.ward_category || 'WARD';
        const maxConcurrent = admission.max_visitors || 1;
        const dailyLimit = DAILY_LIMITS[wardType] || 2;

        // Check capacity (concurrent visitors)
        const activeSum = await VisitorSlip.sum('visitor_count', {
            where: {
                patient_id,
                status: 'VISITING'
            }
        }) || 0;

        const remainingSlots = maxConcurrent - activeSum;
        if (remainingSlots <= 0) {
            return res.status(400).json({
                error: `Maximum concurrent visitors reached (${maxConcurrent} allowed). Please wait until someone exits.`
            });
        }

        if (visitor_count > remainingSlots) {
            return res.status(400).json({
                error: `Only ${remainingSlots} visitor slot(s) remaining. Cannot admit ${visitor_count}.`
            });
        }

        // Check daily limit
        const oneDayAgo = subHours(new Date(), 24);
        const dailyCount = await VisitorSlip.count({
            where: {
                patient_id,
                createdAt: { [Op.gt]: oneDayAgo },
                status: { [Op.ne]: 'REVOKED' }
            }
        });

        if (dailyCount >= dailyLimit) {
            return res.status(400).json({
                error: `Daily visitor limit reached for ${wardType} ward (${dailyLimit} max)`
            });
        }

        // Determine permit type based on visiting hours
        const visitingWindow = getActiveVisitingWindow(wardCategory);
        const permitType = visitingWindow.allowed ? 'REGULAR' : 'AFTER_HOURS';

        // Create walk-in relative record for audit trail
        const [relative] = await Relative.findOrCreate({
            where: {
                patient_id,
                name: visitor_name.trim(),
                mobile_number: 'WALK-IN'
            },
            defaults: {
                relationship: 'Walk-In Visitor'
            }
        });

        // Generate separate slips (one for each person in visitor_count)
        const createdSlips = [];
        for (let i = 0; i < visitor_count; i++) {
            const slipToken = crypto.randomBytes(8).toString('hex').toUpperCase();

            const slip = await VisitorSlip.create({
                slip_token: slipToken,
                patient_id,
                admission_id,
                relative_id: relative.id,
                mobile_number: 'WALK-IN',
                ward_type: wardType,
                valid_until: null, // Timer starts on QR scan
                status: 'ACTIVE',
                qr_code_data: slipToken,
                visitor_count: 1, // Separate QR for each person
                visitor_name: visitor_name.trim(),
                visitor_age: visitor_age || null,
                visitor_gender: visitor_gender || null,
                id_type: id_type || null,
                id_number: id_number ? id_number.trim() : null,
                permit_type: permitType,
                ward_category: wardCategory
            });

            createdSlips.push(slip);
        }

        // Audit log
        await AuditLog.create({
            action: 'WALKIN_SLIP_GENERATED',
            details: `Walk-in ${permitType} permit generated for ${createdSlips.length} visitor(s): ${visitor_name} → ${admission.Patient.full_name} (${wardCategory})`,
            ip_address: req.ip
        });

        const formattedSlips = createdSlips.map(s => ({
            id: s.id,
            slip_token: s.slip_token,
            ward_type: s.ward_type,
            valid_until: s.valid_until,
            permit_type: permitType,
            visitor_name: s.visitor_name,
            visitor_count: 1
        }));

        res.json({
            success: true,
            slips: formattedSlips,
            slip: {
                ...formattedSlips[0],
                visitor_count: visitor_count // compatibility for legacy/single slip displays
            },
            patient: {
                name: admission.Patient.full_name,
                uhid: admission.Patient.uhid,
                room_number: admission.room_number,
                bed_number: admission.bed_number,
                ward_category: wardCategory
            }
        });

    } catch (error) {
        console.error('Walk-in register error:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};
