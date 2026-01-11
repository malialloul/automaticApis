const express = require('express');
const connectionManager = require('../utils/connectionManager');
const SchemaInspector = require('../middleware/schemaInspector');
const APIGenerator = require('../middleware/apiGenerator2');
const SwaggerGenerator = require('../middleware/swaggerGenerator');

const router = express.Router();

// Store schema cache for each connection
const schemaCache = new Map();
const apiRouters = new Map();
const apiGenerators = new Map();

// Helper to choose sensible default port per DB type
function getDefaultPort(type) {
  const t = (type || 'postgres').toLowerCase();
  if (t === 'postgres') return 5432;
  if (t === 'mysql') return 3306;
  if (t === 'mssql') return 1433;
  if (t === 'oracle') return 1521;
  if (t === 'mongodb') return 27017;
  return 5432;
}

/**
 * POST /api/connections/test
 * Test database connection
 */
router.post('/test', async (req, res) => {
  try {
    const { host, port, database, user, password, type } = req.body;

    if (!host || !database || !user || !password) {
      return res.status(400).json({ 
        error: 'Missing required fields: host, database, user, password' 
      });
    }

    const result = await connectionManager.testConnection({
      host,
      port: port || getDefaultPort(type),
      database,
      user,
      password,
      type,
    });

    res.json({ 
      success: true, 
      message: 'Connection successful',
      timestamp: result.timestamp
    });
  } catch (error) {
    console.error('Connection test failed:', error);
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/connections/:id/introspect
 * Introspect database schema and generate API routes
 */
router.post('/:id/introspect', async (req, res) => {
  try {
    const connectionId = req.params.id;
    const { host, port, database, user, password, type } = req.body;

    if (!host || !database || !user || !password) {
      return res.status(400).json({ 
        error: 'Missing required fields: host, database, user, password' 
      });
    }

    // Get or create connection pool
    const pool = await connectionManager.getConnection(connectionId, {
      host,
      port: port || getDefaultPort(type),
      database,
      user,
      password,
      type,
    });

    const info = connectionManager.getInfo(connectionId);

    // Introspect schema
    const inspector = new SchemaInspector(pool, info?.type || 'postgres', database);
    const schema = await inspector.introspect();

    // Cache schema
    schemaCache.set(connectionId, schema);

    // Generate API routes
    const apiGenerator = new APIGenerator(connectionId, pool, schema, info?.type || 'postgres');
    const apiRouter = apiGenerator.generateRoutes();
    apiRouters.set(connectionId, apiRouter);
    apiGenerators.set(connectionId, apiGenerator);

    // Count tables and relationships
    const tableCount = Object.keys(schema).length;
    let relationshipCount = 0;
    for (const table of Object.values(schema)) {
      relationshipCount += (table.foreignKeys?.length || 0) + (table.reverseForeignKeys?.length || 0);
    }

    res.json({
      success: true,
      message: 'Schema introspected successfully',
      connectionId,
      stats: {
        tables: tableCount,
        relationships: relationshipCount,
        endpoints: tableCount * 5 + relationshipCount, // Approximate
      },
    });
  } catch (error) {
    console.error('Introspection failed:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
});

/**
 * GET /api/connections/:id/schema
 * Get cached schema for a connection
 */
router.get('/:id/schema', (req, res) => {
  const connectionId = req.params.id;
  const schema = schemaCache.get(connectionId);

  if (!schema) {
    return res.status(404).json({ 
      error: 'Schema not found. Please introspect the database first.' 
    });
  }

  res.json(schema);
});

/**
 * GET /api/connections/:id/swagger
 * Get Swagger/OpenAPI specification for a connection
 */
router.get('/:id/swagger', (req, res) => {
  const connectionId = req.params.id;
  const schema = schemaCache.get(connectionId);

  if (!schema) {
    return res.status(404).json({ 
      error: 'Schema not found. Please introspect the database first.' 
    });
  }

  const swaggerGenerator = new SwaggerGenerator(connectionId, schema);
  const spec = swaggerGenerator.generate();

  res.json(spec);
});

/**
 * GET /api/connections/:id/debug-generated-routes
 * Return diagnostics collected during route generation (generated and skipped cross-table endpoints)
 */
router.get('/:id/debug-generated-routes', (req, res) => {
  const connectionId = req.params.id;
  const generator = apiGenerators.get(connectionId);
  const schema = schemaCache.get(connectionId);
  const hasRoutes = apiRouters.has(connectionId);

  if (!generator) {
    return res.status(404).json({ error: 'No generator found for this connection. Please introspect the database first.' });
  }

  res.json({
    connectionId,
    hasRoutes,
    hasSchema: !!schema,
    generated: generator._generatedCrossTableEndpoints || [],
    skipped: generator._skippedCrossTableEndpoints || []
  });
});

/**
 * DELETE /api/connections/:id
 * Close and remove a connection
 */
router.delete('/:id', async (req, res) => {
  try {
    const connectionId = req.params.id;
    
    await connectionManager.closeConnection(connectionId);
    schemaCache.delete(connectionId);
    apiRouters.delete(connectionId);

    res.json({ 
      success: true, 
      message: 'Connection closed successfully' 
    });
  } catch (error) {
    console.error('Error closing connection:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
});

/**
 * GET /api/connections
 * List all active connections
 */
router.get('/', (req, res) => {
  const connections = connectionManager.getConnectionIds();
  const details = connections.map(id => ({
    id,
    hasSchema: schemaCache.has(id),
    hasRoutes: apiRouters.has(id),
  }));

  res.json(details);
});

module.exports = { router, apiRouters, schemaCache, apiGenerators };
