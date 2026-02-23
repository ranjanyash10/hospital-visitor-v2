'use strict';
const { DataTypes } = require('sequelize');

module.exports = {
    async up(queryInterface, Sequelize) {
        // Helper to check if a column exists
        const columnExists = async (table, col) => {
            const desc = await queryInterface.describeTable(table);
            return !!desc[col];
        };

        // Add max_visitors to admissions (default 1)
        if (!(await columnExists('admissions', 'max_visitors'))) {
            await queryInterface.addColumn('admissions', 'max_visitors', {
                type: DataTypes.INTEGER,
                defaultValue: 1,
                allowNull: false
            });
        }

        // Add visitor_count to visitor_slips (default 1)
        if (!(await columnExists('visitor_slips', 'visitor_count'))) {
            await queryInterface.addColumn('visitor_slips', 'visitor_count', {
                type: DataTypes.INTEGER,
                defaultValue: 1,
                allowNull: false
            });
        }

        // Add visit_duration_hours to admissions (default 1)
        if (!(await columnExists('admissions', 'visit_duration_hours'))) {
            await queryInterface.addColumn('admissions', 'visit_duration_hours', {
                type: DataTypes.FLOAT,
                defaultValue: 1,
                allowNull: false
            });
        }
    },

    async down(queryInterface) {
        const columnExists = async (table, col) => {
            const desc = await queryInterface.describeTable(table);
            return !!desc[col];
        };

        if (await columnExists('admissions', 'max_visitors')) {
            await queryInterface.removeColumn('admissions', 'max_visitors');
        }
        if (await columnExists('visitor_slips', 'visitor_count')) {
            await queryInterface.removeColumn('visitor_slips', 'visitor_count');
        }
    }
};
