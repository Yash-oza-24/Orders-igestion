const express = require('express');
const { upload } = require('../middleware/uploadMiddleware');
const {
  uploadOrders,
  getOrderById,
  getOrdersByCustomer,
} = require('../controllers/orderController');

const router = express.Router();

router.post('/upload-orders', upload.single('file'), uploadOrders);
router.get('/orders/:orderId', getOrderById);
router.get('/orders', getOrdersByCustomer);
router.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

module.exports = router;