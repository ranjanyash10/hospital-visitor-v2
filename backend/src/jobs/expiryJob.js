const { VisitorSlip } = require('../models');
const { Op } = require('sequelize');

const startExpiryJob = () => {
    console.log('Starting Auto-Expiry Job (every 60s)...');

    setInterval(async () => {
        try {
            const now = new Date();
            const { subHours } = require('date-fns');
            const staleRegistrationThreshold = subHours(now, 6); // Registrations older than 6 hours are stale

            // 1. Expire VISITING slips that passed their valid_until time
            const [expiredVisitingCount] = await VisitorSlip.update(
                {
                    status: 'EXPIRED',
                    expiryReason: 'AUTO_TIMEOUT'
                },
                {
                    where: {
                        status: 'VISITING',
                        valid_until: { [Op.lt]: now }
                    }
                }
            );

            // 2. Expire ACTIVE slips that were never used/scanned and are now stale
            const [expiredActiveCount] = await VisitorSlip.update(
                {
                    status: 'EXPIRED',
                    expiryReason: 'AUTO_TIMEOUT'
                },
                {
                    where: {
                        status: 'ACTIVE',
                        createdAt: { [Op.lt]: staleRegistrationThreshold }
                    }
                }
            );

            const total = expiredVisitingCount + expiredActiveCount;
            if (total > 0) {
                console.log(`[Auto-Expiry] Processed ${total} items (${expiredVisitingCount} Visiting, ${expiredActiveCount} Stale Registrations).`);
            }
        } catch (error) {
            console.error('Auto-Expiry Job Error:', error);
        }
    }, 60000); // Run every minute
};

module.exports = startExpiryJob;
