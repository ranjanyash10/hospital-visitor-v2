const jwt = require('jsonwebtoken');
const { Patient, Admission, AdmissionVisitor, KioskSession, GuardSession, AuditLog } = require('../models');
const { sendOtpToRelative, verifyOtp } = require('../services/otpService');
const { generateSlip, checkLimits } = require('../services/slipService');
const { addMinutes } = require('date-fns');

// 1. Validate QR token from guard station
exports.validateQR = async (req, res) => {
    try {
        const { token } = req.body;

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.type !== 'GUARD_QR') {
            return res.status(400).json({ error: 'Invalid QR code' });
        }

        // Verify the guard session is still active
        const session = await GuardSession.findOne({
            where: { guard_station_id: decoded.guard_station_id, status: 'ACTIVE' }
        });

        if (!session) {
            return res.status(400).json({ error: 'Guard station is no longer active' });
        }

        res.json({
            success: true,
            guard_station_id: decoded.guard_station_id
        });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({ error: 'QR code has expired. Please scan a fresh code.' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(400).json({ error: 'Invalid QR code' });
        }
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// 2. Lookup patients by mobile number
exports.lookupPatients = async (req, res) => {
    try {
        const { mobile } = req.params;

        const admissions = await Admission.findAll({
            where: { status: 'ACTIVE' },
            include: [
                {
                    model: AdmissionVisitor,
                    where: { mobile_number: mobile },
                    required: true
                },
                {
                    model: Patient,
                    attributes: ['id', 'full_name', 'uhid']
                }
            ]
        });

        if (admissions.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No active admissions linked to this number'
            });
        }

        // Calculate remaining slots for each patient
        const { checkLimits } = require('../services/slipService');
        const patients = await Promise.all(admissions.map(async (adm) => {
            let remainingSlots = adm.max_visitors || 1;
            try {
                const limits = await checkLimits(adm.Patient.id);
                remainingSlots = limits.remainingSlots || 0;
            } catch (e) {
                remainingSlots = 0;
            }
            return {
                patient_id: adm.Patient.id,
                name: adm.Patient.full_name,
                uhid: adm.Patient.uhid,
                bed_number: adm.bed_number,
                room_number: adm.room_number,
                ward_type: adm.ward_type,
                admission_id: adm.id,
                max_visitors: adm.max_visitors || 1,
                remaining_slots: remainingSlots
            };
        }));

        await AuditLog.create({
            action: 'VISITOR_MOBILE_LOOKUP',
            details: `Mobile ${mobile} searched. Found ${patients.length} patients.`,
            ip_address: req.ip
        });

        res.json({ success: true, patients });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// 3. Send OTP to visitor
exports.sendOtp = async (req, res) => {
    try {
        const { mobile, admission_id } = req.body;

        // Validate that mobile is authorized for this admission
        const visitor = await AdmissionVisitor.findOne({
            where: { admission_id, mobile_number: mobile }
        });

        if (!visitor) {
            return res.status(403).json({ error: 'Unauthorized visitor mobile' });
        }

        const admission = await Admission.findByPk(admission_id, { include: [Patient] });
        if (!admission || admission.status !== 'ACTIVE') {
            return res.status(404).json({ error: 'Active admission not found' });
        }

        // Check limits before sending OTP
        const limitCheck = await checkLimits(admission.patient_id);
        if (!limitCheck.allowed) {
            return res.status(400).json({ error: limitCheck.message });
        }

        // Create session
        const session = await KioskSession.create({
            patient_id: admission.patient_id,
            expires_at: addMinutes(new Date(), 10),
            status: 'PENDING'
        });

        await sendOtpToRelative(mobile);

        res.json({
            success: true,
            sessionId: session.id,
            message: 'OTP sent'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
};

// 4. Verify OTP, generate slip, emit WebSocket event
exports.verifyAndGenerate = async (req, res) => {
    try {
        const { sessionId, otp, mobile, guard_station_id, admission_id, visitor_count = 1 } = req.body;

        const session = await KioskSession.findByPk(sessionId);
        if (!session || new Date() > session.expires_at) {
            return res.status(440).json({ error: 'Session expired' });
        }

        const verification = await verifyOtp(mobile, otp);
        if (!verification.valid) {
            return res.status(400).json({ error: verification.message });
        }

        // Get admission details for the WebSocket payload
        const admission = await Admission.findByPk(admission_id, {
            include: [{ model: Patient, attributes: ['full_name', 'uhid'] }]
        });

        if (!admission) {
            return res.status(404).json({ error: 'Admission not found' });
        }

        try {
            const slipModel = await generateSlip(session.patient_id, null, mobile, visitor_count);

            session.status = 'COMPLETED';
            await session.save();

            // Mask mobile: 98****3210
            const maskedMobile = mobile.slice(0, 2) + '****' + mobile.slice(-4);

            // Emit WebSocket event to guard station
            const io = req.app.get('io');
            if (io && guard_station_id) {
                io.to(`guard:${guard_station_id}`).emit('VISITOR_AUTH_SUCCESS', {
                    patient_name: admission.Patient.full_name,
                    room_number: admission.room_number,
                    bed_number: admission.bed_number,
                    masked_mobile: maskedMobile,
                    slip_id: slipModel.id.split('-')[0],
                    ward_type: admission.ward_type,
                    visitor_count: visitor_count,
                    timestamp: new Date().toISOString()
                });
            }

            await AuditLog.create({
                action: 'VISITOR_AUTHENTICATED',
                details: `Visitor ${maskedMobile} (${visitor_count} person(s)) authenticated for patient ${admission.Patient.full_name}. Slip: ${slipModel.slip_token}`,
                ip_address: req.ip
            });

            const slip = {
                id: slipModel.id.split('-')[0],
                slip_token: slipModel.slip_token,
                ward_type: slipModel.ward_type,
                valid_until: slipModel.valid_until,
                patient_name: admission.Patient.full_name,
                room_number: admission.room_number,
                bed_number: admission.bed_number,
                visitor_count: visitor_count
            };

            res.json({ success: true, slip });
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
};
