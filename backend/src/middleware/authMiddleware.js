const jwt = require('jsonwebtoken');
const { User, StaffSession } = require('../models');

const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            if (!decoded.sessionId) {
                return res.status(401).json({ error: 'Not authorized, invalid token' });
            }

            const session = await StaffSession.findByPk(decoded.sessionId, {
                include: [{ model: User, attributes: ['id', 'username', 'role'] }]
            });

            if (!session) {
                return res.status(401).json({ error: 'Not authorized, session not found' });
            }

            if (new Date() > new Date(session.expires_at)) {
                await session.destroy();
                return res.status(401).json({ error: 'Not authorized, session expired' });
            }

            // Update last active
            session.last_active = new Date();
            await session.save();

            req.user = session.User;
            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ error: 'Not authorized, token failed' });
        }
    } else {
        res.status(401).json({ error: 'Not authorized, no token' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: `User role ${req.user.role} is not authorized to access this route`
            });
        }
        next();
    };
};

module.exports = { protect, authorize };
