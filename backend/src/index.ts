import dotenv from 'dotenv';
import express, { Request, Response, NextFunction, Router } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import autoIncrementRoute from './routes/autoIncrement';
import { router as connectionsRouter, apiRouters } from './routes/connections';
import connectionManager from './utils/connectionManager';
import schemaBuilderRouter from './routes/schemaBuilder';
import endpointsModule from './routes/endpoints';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health check endpoint
app.get('/health', (req: Request, res: Response): void => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Connection management endpoints
app.use('/api/connections', connectionsRouter);
app.use('/api', autoIncrementRoute);

// Endpoints management (saved builder endpoints)
app.use('/api/endpoints', endpointsModule.router);

// Schema Builder routes (DDL operations)
app.use('/api/schema-builder', schemaBuilderRouter);

// Custom endpoint execution (for API Builder-created endpoints)
app.get('/api/execute/:connectionId/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    // Not implemented
    res.status(501).json({ error: 'Not implemented yet' });
    return;
  } catch (err) {
    console.error('Error executing endpoint:', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
    return;
  }
});

// Dynamic API routes middleware
app.use('/api/:connectionId', (req: Request<{ connectionId: string }>, res: Response, next: NextFunction) => {
  const connectionId = req.params.connectionId as string;

  // Skip if this is a connections route
  if (connectionId === 'connections') {
    return next();
  }

  console.log(`[ROUTER] Request for connectionId: ${connectionId}, url: ${req.url}, method: ${req.method}`);

  const apiRouter = apiRouters.get(connectionId) as Router | undefined;

  if (!apiRouter) {
    console.log(`[ROUTER] No apiRouter found for ${connectionId}. Available:`, Array.from(apiRouters.keys()));
    return res.status(404).json({
      error: `No API found for connection '${connectionId}'. Please introspect the database first.`
    });
  }

  // Pass to the API router, trimming the mount path so routes like '/:table' match
  const prefix = `/api/${connectionId}`;
  if (req.url.startsWith(prefix)) {
    // remove prefix so child router sees the correct path
    req.url = req.url.slice(prefix.length) || '/';
  }
  apiRouter(req, res, next);
});

// Swagger UI for specific connection
app.get('/api-docs/:connectionId', async (req: Request<{ connectionId: string }>, res: Response): Promise<void> => {
  const connectionId = req.params.connectionId as string;
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  try {
    // Fetch the swagger spec
    const response = await fetch(`${baseUrl}/api/connections/${connectionId}/swagger`);

    if (!response.ok) {
      res.status(404).send('Swagger documentation not available. Please introspect the database first.');
      return;
    }

    const spec = await response.json();
    const html = swaggerUi.generateHTML(spec as object);
    res.send(html);
    return;
  } catch (error) {
    console.error('Error loading Swagger documentation', error);
    res.status(500).send('Error loading Swagger documentation');
    return;
  }
});

// Serve Swagger UI for a connection
app.use('/api-docs/:connectionId/ui', (req: Request<{ connectionId: string }>, res: Response, next: NextFunction): void => {
  const connectionId = req.params.connectionId as string;

  // Dynamically serve Swagger UI with the connection's spec
  const options = {
    swaggerOptions: {
      url: `/api/connections/${connectionId}/swagger`,
    },
  };

  // Call the middleware factory and invoke returned middleware with typed args
  const setup = swaggerUi.setup(options) as import('express').RequestHandler;
  setup(req, res, next);
});

// Error handling middleware
app.use((err: Error & { status?: number }, req: Request, res: Response, next: NextFunction): void => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && err.stack ? { stack: err.stack } : {}),
  });
});

// 404 handler
app.use((req: Request, res: Response): void => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Automatic APIs server running on http://localhost:${PORT}`);
    console.log(`📚 API documentation available at http://localhost:${PORT}/api-docs/:connectionId/ui`);
    console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  });
}

// Graceful shutdown

process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await connectionManager.closeAll();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT signal received: closing HTTP server');
  await connectionManager.closeAll();
  process.exit(0);
});

module.exports = app;
