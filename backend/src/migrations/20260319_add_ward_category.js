const { DataTypes } = require('sequelize');

module.exports = {
    up: async (queryInterface) => {
        // Add ward_category column to admissions table
        const tableDesc = await queryInterface.describeTable('admissions');

        if (!tableDesc.ward_category) {
            await queryInterface.addColumn('admissions', 'ward_category', {
                type: DataTypes.STRING(30),
                allowNull: false,
                defaultValue: 'WARD'
            });
        }
    },

    down: async (queryInterface) => {
        await queryInterface.removeColumn('admissions', 'ward_category');
    }
};
