const fs = require('fs');
const csv = require('fast-csv');
const { v4: uuidv4 } = require('uuid');
const { getShardForCustomer } = require('./shardService');
const logger = require('../utils/logger');

const BATCH_SIZE = 500;

function validateRow(row) {
  if (!row.customer_id) return 'Missing customer_id';
  if (!row.order_date) return 'Missing order_date';
  if (isNaN(parseFloat(row.order_amount))) return 'Invalid order_amount';
  if (!row.status) return 'Missing status';
  return null;
}

async function insertBatch(batch) {
  const shardMap = new Map();

  for (const row of batch) {
    const Order = getShardForCustomer(row.customer_id);

    if (!shardMap.has(Order)) shardMap.set(Order, []);
    shardMap.get(Order).push(row);
  }

  for (const [Order, rows] of shardMap) {
    const sequelize = Order.sequelize;
    await sequelize.transaction(async (transaction) => {
      await Order.bulkCreate(rows, {
        transaction,
        ignoreDuplicates: true,
        validate: true,
      });
    });
  }
}

async function parseAndStore(filePath) {
  let batch = [];
  let processed = 0;
  let failed = 0;
  const failedRows = [];

  const stream = fs.createReadStream(filePath).pipe(
    csv.parse({ headers: true, trim: true })
  );

  try {
    for await (const row of stream) {
      const error = validateRow(row);

      if (error) {
        failed++;
        failedRows.push({ row, error });
        logger.warn('Invalid row skipped', { error, row });
        continue;
      }

      batch.push({
        order_id: row.order_id || uuidv4(),
        customer_id: row.customer_id,
        order_date: new Date(row.order_date),
        order_amount: parseFloat(row.order_amount),
        status: row.status,
      });

      if (batch.length >= BATCH_SIZE) {
        const toInsert = batch.splice(0, BATCH_SIZE);
        await insertBatch(toInsert);
        processed += toInsert.length;
        logger.info(`Inserted batch, total processed: ${processed}`);
      }
    }

    if (batch.length > 0) {
      await insertBatch(batch);
      processed += batch.length;
      logger.info(`Inserted final batch, total processed: ${processed}`);
    }

    logger.info(`Processing complete. Success: ${processed}, Failed: ${failed}`);
    return { processed, failed, failedRows };
  } catch (e) {
    logger.error('CSV processing failed', { error: e.message });
    throw e;
  }
}

module.exports = { parseAndStore, insertBatch };