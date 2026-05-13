jest.mock('uuid', () => ({
  v4: jest.fn(() => '00000000-0000-4000-8000-000000000001'),
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../services/shardService', () => ({
  getShardForCustomer: jest.fn(),
}));

const fs = require('fs');
const os = require('os');
const path = require('path');
const { getShardForCustomer } = require('../services/shardService');
const { insertBatch, parseAndStore } = require('../services/parseService');

function makeOrderModel() {
  const bulkCreate = jest.fn().mockResolvedValue([]);
  const transaction = jest.fn(async (cb) => cb({}));
  return { sequelize: { transaction }, bulkCreate };
}

describe('insertBatch', () => {
  let orderA;
  let orderB;

  beforeEach(() => {
    orderA = makeOrderModel();
    orderB = makeOrderModel();
    getShardForCustomer.mockReset();
  });

  it('runs one transaction and bulkCreate when all rows map to the same shard', async () => {
    getShardForCustomer.mockReturnValue(orderA);

    const rows = [
      {
        customer_id: 'same',
        order_id: '550e8400-e29b-41d4-a716-446655440000',
        order_date: new Date('2025-01-01'),
        order_amount: 1,
        status: 'NEW',
      },
      {
        customer_id: 'same',
        order_id: '650e8400-e29b-41d4-a716-446655440001',
        order_date: new Date('2025-01-02'),
        order_amount: 2,
        status: 'NEW',
      },
    ];

    await insertBatch(rows);

    expect(getShardForCustomer).toHaveBeenCalledWith('same');
    expect(orderA.sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(orderA.bulkCreate).toHaveBeenCalledTimes(1);
    expect(orderA.bulkCreate).toHaveBeenCalledWith(
      rows,
      expect.objectContaining({
        ignoreDuplicates: true,
        validate: true,
        transaction: {},
      })
    );
  });

  it('runs separate transactions per shard when customers route to different models', async () => {
    getShardForCustomer.mockImplementation((customerId) =>
      customerId === 'a' ? orderA : orderB
    );

    const rowA = {
      customer_id: 'a',
      order_id: '550e8400-e29b-41d4-a716-446655440000',
      order_date: new Date('2025-01-01'),
      order_amount: 1,
      status: 'NEW',
    };
    const rowB = {
      customer_id: 'b',
      order_id: '650e8400-e29b-41d4-a716-446655440001',
      order_date: new Date('2025-01-02'),
      order_amount: 2,
      status: 'NEW',
    };

    await insertBatch([rowA, rowB]);

    expect(orderA.bulkCreate).toHaveBeenCalledWith([rowA], expect.any(Object));
    expect(orderB.bulkCreate).toHaveBeenCalledWith([rowB], expect.any(Object));
    expect(orderA.sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(orderB.sequelize.transaction).toHaveBeenCalledTimes(1);
  });
});

describe('parseAndStore', () => {
  let orderModel;
  let csvPath;

  beforeEach(() => {
    orderModel = makeOrderModel();
    getShardForCustomer.mockReset();
    getShardForCustomer.mockReturnValue(orderModel);
  });

  afterEach(() => {
    if (csvPath && fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
  });

  it('streams CSV, skips invalid rows, and inserts valid rows', async () => {
    csvPath = path.join(os.tmpdir(), `orders-test-${Date.now()}.csv`);
    fs.writeFileSync(
      csvPath,
      [
        'order_id,customer_id,order_date,order_amount,status',
        ',c1,2025-01-01T00:00:00.000Z,10.00,OK',
        ',c2,2025-01-02T00:00:00.000Z,badamount,OK',
        ',c3,2025-01-03T00:00:00.000Z,5.00,OK',
      ].join('\n'),
      'utf8'
    );

    const result = await parseAndStore(csvPath);

    expect(result.failed).toBe(1);
    expect(result.processed).toBe(2);
    expect(orderModel.bulkCreate).toHaveBeenCalledTimes(1);
    const inserted = orderModel.bulkCreate.mock.calls[0][0];
    expect(inserted).toHaveLength(2);
    expect(inserted.map((r) => r.customer_id)).toEqual(['c1', 'c3']);
  });
});
