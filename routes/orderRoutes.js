const express = require('express');
const router  = express.Router();
const { upload, uploadOrders, getOrderById, getOrdersByCustomer } = require('../controllers/orderController');

router.post('/upload-orders', upload.single('file'), uploadOrders);
router.get('/orders/:orderId', getOrderById);
router.get('/orders', getOrdersByCustomer);
router.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

module.exports = router;