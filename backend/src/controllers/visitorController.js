const jwt = require('jsonwebtoken');
const { Patient, Admission, AdmissionVisitor, VisitorSlip, KioskSession, GuardSession, AuditLog } = require('../models');
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
        const cleanedMobile = mobile.replace(/\D/g, '');
        if (cleanedMobile.length < 10) {
            return res.status(400).json({ success: false, message: 'Invalid mobile number' });
        }

        const admissions = await Admission.findAll({
            where: {
                status: 'ACTIVE',
                [Op.or]: [
                    sequelize.where(
                        sequelize.fn('replace', sequelize.fn('replace', sequelize.col('AdmissionVisitors.mobile_number'), '+', ''), '-', ''),
                        { [Op.like]: `%${cleanedMobile.slice(-10)}` }
                    ),
                    sequelize.where(
                        sequelize.fn('replace', sequelize.fn('replace', sequelize.col('Patient->Relatives.mobile_number'), '+', ''), '-', ''),
                        { [Op.like]: `%${cleanedMobile.slice(-10)}` }
                    )
                ]
            },
            include: [
                {
                    model: AdmissionVisitor,
                    as: 'AdmissionVisitors', // Ensure this matches association
                    required: false
                },
                {
                    model: Patient,
                    as: 'Patient', // Explicit for clarity
                    attributes: ['id', 'full_name', 'uhid'],
                    include: [{
                        model: Relative,
                        as: 'Relatives', // Ensure this matches association
                        required: false
                    }]
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

// 5. V2: Get patient info for registration form using UHID
exports.getFormInfo = async (req, res) => {
    try {
        const { uhid } = req.params;
        const patient = await Patient.findOne({
            where: { uhid },
            include: [{
                model: Admission,
                where: { status: 'ACTIVE' },
                required: true
            }]
        });

        if (!patient) {
            return res.status(404).json({ error: 'No active admission found for this UHID' });
        }

        const admission = patient.Admissions[0];

        res.json({
            success: true,
            patient: {
                name: patient.full_name,
                uhid: patient.uhid,
                room_number: admission.room_number,
                bed_number: admission.bed_number,
                ward_type: admission.ward_type,
                max_visitors: admission.max_visitors
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// 6. V2: Pre-registration form submission
exports.preRegister = async (req, res) => {
    try {
        const {
            uhid,
            visitor_name,
            visitor_age,
            visitor_gender,
            id_type,
            id_number,
            mobile
        } = req.body;

        const patient = await Patient.findOne({
            where: { uhid },
            include: [{
                model: Admission,
                where: { status: 'ACTIVE' },
                required: true
            }]
        });

        if (!patient) {
            return res.status(404).json({ error: 'Active admission not found' });
        }

        const admission = patient.Admissions[0];

        // Check limits
        const { checkLimits } = require('../services/slipService');
        const limitCheck = await checkLimits(patient.id);
        if (!limitCheck.allowed) {
            return res.status(400).json({ error: limitCheck.message });
        }

        // Generate slip with V2 details
        const crypto = require('crypto');
        const { addHours } = require('date-fns');

        const durationHours = admission.visit_duration_hours || 1;
        const validUntil = addHours(new Date(), durationHours);
        const slipToken = crypto.randomBytes(8).toString('hex').toUpperCase();

        const slipModel = await VisitorSlip.create({
            slip_token: slipToken,
            patient_id: patient.id,
            admission_id: admission.id,
            mobile_number: mobile,
            ward_type: admission.ward_type,
            valid_until: validUntil,
            status: 'ACTIVE',
            qr_code_data: slipToken,
            visitor_count: 1,
            visitor_name,
            visitor_age,
            visitor_gender,
            id_type,
            id_number,
            scanned_count: 0
        });

        await AuditLog.create({
            action: 'VISITOR_PRE_REGISTER',
            details: `Visitor ${visitor_name} pre-registered for patient ${patient.full_name} (UHID: ${uhid})`,
            ip_address: req.ip
        });

        res.json({
            success: true,
            slip: {
                id: slipModel.id.split('-')[0],
                slip_token: slipModel.slip_token,
                valid_until: slipModel.valid_until,
                patient_name: patient.full_name,
                room_number: admission.room_number,
                bed_number: admission.bed_number
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Pre-registration failed' });
    }
};
