const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

let pool;

async function connectDatabase() {
  pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    max: config.database.maxConnections,
  });

  try {
    await pool.query('SELECT NOW()');
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  logger.debug('Executed query', { text, duration, rows: result.rowCount });
  return result;
}

async function closeDatabase() {
  if (pool) {
    await pool.end();
    logger.info('Database connection closed');
  }
}

module.exports = {
  connectDatabase,
  query,
  closeDatabase,
};
