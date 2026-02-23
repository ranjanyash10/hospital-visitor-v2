const { DataTypes } = require('sequelize');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const tableExists = async (name) => {
            const tables = await queryInterface.showAllTables();
            return tables.includes(name);
        };

        const indexExists = async (tableName, indexName) => {
            const indices = await queryInterface.showIndex(tableName);
            return indices.some(idx => idx.name === indexName);
        };

        // 1. Optimize Relatives table (Add missing mobile index)
        if (await tableExists('relatives')) {
            if (!(await indexExists('relatives', 'idx_relatives_mobile'))) {
                await queryInterface.addIndex('relatives', ['mobile_number'], {
                    name: 'idx_relatives_mobile'
                });
                console.log('Added index idx_relatives_mobile on relatives');
            }
        }

        // 2. Remove redundant indices if they exist (Clean up from initial schema if they are overhead)
        // Note: We keep idx_slips_token and guard_station_id as they are primary lookup keys.

        // Example: Only keep composite indices if they are actually used by current query patterns.
        // For now, we prioritize mobile number lookups which are already handled by separate indices.
    },

    down: async (queryInterface, Sequelize) => {
        // Drop added indices
        await queryInterface.removeIndex('relatives', 'idx_relatives_mobile');
    }
};
