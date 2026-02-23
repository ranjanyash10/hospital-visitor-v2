const { VisitorSlip } = require('../models');
const { Op } = require('sequelize');

const startExpiryJob = () => {
    console.log('Starting Auto-Expiry Job (every 60s)...');

    setInterval(async () => {
        try {
            const now = new Date();
            const [updatedCount] = await VisitorSlip.update(
                {
                    status: 'EXPIRED',
                    expiryReason: 'AUTO_TIMEOUT'
                },
                {
                    where: {
                        status: 'ACTIVE',
                        valid_until: { [Op.lt]: now }
                    }
                }
            );

            if (updatedCount > 0) {
                console.log(`Auto-Expired ${updatedCount} slips.`);
            }
        } catch (error) {
            console.error('Auto-Expiry Job Error:', error);
        }
    }, 60000); // Run every minute
};

module.exports = startExpiryJob;
