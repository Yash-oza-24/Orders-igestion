jest.mock('../services/uploadService', () => ({
  uploadToGCS: jest.fn(),
}));

jest.mock('../services/parseService', () => ({
  parseAndStore: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { uploadToGCS } = require('../services/uploadService');
const { parseAndStore } = require('../services/parseService');
const { ingestOrdersFile } = require('../services/orderIngestionService');

describe('ingestOrdersFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uploads then parses and returns combined result', async () => {
    uploadToGCS.mockResolvedValue('gs://b/path');
    parseAndStore.mockResolvedValue({ processed: 5, failed: 1 });

    const out = await ingestOrdersFile('/tmp/a.csv', 'a.csv');

    expect(uploadToGCS).toHaveBeenCalledWith('/tmp/a.csv', 'a.csv');
    expect(parseAndStore).toHaveBeenCalledWith('/tmp/a.csv');
    expect(out).toEqual({
      gcsPath: 'gs://b/path',
      processed: 5,
      failed: 1,
    });
  });
});
