const { Patient, Admission, AdmissionVisitor, Relative, VisitorSlip, KioskSession, AuditLog } = require('../models');

const { sendOtpToRelative, verifyOtp } = require('../services/otpService');
const { generateSlip, checkLimits } = require('../services/slipService');
const { addMinutes } = require('date-fns');
const { Op } = require('sequelize');

// New: Mobile Lookup
exports.getVisitorPatients = async (req, res) => {
    try {
        const { mobile } = req.params;

        // Find all active admissions where this mobile is an authorized visitor
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
                    attributes: ['full_name', 'uhid']
                }
            ]
        });

        if (admissions.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No active admissions linked to this number"
            });
        }

        const patients = admissions.map(adm => ({
            patient_id: adm.Patient.id,
            name: adm.Patient.full_name,
            uhid: adm.Patient.uhid,
            bed_number: adm.bed_number,
            ward_number: adm.room_number, // Bed/Ward logic
            admission_id: adm.id
        }));

        // Audit Log for lookup
        await AuditLog.create({
            action: 'KIOSK_VISITOR_LOOKUP',
            details: `Mobile ${mobile} searched. Found ${patients.length} patients.`,
            ip_address: req.ip
        });

        res.json({
            success: true,
            patients
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// Original (Legacy but still used in routes): Validate Patient & Relative
exports.validatePatient = async (req, res) => {
    try {
        const { patientName, bedNumber, roomNumber, relativeMobile } = req.body;

        const patient = await Patient.findOne({ where: { full_name: patientName } });
        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        const admission = await Admission.findOne({
            where: {
                patient_id: patient.id,
                status: 'ACTIVE',
                room_number: roomNumber,
                bed_number: bedNumber
            }
        });

        if (!admission) return res.status(404).json({ error: 'Active admission not found' });

        const relative = await Relative.findOne({
            where: { patient_id: patient.id, mobile_number: relativeMobile }
        });

        if (!relative) return res.status(403).json({ error: 'Mobile number not registered' });

        const limitCheck = await checkLimits(patient.id);
        if (!limitCheck.allowed) return res.status(400).json({ error: limitCheck.message });

        // Create Opaque Session
        const session = await KioskSession.create({
            patient_id: patient.id,
            relative_id: relative.id,
            expires_at: addMinutes(new Date(), 10), // 10 min session
            status: 'PENDING'
        });

        res.json({
            success: true,
            sessionId: session.id, // Only return Session ID
            patientName: patient.full_name,
            relativeName: relative.name,
            relativeMobile: relative.mobile_number // Still needed for UI display, but IDs are hidden
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// Update: sendOtp now needs admission_id and mobile
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

        // Create Opaque Session
        const session = await KioskSession.create({
            patient_id: admission.patient_id,
            admission_id: admission.id, // Need to add this to model/migration if not there, but let's use patient_id
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


// 3. Verify OTP & Generate Slip
exports.verifyAndGenerate = async (req, res) => {
    try {
        const { sessionId, otp } = req.body;
        const session = await KioskSession.findByPk(sessionId, { include: [Relative] });

        if (!session || new Date() > session.expires_at) {
            return res.status(440).json({ error: 'Session expired' });
        }

        const verification = await verifyOtp(session.Relative ? session.Relative.mobile_number : req.body.mobile, otp);
        if (!verification.valid) return res.status(400).json({ error: verification.message });

        try {
            // Generate slip with mobile capture
            const slipModel = await generateSlip(session.patient_id, session.relative_id, req.body.mobile);

            session.status = 'COMPLETED';
            await session.save();

            // Sanitize: Only return what the frontend needs
            const slip = {
                id: slipModel.id.split('-')[0], // Give an abbreviated ID
                slip_token: slipModel.slip_token,
                ward_type: slipModel.ward_type,
                valid_until: slipModel.valid_until
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
