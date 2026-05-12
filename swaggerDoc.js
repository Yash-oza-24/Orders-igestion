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
