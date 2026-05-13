jest.mock('../config/gcs', () => ({
  bucket: {
    upload: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { bucket } = require('../config/gcs');
const { uploadToGCS } = require('../services/uploadService');

describe('uploadToGCS', () => {
  const OLD = process.env.GCS_BUCKET_NAME;

  beforeAll(() => {
    process.env.GCS_BUCKET_NAME = 'test-bucket';
  });

  afterAll(() => {
    process.env.GCS_BUCKET_NAME = OLD;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls bucket.upload with local path and orders/ destination', async () => {
    await uploadToGCS('/data/tmp/abc', 'my.csv');

    expect(bucket.upload).toHaveBeenCalledTimes(1);
    expect(bucket.upload).toHaveBeenCalledWith(
      '/data/tmp/abc',
      expect.objectContaining({
        destination: expect.stringMatching(/^orders\/\d+_my\.csv$/),
      })
    );
  });

  it('returns gs:// URL using GCS_BUCKET_NAME and destination', async () => {
    const url = await uploadToGCS('/tmp/x', 'file.csv');
    const dest = bucket.upload.mock.calls[0][1].destination;

    expect(url).toBe(`gs://test-bucket/${dest}`);
  });
});
