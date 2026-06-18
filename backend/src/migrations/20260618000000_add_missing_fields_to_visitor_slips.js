const { DataTypes } = require('sequelize');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const columnExists = async (tableName, columnName) => {
            const description = await queryInterface.describeTable(tableName);
            return !!description[columnName];
        };

        // Add visitor_name
        if (!(await columnExists('visitor_slips', 'visitor_name'))) {
            await queryInterface.addColumn('visitor_slips', 'visitor_name', {
                type: DataTypes.STRING(100),
                allowNull: true
            });
        }

        // Add visitor_age
        if (!(await columnExists('visitor_slips', 'visitor_age'))) {
            await queryInterface.addColumn('visitor_slips', 'visitor_age', {
                type: DataTypes.INTEGER,
                allowNull: true
            });
        }

        // Add visitor_gender
        if (!(await columnExists('visitor_slips', 'visitor_gender'))) {
            await queryInterface.addColumn('visitor_slips', 'visitor_gender', {
                type: DataTypes.STRING(10),
                allowNull: true
            });
        }

        // Add id_type
        if (!(await columnExists('visitor_slips', 'id_type'))) {
            await queryInterface.addColumn('visitor_slips', 'id_type', {
                type: DataTypes.STRING(20),
                allowNull: true
            });
        }

        // Add id_number
        if (!(await columnExists('visitor_slips', 'id_number'))) {
            await queryInterface.addColumn('visitor_slips', 'id_number', {
                type: DataTypes.STRING(50),
                allowNull: true
            });
        }

        // Add scanned_count
        if (!(await columnExists('visitor_slips', 'scanned_count'))) {
            await queryInterface.addColumn('visitor_slips', 'scanned_count', {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                allowNull: false
            });
        }
    },

    down: async (queryInterface, Sequelize) => {
        const columnExists = async (tableName, columnName) => {
            const description = await queryInterface.describeTable(tableName);
            return !!description[columnName];
        };

        if (await columnExists('visitor_slips', 'visitor_name')) {
            await queryInterface.removeColumn('visitor_slips', 'visitor_name');
        }
        if (await columnExists('visitor_slips', 'visitor_age')) {
            await queryInterface.removeColumn('visitor_slips', 'visitor_age');
        }
        if (await columnExists('visitor_slips', 'visitor_gender')) {
            await queryInterface.removeColumn('visitor_slips', 'visitor_gender');
        }
        if (await columnExists('visitor_slips', 'id_type')) {
            await queryInterface.removeColumn('visitor_slips', 'id_type');
        }
        if (await columnExists('visitor_slips', 'id_number')) {
            await queryInterface.removeColumn('visitor_slips', 'id_number');
        }
        if (await columnExists('visitor_slips', 'scanned_count')) {
            await queryInterface.removeColumn('visitor_slips', 'scanned_count');
        }
    }
};
