const { VisitorSlip, Admission, Patient, sequelize } = require('../models');
const { addHours, isAfter, subHours } = require('date-fns');
const { Op } = require('sequelize');
const crypto = require('crypto');

const DAILY_LIMITS = {
    GENERAL: 2,
    PRIVATE: 3
};

const checkLimits = async (patientId) => {
    // Find active admission to get ward type + max_visitors
    const admission = await Admission.findOne({
        where: { patient_id: patientId, status: 'ACTIVE' }
    });

    if (!admission) {
        throw new Error('No active admission found for patient');
    }

    const wardType = admission.ward_type;
    const dailyLimit = DAILY_LIMITS[wardType] || 2;
    const maxConcurrent = admission.max_visitors || 1;

    // Phase 1: Count currently ACTIVE visitors (sum of visitor_count)
    const activeSum = await VisitorSlip.sum('visitor_count', {
        where: {
            patient_id: patientId,
            status: { [Op.in]: ['ACTIVE', 'VISITING'] }
        }
    }) || 0;

    const remainingSlots = maxConcurrent - activeSum;

    if (remainingSlots <= 0) {
        return {
            allowed: false,
            message: `Maximum concurrent visitors reached (${maxConcurrent} allowed). Please wait until someone exits.`,
            remainingSlots: 0,
            maxConcurrent
        };
    }

    // Phase 2: Count slips in last 24 hours (Daily Limit)
    const oneDayAgo = subHours(new Date(), 24);
    const dailyCount = await VisitorSlip.count({
        where: {
            patient_id: patientId,
            createdAt: { [Op.gt]: oneDayAgo },
            status: { [Op.ne]: 'REVOKED' }
        }
    });

    if (dailyCount >= dailyLimit) {
        return {
            allowed: false,
            message: `Daily visitor limit reached for ${wardType} ward (${dailyLimit} max)`,
            remainingSlots: 0,
            maxConcurrent
        };
    }

    return { allowed: true, wardType, remainingSlots, maxConcurrent };
};

const generateSlip = async (patientId, relativeId, mobileNumber, visitorCount = 1) => {
    // 1. Check limits
    const { allowed, wardType, message, remainingSlots } = await checkLimits(patientId);
    if (!allowed) {
        throw new Error(message);
    }

    // 2. Validate visitor_count doesn't exceed remaining slots
    if (visitorCount > remainingSlots) {
        throw new Error(`Only ${remainingSlots} visitor slot(s) remaining. Cannot admit ${visitorCount}.`);
    }

    // Find active admission
    const admission = await Admission.findOne({
        where: { patient_id: patientId, status: 'ACTIVE' }
    });

    if (!admission) {
        throw new Error('No active admission found for patient');
    }

    // 3. Create Slip — use per-patient visit duration
    const durationHours = admission.visit_duration_hours || parseFloat(process.env.SLIP_VALIDITY_HOURS) || 1;
    const validUntil = addHours(new Date(), durationHours);
    const slipToken = crypto.randomBytes(8).toString('hex').toUpperCase();

    const slip = await VisitorSlip.create({
        slip_token: slipToken,
        patient_id: patientId,
        admission_id: admission.id,
        relative_id: relativeId,
        mobile_number: mobileNumber,
        ward_type: wardType,
        valid_until: validUntil,
        status: 'ACTIVE',
        qr_code_data: slipToken,
        visitor_count: visitorCount
    });

    return slip;
};

module.exports = {
    checkLimits,
    generateSlip
};
