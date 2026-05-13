jest.mock('../config/db', () => ({
  orderModels: [{ findByPk: jest.fn() }, { findByPk: jest.fn() }],
}));

jest.mock('../services/shardService', () => ({
  getShardForCustomer: jest.fn(),
}));

const { orderModels } = require('../config/db');
const { getShardForCustomer } = require('../services/shardService');
const {
  findByOrderIdAcrossShards,
  findByCustomerId,
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
