const fs = require('fs');
const path = require('path');
const { connectDatabase, query, closeDatabase } = require('./connection');
const logger = require('../utils/logger');

async function runMigrations() {
  try {
    await connectDatabase();

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    logger.info('Running database migrations...');
    await query(schema);
    logger.info('Migrations completed successfully');

    await closeDatabase();
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    await closeDatabase();
    process.exit(1);
  }
}

runMigrations();
