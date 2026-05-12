const multer = require('multer');
const { uploadToGCS } = require('../services/uploadService');
const { parseAndStore } = require('../services/parseService');
const { getShardForCustomer } = require('../services/shardService');
const { orderModels } = require('../config/db');
const logger = require('../utils/logger');

const upload = multer({ dest: 'tmp/' });

async function uploadOrders(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    logger.info('Upload request received', { file: req.file.originalname });

    const gcsPath = await uploadToGCS(req.file.path, req.file.originalname);
    const result  = await parseAndStore(req.file.path);

    res.json({
      message: 'Orders processed successfully',
      gcsPath,
      processed: result.processed,
      failed: result.failed,
    });
  } catch (err) {
    logger.error('Upload failed', { error: err.message });
    res.status(500).json({ error: 'Processing failed', details: err.message });
  }
}

async function getOrderById(req, res) {
  for (const Order of orderModels) {
    const row = await Order.findByPk(req.params.orderId);
    if (row) return res.json(row.toJSON());
  }
  res.status(404).json({ error: 'Order not found' });
}

async function getOrdersByCustomer(req, res) {
  const { customerId } = req.query;
  if (!customerId) return res.status(400).json({ error: 'customerId required' });

  const Order = getShardForCustomer(customerId);
  const rows = await Order.findAll({
    where: { customer_id: customerId },
    order: [['order_date', 'DESC']],
  });
  res.json(rows.map((r) => r.toJSON()));
}

module.exports = { upload, uploadOrders, getOrderById, getOrdersByCustomer };
