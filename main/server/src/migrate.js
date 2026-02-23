const { Umzug, SequelizeStorage } = require('umzug');
const sequelize = require('./config/database');
const path = require('path');

const umzug = new Umzug({
    migrations: {
        glob: path.join(__dirname, 'migrations', '*.js'),
        resolve: ({ name, path, context }) => {
            const migration = require(path);
            return {
                name,
                up: async () => migration.up(sequelize.getQueryInterface(), sequelize.constructor),
                down: async () => migration.down(sequelize.getQueryInterface(), sequelize.constructor),
            };
        },
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
});

const runMigrations = async () => {
    try {
        console.log('Checking for pending migrations...');
        const pending = await umzug.pending();
        if (pending.length === 0) {
            console.log('No pending migrations.');
        } else {
            console.log(`Executing ${pending.length} migrations...`);
            await umzug.up();
            console.log('All migrations executed successfully.');
        }
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
};

if (require.main === module) {
    runMigrations();
}

module.exports = runMigrations;
