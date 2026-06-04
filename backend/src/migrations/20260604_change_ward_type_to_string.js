const { DataTypes } = require('sequelize');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Check if dialect is postgres
        if (queryInterface.sequelize.options.dialect === 'postgres') {
            // Alter column type to VARCHAR(50) in PostgreSQL
            await queryInterface.sequelize.query(
                `ALTER TABLE admissions ALTER COLUMN ward_type TYPE VARCHAR(50) USING ward_type::text;`
            );
        } else {
            // For SQLite
            await queryInterface.changeColumn('admissions', 'ward_type', {
                type: DataTypes.STRING(50),
                allowNull: false
            });
        }
    },
    down: async (queryInterface, Sequelize) => {
        if (queryInterface.sequelize.options.dialect === 'postgres') {
            // In case of rollback, revert column back to VARCHAR(20)
            await queryInterface.sequelize.query(
                `ALTER TABLE admissions ALTER COLUMN ward_type TYPE VARCHAR(20) USING ward_type::text;`
            );
        } else {
            // For SQLite
            await queryInterface.changeColumn('admissions', 'ward_type', {
                type: DataTypes.ENUM('GENERAL', 'PRIVATE'),
                allowNull: false
            });
        }
    }
};
