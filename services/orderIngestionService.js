const logger = require('../utils/logger');
const { uploadToGCS } = require('./uploadService');
const { parseAndStore } = require('./parseService');

async function ingestOrdersFile(localPath, originalName) {
  logger.info('Order ingestion started', { file: originalName });

  const gcsPath = await uploadToGCS(localPath, originalName);
  const { processed, failed } = await parseAndStore(localPath);

  logger.info('Order ingestion finished', { processed, failed });

  return { gcsPath, processed, failed };
}

module.exports = { ingestOrdersFile };
