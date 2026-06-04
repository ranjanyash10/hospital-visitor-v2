'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const tableInfo = await queryInterface.describeTable('visitor_slips');
        
        if (!tableInfo.permit_type) {
            await queryInterface.addColumn('visitor_slips', 'permit_type', {
                type: Sequelize.STRING(20),
                defaultValue: 'REGULAR',
                allowNull: false
            });
        }

        // Also fix valid_until to allow null (for timer-on-scan feature)
        if (tableInfo.valid_until && !tableInfo.valid_until.allowNull) {
            await queryInterface.changeColumn('visitor_slips', 'valid_until', {
                type: Sequelize.DATE,
                allowNull: true
            });
        }
    },
    down: async (queryInterface) => {
        await queryInterface.removeColumn('visitor_slips', 'permit_type');
        await queryInterface.changeColumn('visitor_slips', 'valid_until', {
            type: require('sequelize').DATE,
            allowNull: false
        });
    }
};
