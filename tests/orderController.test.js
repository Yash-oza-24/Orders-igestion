jest.mock('../services/orderIngestionService', () => ({
  ingestOrdersFile: jest.fn(),
}));

jest.mock('../repositories/orderRepository', () => ({
  findByOrderIdAcrossShards: jest.fn(),
  findByCustomerId: jest.fn(),
  countOrdersByShardDatabase: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { ingestOrdersFile } = require('../services/orderIngestionService');
const {
  findByOrderIdAcrossShards,
  findByCustomerId,
  countOrdersByShardDatabase,
} = require('../repositories/orderRepository');
const {
  uploadOrders,
  getOrderById,
  getOrdersByCustomer,
  getOrderCountByShardDatabase,
} = require('../controllers/orderController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('uploadOrders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when no file is present', async () => {
    const req = { file: null };
    const res = mockRes();

    await uploadOrders(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'No file uploaded' });
    expect(ingestOrdersFile).not.toHaveBeenCalled();
  });

  it('delegates to ingestion service and returns summary JSON', async () => {
    const req = {
      file: { path: '/tmp/upload.csv', originalname: 'orders.csv' },
    };
    const res = mockRes();
    ingestOrdersFile.mockResolvedValue({
      gcsPath: 'gs://bucket/orders/1_orders.csv',
      processed: 10,
      failed: 2,
    });

    await uploadOrders(req, res);

    expect(ingestOrdersFile).toHaveBeenCalledWith('/tmp/upload.csv', 'orders.csv');
    expect(res.json).toHaveBeenCalledWith({
      message: 'Orders processed successfully',
      gcsPath: 'gs://bucket/orders/1_orders.csv',
      processed: 10,
      failed: 2,
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 500 when ingestion fails', async () => {
    const req = {
      file: { path: '/tmp/x.csv', originalname: 'x.csv' },
    };
    const res = mockRes();
    ingestOrdersFile.mockRejectedValue(new Error('GCS down'));

    await uploadOrders(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Processing failed',
      details: 'GCS down',
    });
  });
});

describe('getOrderById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns JSON when repository finds an order', async () => {
    const payload = { order_id: 'abc', customer_id: 'c1' };
    findByOrderIdAcrossShards.mockResolvedValue(payload);

    const req = { params: { orderId: 'abc' } };
    const res = mockRes();

    await getOrderById(req, res);

    expect(findByOrderIdAcrossShards).toHaveBeenCalledWith('abc');
    expect(res.json).toHaveBeenCalledWith(payload);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 404 when repository finds nothing', async () => {
    findByOrderIdAcrossShards.mockResolvedValue(null);

    const req = { params: { orderId: 'missing' } };
    const res = mockRes();

    await getOrderById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Order not found' });
  });
});

describe('getOrdersByCustomer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when customerId query is missing', async () => {
    const req = { query: {} };
    const res = mockRes();

    await getOrdersByCustomer(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'customerId required' });
    expect(findByCustomerId).not.toHaveBeenCalled();
  });

  it('returns rows from repository', async () => {
    const rows = [
      { order_id: '1', customer_id: 'c99' },
      { order_id: '2', customer_id: 'c99' },
    ];
    findByCustomerId.mockResolvedValue(rows);

    const req = { query: { customerId: 'c99' } };
    const res = mockRes();

    await getOrdersByCustomer(req, res);

    expect(findByCustomerId).toHaveBeenCalledWith('c99');
    expect(res.json).toHaveBeenCalledWith(rows);
  });
});

describe('getOrderCountByShardDatabase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when database query is missing', async () => {
    const req = { query: {} };
    const res = mockRes();

    await getOrderCountByShardDatabase(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(countOrdersByShardDatabase).not.toHaveBeenCalled();
  });

  it('returns count payload when repository resolves', async () => {
    countOrdersByShardDatabase.mockResolvedValue({
      shardIndex: 0,
      database: 'orders_shard_0',
      count: 100,
    });

    const req = { query: { database: 'orders_shard_0' } };
    const res = mockRes();

    await getOrderCountByShardDatabase(req, res);

    expect(countOrdersByShardDatabase).toHaveBeenCalledWith('orders_shard_0');
    expect(res.json).toHaveBeenCalledWith({
      database: 'orders_shard_0',
      shardIndex: 0,
      count: 100,
    });
  });

  it('returns 404 when database does not match any shard', async () => {
    countOrdersByShardDatabase.mockResolvedValue(null);

    const req = { query: { database: 'nope' } };
    const res = mockRes();

    await getOrderCountByShardDatabase(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
