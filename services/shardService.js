const crypto = require('crypto');
const { orderModels, SHARD_COUNT } = require('../config/db');

function getShardIndex(customerId) {
  const hash = crypto.createHash('md5').update(customerId, 'utf8').digest('hex');
  return parseInt(hash.substring(0, 8), 16) % SHARD_COUNT;
}

/** Sequelize Order model for the shard that owns this customer_id. */
function getShardForCustomer(customerId) {
  return orderModels[getShardIndex(customerId)];
}

module.exports = {
  getShardForCustomer,
  getShardIndex,
};
