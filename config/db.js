const { Sequelize } = require('sequelize');
const { defineOrder } = require('../models/order');
const logger = require('../utils/logger');

const SHARD_ENV_KEYS = [
  'DB_SHARD_0_URL',
  'DB_SHARD_1_URL',
  'DB_SHARD_2_URL',
  'DB_SHARD_3_URL',
];

function assertShardEnv() {
  const missing = SHARD_ENV_KEYS.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `Missing PostgreSQL URLs: ${missing.join(', ')}. Copy .env.example to .env and set each DB_SHARD_*_URL.`
    );
  }
}

const sequelizes = SHARD_ENV_KEYS.map((key) => {
  return new Sequelize(process.env[key], {
    dialect: 'postgres',
    logging: false,
    pool: { max: 10, min: 0 },
  });
});

const orderModels = sequelizes.map((sequelize) => defineOrder(sequelize));

async function syncSchema() {
  assertShardEnv();

  for (let i = 0; i < sequelizes.length; i++) {
    await sequelizes[i].sync();
    logger.info('Database schema synced', { shard: i });
  }
}

module.exports = {
  orderModels,
  SHARD_COUNT: sequelizes.length,
  syncSchema,
};
