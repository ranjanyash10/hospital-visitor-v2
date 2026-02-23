const { DataTypes } = require('sequelize');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('guard_sessions', {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            guard_station_id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                unique: true,
                allowNull: false
            },
            user_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            status: {
                type: DataTypes.ENUM('ACTIVE', 'ENDED'),
                defaultValue: 'ACTIVE'
            },
            started_at: {
                type: DataTypes.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            ended_at: {
                type: DataTypes.DATE,
                allowNull: true
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });

        // Add index for performance
        await queryInterface.addIndex('guard_sessions', ['guard_station_id']);
        await queryInterface.addIndex('guard_sessions', ['user_id', 'status']);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('guard_sessions');
    }
};
