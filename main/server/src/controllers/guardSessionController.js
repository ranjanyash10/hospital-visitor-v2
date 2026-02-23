const jwt = require('jsonwebtoken');
const { GuardSession, AuditLog } = require('../models');

// Start a guard QR station session
exports.startSession = async (req, res) => {
    try {
        // End any existing active sessions for this guard
        await GuardSession.update(
            { status: 'ENDED', ended_at: new Date() },
            { where: { user_id: req.user.id, status: 'ACTIVE' } }
        );

        const session = await GuardSession.create({
            user_id: req.user.id
        });

        await AuditLog.create({
            action: 'GUARD_SESSION_STARTED',
            details: `Guard ${req.user.username} started station ${session.guard_station_id}`,
            user_id: req.user.id
        });

        res.json({
            success: true,
            guard_station_id: session.guard_station_id
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to start session' });
    }
};

// Generate a short-lived QR token for the guard station
exports.getQrToken = async (req, res) => {
    try {
        const session = await GuardSession.findOne({
            where: { user_id: req.user.id, status: 'ACTIVE' }
        });

        if (!session) {
            return res.status(404).json({ error: 'No active guard session' });
        }

        // Sign a long-lived JWT (valid for the entire guard session, up to 24h)
        const qrToken = jwt.sign(
            {
                type: 'GUARD_QR',
                guard_station_id: session.guard_station_id
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            qr_token: qrToken,
            expires_in: 86400
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate QR token' });
    }
};

// End a guard session
exports.endSession = async (req, res) => {
    try {
        const session = await GuardSession.findOne({
            where: { user_id: req.user.id, status: 'ACTIVE' }
        });

        if (!session) {
            return res.status(404).json({ error: 'No active session to end' });
        }

        session.status = 'ENDED';
        session.ended_at = new Date();
        await session.save();

        await AuditLog.create({
            action: 'GUARD_SESSION_ENDED',
            details: `Guard ${req.user.username} ended station ${session.guard_station_id}`,
            user_id: req.user.id
        });

        res.json({ success: true, message: 'Session ended' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to end session' });
    }
};
