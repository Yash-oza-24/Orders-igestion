const { ingestOrdersFile } = require('../services/orderIngestionService');
const {
  findByOrderIdAcrossShards,
  findByCustomerId,
  countOrdersByShardDatabase,
} = require('../repositories/orderRepository');
const logger = require('../utils/logger');

async function uploadOrders(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const { gcsPath, processed, failed } = await ingestOrdersFile(
      req.file.path,
      req.file.originalname
    );

    res.json({
      message: 'Orders processed successfully',
      gcsPath,
      processed,
      failed,
    });
  } catch (err) {
    logger.error('Upload failed', { error: err.message });
    res.status(500).json({ error: 'Processing failed', details: err.message });
  }
}

async function getOrderById(req, res) {
  const order = await findByOrderIdAcrossShards(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
}

async function getOrdersByCustomer(req, res) {
  const { customerId } = req.query;
  if (!customerId) return res.status(400).json({ error: 'customerId required' });

  const rows = await findByCustomerId(customerId);
  res.json(rows);
}

async function getOrderCountByShardDatabase(req, res) {
  const database = req.query.database;
  if (!database || !String(database).trim()) {
    return res.status(400).json({
      error:
        'database query parameter required. Use Postgres DB name (e.g. orders_shard_0), or DB_SHARD_0_URL style, or shard index 0–3.',
    });
  }
  try {
    const result = await countOrdersByShardDatabase(database);
    if (!result) {
      return res.status(404).json({
        error:
          'No shard matched. Pass the database name from your connection URL, or DB_SHARD_N_URL, or a numeric shard index.',
        database: String(database).trim(),
      });
    }
    res.json({
      database: result.database,
      shardIndex: result.shardIndex,
      count: result.count,
    });
  } catch (err) {
    logger.error('Order count by shard failed', { error: err.message });
    res.status(500).json({ error: 'Count failed', details: err.message });
  }
}

module.exports = {
  uploadOrders,
  getOrderById,
  getOrdersByCustomer,
  getOrderCountByShardDatabase,
};
