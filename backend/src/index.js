require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const { router: connectionsRouter, apiRouters } = require('./routes/connections');
const autoIncrementRoute = require('./routes/autoIncrement');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


// Connection management endpoints

app.use('/api/connections', connectionsRouter);
app.use('/api', autoIncrementRoute);

// Endpoints management (saved builder endpoints)
const { router: endpointsRouter } = require('./routes/endpoints');
app.use('/api/endpoints', endpointsRouter);

  // Dynamic API routes middleware
  // This intercepts /api/:connectionId/:table requests and routes to the appropriate API router
  app.use('/api/:connectionId', (req, res, next) => {
    const connectionId = req.params.connectionId;
    
    // Skip if this is a connections route
    if (connectionId === 'connections') {
      return next();
    }

    const apiRouter = apiRouters.get(connectionId);
    
    if (!apiRouter) {
      return res.status(404).json({ 
        error: `No API found for connection '${connectionId}'. Please introspect the database first.` 
      });
    }

    // Pass to the API router, trimming the mount path so routes like '/:table' match
    const prefix = `/api/${connectionId}`;
    if (req.url.startsWith(prefix)) {
      req.url = req.url.slice(prefix.length) || '/';
    }
    apiRouter(req, res, next);
  });

// Swagger UI for specific connection
app.get('/api-docs/:connectionId', async (req, res) => {
  const connectionId = req.params.connectionId;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  try {
    // Fetch the swagger spec
    const response = await fetch(`${baseUrl}/api/connections/${connectionId}/swagger`);
    
    if (!response.ok) {
      return res.status(404).send('Swagger documentation not available. Please introspect the database first.');
    }

    const spec = await response.json();
    const html = swaggerUi.generateHTML(spec);
    res.send(html);
  } catch (error) {
    res.status(500).send('Error loading Swagger documentation');
  }
});

// Serve Swagger UI for a connection
app.use('/api-docs/:connectionId/ui', (req, res, next) => {
  const connectionId = req.params.connectionId;
  
  // Dynamically serve Swagger UI with the connection's spec
  const options = {
    swaggerOptions: {
      url: `/api/connections/${connectionId}/swagger`,
    },
  };
  
  swaggerUi.setup(null, options)(req, res, next);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Automatic APIs server running on http://localhost:${PORT}`);
  console.log(`📚 API documentation available at http://localhost:${PORT}/api-docs/:connectionId/ui`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  const connectionManager = require('./utils/connectionManager');
  await connectionManager.closeAll();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT signal received: closing HTTP server');
  const connectionManager = require('./utils/connectionManager');
  await connectionManager.closeAll();
  process.exit(0);
});

module.exports = app;
