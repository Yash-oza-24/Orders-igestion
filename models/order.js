const { DataTypes } = require('sequelize');

/**
 * Same Order model bound to each shard's Sequelize instance.
 */
function defineOrder(sequelize) {
  return sequelize.define(
    'Order',
    {
      order_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      customer_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      order_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      order_amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      raw_data: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
    },
    {
      tableName: 'orders',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
      indexes: [
        { name: 'idx_orders_customer_id', fields: ['customer_id'] },
        { name: 'idx_orders_order_date', fields: ['order_date'] },
        { name: 'idx_orders_status', fields: ['status'] },
      ],
    }
  );
}

module.exports = { defineOrder };
