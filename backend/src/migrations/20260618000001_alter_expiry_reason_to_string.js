const { DataTypes } = require('sequelize');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        if (queryInterface.sequelize.options.dialect === 'postgres') {
            await queryInterface.sequelize.query(
                `ALTER TABLE visitor_slips ALTER COLUMN "expiryReason" TYPE VARCHAR(30) USING "expiryReason"::text;`
            );
        } else {
            await queryInterface.changeColumn('visitor_slips', 'expiryReason', {
                type: DataTypes.STRING(30),
                allowNull: true
            });
        }
    },
    down: async (queryInterface, Sequelize) => {
        if (queryInterface.sequelize.options.dialect === 'postgres') {
            // Note: Reverting to enum requires the enum to exist, so converting back to VARCHAR(20) is safer.
            await queryInterface.sequelize.query(
                `ALTER TABLE visitor_slips ALTER COLUMN "expiryReason" TYPE VARCHAR(20) USING "expiryReason"::text;`
            );
        } else {
            await queryInterface.changeColumn('visitor_slips', 'expiryReason', {
                type: DataTypes.ENUM('CHECKOUT', 'AUTO_TIMEOUT', 'REVOKED'),
                allowNull: true
            });
        }
    }
};
