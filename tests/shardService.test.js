jest.mock('../config/db', () => ({
  SHARD_COUNT: 4,
  orderModels: [{ shard: 0 }, { shard: 1 }, { shard: 2 }, { shard: 3 }],
}));

const { getShardIndex, getShardForCustomer } = require('../services/shardService');

describe('getShardIndex', () => {
  it('always returns an index in range for SHARD_COUNT', () => {
    const samples = ['a', 'customer-1', 'x'.repeat(200), 'unicode-测试', '12345'];
    for (const id of samples) {
      const idx = getShardIndex(id);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(4);
    }
  });

  it('is deterministic for the same customer_id', () => {
    const id = 'deterministic-customer';
    expect(getShardIndex(id)).toBe(getShardIndex(id));
  });
});

describe('getShardForCustomer', () => {
  it('returns the order model for the computed shard index', () => {
    const orderModels = require('../config/db').orderModels;
    const customerId = 'route-check-customer';
    const idx = getShardIndex(customerId);
    expect(getShardForCustomer(customerId)).toBe(orderModels[idx]);
  });
});
