require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const routes  = require('./routes/orderRoutes');
const swaggerDocument = require('./swaggerDoc');
const { syncSchema } = require('./config/db');
const logger = require('./utils/logger');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/swagger.json', (req, res) => res.json(swaggerDocument));
app.use('/', routes);

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.status(200).json({ message: 'Orders Ingestion Service' });
});

(async () => {
  try {
    await syncSchema();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    logger.error('Server startup failed', { error: err.message, stack: err.stack });
    console.error('Startup failed (database sync):', err.message);
    process.exit(1);
  }
})();