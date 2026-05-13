const { orderModels } = require('../config/db');
const { getShardForCustomer } = require('../services/shardService');

async function findByOrderIdAcrossShards(orderId) {
  for (const Order of orderModels) {
    const row = await Order.findByPk(orderId);
    if (row) return row.toJSON();
  }
  return null;
}

async function findByCustomerId(customerId) {
  const Order = getShardForCustomer(customerId);
  const rows = await Order.findAll({
    where: { customer_id: customerId },
    order: [['order_date', 'DESC']],
  });
  return rows.map((r) => r.toJSON());
}

module.exports = {
  findByOrderIdAcrossShards,
  findByCustomerId,
};
