jest.mock('../config/db', () => ({
  orderModels: [
    {
      sequelize: { config: { database: 'orders_shard_0' } },
      findByPk: jest.fn(),
      count: jest.fn(),
    },
    {
      sequelize: { config: { database: 'orders_shard_1' } },
      findByPk: jest.fn(),
      count: jest.fn(),
    },
  ],
}));

jest.mock('../services/shardService', () => ({
  getShardForCustomer: jest.fn(),
}));

const { orderModels } = require('../config/db');
const { getShardForCustomer } = require('../services/shardService');
const {
  findByOrderIdAcrossShards,
  findByCustomerId,
  countOrdersByShardDatabase,
  resolveShardIndexForCount,
} = require('../repositories/orderRepository');

describe('findByOrderIdAcrossShards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    orderModels[0].findByPk.mockReset();
    orderModels[1].findByPk.mockReset();
  });

  it('returns first hit as plain object', async () => {
    const payload = { order_id: 'x' };
    orderModels[0].findByPk.mockResolvedValue(null);
    orderModels[1].findByPk.mockResolvedValue({ toJSON: () => payload });

    await expect(findByOrderIdAcrossShards('x')).resolves.toEqual(payload);
    expect(orderModels[0].findByPk).toHaveBeenCalledWith('x');
    expect(orderModels[1].findByPk).toHaveBeenCalledWith('x');
  });

  it('stops scanning after first shard returns a row', async () => {
    orderModels[0].findByPk.mockResolvedValue({
      toJSON: () => ({ order_id: 'early' }),
    });

    const row = await findByOrderIdAcrossShards('early');

    expect(row).toEqual({ order_id: 'early' });
    expect(orderModels[1].findByPk).not.toHaveBeenCalled();
  });

  it('returns null when no shard has the order', async () => {
    orderModels[0].findByPk.mockResolvedValue(null);
    orderModels[1].findByPk.mockResolvedValue(null);

    await expect(findByOrderIdAcrossShards('nope')).resolves.toBeNull();
  });
});

describe('findByCustomerId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses shard routing and maps rows to JSON', async () => {
    const rows = [
      { toJSON: () => ({ id: 1 }) },
      { toJSON: () => ({ id: 2 }) },
    ];
    const Order = { findAll: jest.fn().mockResolvedValue(rows) };
    getShardForCustomer.mockReturnValue(Order);

    const out = await findByCustomerId('cust-1');

    expect(getShardForCustomer).toHaveBeenCalledWith('cust-1');
    expect(Order.findAll).toHaveBeenCalledWith({
      where: { customer_id: 'cust-1' },
      order: [['order_date', 'DESC']],
    });
    expect(out).toEqual([{ id: 1 }, { id: 2 }]);
  });
});

describe('countOrdersByShardDatabase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    orderModels[0].count.mockReset();
    orderModels[1].count.mockReset();
  });

  it('returns count for the shard whose URL database matches', async () => {
    orderModels[0].count.mockResolvedValue(42);

    const out = await countOrdersByShardDatabase('orders_shard_0');

    expect(out).toEqual({ shardIndex: 0, database: 'orders_shard_0', count: 42 });
    expect(orderModels[0].count).toHaveBeenCalledTimes(1);
    expect(orderModels[1].count).not.toHaveBeenCalled();
  });

  it('returns null when no shard uses that database name', async () => {
    await expect(countOrdersByShardDatabase('other_db')).resolves.toBeNull();
    expect(orderModels[0].count).not.toHaveBeenCalled();
  });

  it('matches database name case-insensitively', async () => {
    orderModels[1].count.mockResolvedValue(7);

    const out = await countOrdersByShardDatabase('ORDERS_SHARD_1');

    expect(out).toEqual({ shardIndex: 1, database: 'orders_shard_1', count: 7 });
    expect(orderModels[1].count).toHaveBeenCalledTimes(1);
  });

  it('accepts DB_SHARD_N_URL style (env key name)', async () => {
    orderModels[0].count.mockResolvedValue(3);

    const out = await countOrdersByShardDatabase('DB_SHARD_0_URL');

    expect(out).toEqual({ shardIndex: 0, database: 'orders_shard_0', count: 3 });
    expect(orderModels[0].count).toHaveBeenCalledTimes(1);
  });

  it('accepts numeric shard index when no DB name matches', async () => {
    orderModels[1].count.mockResolvedValue(9);

    const out = await countOrdersByShardDatabase('1');

    expect(out).toEqual({ shardIndex: 1, database: 'orders_shard_1', count: 9 });
  });
});

describe('resolveShardIndexForCount', () => {
  it('returns -1 for out-of-range env-style index', () => {
    expect(resolveShardIndexForCount('DB_SHARD_99_URL')).toBe(-1);
  });
});
