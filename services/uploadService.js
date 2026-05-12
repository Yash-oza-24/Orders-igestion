const { bucket } = require('../config/gcs');
const logger = require('../utils/logger');

async function uploadToGCS(localFilePath, originalName) {
  const destination = `orders/${Date.now()}_${originalName}`;
  logger.info(`GCS upload started: ${destination}`);

  await bucket.upload(localFilePath, { destination });

  logger.info(`GCS upload complete: ${destination}`);
  return `gs://${process.env.GCS_BUCKET_NAME}/${destination}`;
}

module.exports = { uploadToGCS };