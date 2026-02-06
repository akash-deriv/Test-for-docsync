const redis = require('redis');
const config = require('../config');
const logger = require('../utils/logger');

let client;

async function initializeRedis() {
  client = redis.createClient({
    socket: {
      host: config.redis.host,
      port: config.redis.port,
    },
    password: config.redis.password,
  });

  client.on('error', (err) => logger.error('Redis Client Error', err));
  client.on('connect', () => logger.info('Redis connected'));

  await client.connect();
}

async function cacheGet(key) {
  try {
    return await client.get(key);
  } catch (error) {
    logger.error('Redis GET error:', error);
    return null;
  }
}

async function cacheSet(key, value, ttl = config.redis.ttl) {
  try {
    await client.setEx(key, ttl, value);
  } catch (error) {
    logger.error('Redis SET error:', error);
  }
}

async function cacheDelete(key) {
  try {
    await client.del(key);
  } catch (error) {
    logger.error('Redis DELETE error:', error);
  }
}

async function closeRedis() {
  if (client) {
    await client.quit();
    logger.info('Redis connection closed');
  }
}

module.exports = {
  initializeRedis,
  cacheGet,
  cacheSet,
  cacheDelete,
  closeRedis,
};
