const { Sequelize } = require('sequelize');

// Fix for DigitalOcean Managed DB self-signed certificate error
// This prevents the 'SELF_SIGNED_CERT_IN_CHAIN' error on Managed Databases
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config();

let sequelize;

if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
  console.log('Connecting to PostgreSQL...');
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    // Standard connection pooling
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
} else {
  console.log('Falling back to SQLite...');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false
  });
}

module.exports = sequelize;
