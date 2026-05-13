const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Orders Ingestion API',
    version: '1.0.0',
    description: 'API documentation for the Orders Ingestion service.',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server',
    },
  ],
  tags: [
    { name: 'Orders', description: 'Order ingestion and retrieval endpoints' },
    { name: 'Health', description: 'Service health endpoint' },
  ],
  paths: {
    '/upload-orders': {
      post: {
        tags: ['Orders'],
        summary: 'Upload orders CSV',
        description:
          'Upload a CSV file containing order records. The file is archived to Google Cloud Storage and order rows are parsed and stored in the database.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'CSV file containing order records',
                  },
                },
                required: ['file'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Orders processed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    gcsPath: { type: 'string' },
                    processed: { type: 'integer' },
                    failed: { type: 'integer' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Processing failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/orders/count-by-database': {
      get: {
        tags: ['Orders'],
        summary: 'Count orders on one shard',
        description:
          'Returns the number of rows in the `orders` table for a single shard. Pass the value in the **`database`** query parameter using **one** of these forms:\n\n' +
          '1. **Postgres database name** from your connection URL (case-insensitive), e.g. `orders_shard_0`.\n' +
          '2. **Env variable name** for that shard, e.g. `DB_SHARD_0_URL` (maps to shard index `N`).\n' +
          '3. **Shard index** as digits only, e.g. `0`, `1`, `2`, `3` (used only if it does not match a database name first).\n\n' +
          'Response: `database` (resolved Postgres name), `shardIndex`, `count`.',
        parameters: [
          {
            name: 'database',
            in: 'query',
            required: true,
            description:
              'How to pick the shard: **(1)** Postgres DB name from `DB_SHARD_*_URL` — e.g. `orders_shard_0`. **(2)** Literal env key — e.g. `DB_SHARD_0_URL`. **(3)** Shard index only — e.g. `0` … `3`.',
            schema: {
              type: 'string',
              example: 'DB_SHARD_0_URL',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Shard matched and count returned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    database: { type: 'string' },
                    shardIndex: { type: 'integer' },
                    count: { type: 'integer' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Missing database query parameter',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'No shard matched (unknown DB name, invalid DB_SHARD_N_URL index, or index out of range)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Query failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/orders/{orderId}': {
      get: {
        tags: ['Orders'],
        summary: 'Get order by ID',
        description:
          'Retrieve a single order by its UUID order ID. The service searches all database shards if necessary.',
        parameters: [
          {
            name: 'orderId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'Order UUID',
          },
        ],
        responses: {
          '200': {
            description: 'Order found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Order' },
              },
            },
          },
          '404': {
            description: 'Order not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/orders': {
      get: {
        tags: ['Orders'],
        summary: 'Get orders by customer',
        description: 'Retrieve all orders for a customer, using sharding by customer ID.',
        parameters: [
          {
            name: 'customerId',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Customer identifier',
          },
        ],
        responses: {
          '200': {
            description: 'Orders returned',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Order' },
                },
              },
            },
          },
          '400': {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Returns basic service health status and timestamp.',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    time: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Order: {
        type: 'object',
        properties: {
          order_id: { type: 'string', format: 'uuid' },
          customer_id: { type: 'string' },
          order_date: { type: 'string', format: 'date-time' },
          order_amount: { type: 'number', format: 'decimal' },
          status: { type: 'string' },
          raw_data: { type: 'object' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          details: { type: 'string' },
        },
      },
    },
  },
};

module.exports = swaggerDocument;
