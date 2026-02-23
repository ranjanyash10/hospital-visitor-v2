const { DataTypes } = require('sequelize');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const tableExists = async (name) => {
            const tables = await queryInterface.showAllTables();
            return tables.includes(name);
        };

        const columnExists = async (tableName, columnName) => {
            const description = await queryInterface.describeTable(tableName);
            return !!description[columnName];
        };

        // 1. Create admission_visitors table
        if (!(await tableExists('admission_visitors'))) {
            await queryInterface.createTable('admission_visitors', {
                id: {
                    type: DataTypes.UUID,
                    defaultValue: DataTypes.UUIDV4,
                    primaryKey: true
                },
                admission_id: {
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {
                        model: 'admissions',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE'
                },
                mobile_number: {
                    type: DataTypes.STRING(15),
                    allowNull: false
                },
                relationship: {
                    type: DataTypes.STRING(50)
                },
                created_at: {
                    type: DataTypes.DATE,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
                }
            });
        }

        // 2. Add admission_id and mobile_number to visitor_slips
        if (!(await columnExists('visitor_slips', 'admission_id'))) {
            await queryInterface.addColumn('visitor_slips', 'admission_id', {
                type: DataTypes.UUID,
                allowNull: true,
                references: {
                    model: 'admissions',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            });
        }

        if (!(await columnExists('visitor_slips', 'mobile_number'))) {
            await queryInterface.addColumn('visitor_slips', 'mobile_number', {
                type: DataTypes.STRING(15),
                allowNull: true
            });
        }

        // 3. Add indices
        // Sequelize addIndex is usually safe or handles errors, but we can wrap it if needed.
        try { await queryInterface.addIndex('admission_visitors', ['mobile_number']); } catch (e) { }
        try { await queryInterface.addIndex('admission_visitors', ['admission_id']); } catch (e) { }
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('admission_visitors');
        await queryInterface.removeColumn('visitor_slips', 'admission_id');
        await queryInterface.removeColumn('visitor_slips', 'mobile_number');
    }
};
