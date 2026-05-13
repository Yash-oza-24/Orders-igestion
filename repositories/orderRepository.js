const { orderModels } = require('../config/db');
const { getShardForCustomer } = require('../services/shardService');

function normalizeDbName(name) {
  return String(name || '').trim().toLowerCase();
}

function resolveShardIndexByDatabaseName(databaseName) {
  const want = normalizeDbName(databaseName);
  if (!want) return -1;
  for (let i = 0; i < orderModels.length; i += 1) {
    const db = orderModels[i].sequelize?.config?.database;
    if (db != null && normalizeDbName(db) === want) return i;
  }
  return -1;
}

function resolveShardIndexForCount(rawInput) {
  const raw = String(rawInput || '').trim();
  if (!raw) return -1;

  const envMatch = /^DB_SHARD_(\d+)_URL$/i.exec(raw);
  if (envMatch) {
    const idx = parseInt(envMatch[1], 10);
    if (Number.isInteger(idx) && idx >= 0 && idx < orderModels.length) return idx;
    return -1;
  }

  const byDbName = resolveShardIndexByDatabaseName(raw);
  if (byDbName >= 0) return byDbName;

  if (/^\d+$/.test(raw)) {
    const idx = parseInt(raw, 10);
    if (Number.isInteger(idx) && idx >= 0 && idx < orderModels.length) return idx;
  }

  return -1;
}

async function countOrdersByShardDatabase(databaseParam) {
  const idx = resolveShardIndexForCount(databaseParam);
  if (idx < 0) return null;
  const Order = orderModels[idx];
  const database = Order.sequelize.config.database;
  const count = await Order.count();
  return { shardIndex: idx, database, count };
}

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
  countOrdersByShardDatabase,
  resolveShardIndexForCount,
};
