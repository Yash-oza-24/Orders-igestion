const { ingestOrdersFile } = require('../services/orderIngestionService');
const {
  findByOrderIdAcrossShards,
  findByCustomerId,
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

module.exports = { uploadOrders, getOrderById, getOrdersByCustomer };
