const { VisitorSlip, SlipVerification, User, Patient, Relative, Admission, StaffSession, sequelize } = require('../models');
const { isAfter, addHours } = require('date-fns');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const QRCodeImage = require('qrcode');
const { getCurrentQr } = require('../services/whatsappService');

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

exports.getWhatsAppQr = async (req, res) => {
    const currentQr = getCurrentQr();
    if (!currentQr) {
        return res.send(`
            <html>
                <head>
                    <meta http-equiv="refresh" content="5">
                    <style>
                        body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; background-color: #f1f5f9; color: #1e293b; }
                        .card { background: white; padding: 2.5rem; border-radius: 1.5rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
                        h2 { color: #10b981; margin-bottom: 0.5rem; }
                        p { color: #64748b; margin-bottom: 0; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h2>✓ WhatsApp Connected!</h2>
                        <p>The backend client is already authenticated and active.</p>
                    </div>
                </body>
            </html>
        `);
    }
    try {
        const qrImage = await QRCodeImage.toDataURL(currentQr);
        res.send(`
            <html>
                <head>
                    <meta http-equiv="refresh" content="10">
                    <title>WhatsApp Backend Login</title>
                    <style>
                        body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; background-color: #f1f5f9; color: #1e293b; margin: 0; }
                        .card { background: white; padding: 2.5rem; border-radius: 1.5rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
                        h2 { margin-top: 0; margin-bottom: 1rem; color: #0f172a; }
                        img { width: 280px; height: 280px; border: 4px solid #f1f5f9; border-radius: 1rem; margin: 1rem 0; }
                        .steps { font-size: 0.9rem; color: #475569; text-align: left; background: #f8fafc; padding: 1rem; border-radius: 0.75rem; margin-bottom: 1rem; line-height: 1.5; }
                        p.footer { color: #64748b; font-size: 0.75rem; margin: 0; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h2>Link WhatsApp Server</h2>
                        <div class="steps">
                            1. Open WhatsApp on your phone.<br/>
                            2. Tap <b>Settings</b> or <b>Menu</b> (three dots).<br/>
                            3. Select <b>Linked Devices</b> -> <b>Link a Device</b>.<br/>
                            4. Scan the QR code below.
                        </div>
                        <img src="${qrImage}" alt="Scan Me" />
                        <p class="footer">Refreshes automatically every 10 seconds.</p>
                    </div>
                </body>
            </html>
        `);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error generating QR code image');
    }
};
