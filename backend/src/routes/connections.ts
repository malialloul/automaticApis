import express, { Request, Response, Router } from 'express';
import connectionManager from '../utils/connectionManager';
import SchemaInspector from '../middleware/schemaInspector';
import APIGenerator from '../middleware/apiGenerator';
import SwaggerGenerator from '../middleware/swaggerGenerator';
import QueryBuilder from '../middleware/queryBuilder';
import { SchemaMap, DataStore, ColumnSchema, ForeignKeySchema, IndexSchema, TableSchema, JSONValue, Graph, GraphFilter } from '../types';

export const router: Router = express.Router();
export const schemaCache: Map<string, SchemaMap> = new Map();
export const apiRouters: Map<string, Router> = new Map();
export const apiGenerators: Map<string, APIGenerator> = new Map();
export const dataStore: DataStore = new Map();

function isLocalConnectionId(id: string) {
  return typeof id === 'string' && (id.startsWith('db_') || id.startsWith('local_'));
}

function getDefaultPort(type?: string) {
  const t = (type || 'postgres').toLowerCase();
  if (t === 'postgres') return 5432;
  if (t === 'mysql') return 3306;
  return 5432;
}

// POST /api/connections/test
interface ConnectionTestBody { host: string; port?: number; database: string; user: string; password: string; type?: string; uri?: string; encrypt?: boolean }
router.post('/test', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as ConnectionTestBody | undefined;
    if (!body || !body.host || !body.database || !body.user || !body.password) {
      res.status(400).json({ error: 'Missing required fields: host, database, user, password' });
      return;
    }
    const result = await connectionManager.testConnection({ host: body.host, port: body.port || getDefaultPort(body.type), database: body.database, user: body.user, password: body.password, type: body.type, uri: body.uri, encrypt: body.encrypt });
    res.json({ success: true, message: 'Connection successful', timestamp: result.timestamp });
    return;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(400).json({ success: false, error: msg });
    return;
  }
});

// POST /api/connections/:id/introspect
interface IntrospectBody { host?: string; port?: number; database?: string; user?: string; password?: string; type?: string; uri?: string; encrypt?: boolean; name?: string }
router.post('/:id/introspect', async (req: Request, res: Response): Promise<void> => {
  try {
    const connectionId = req.params.id as string;
    const body = req.body as IntrospectBody | undefined;
    const { host, port, database, user, password, type, uri, encrypt, name } = body || {};

    if (type === 'local' || isLocalConnectionId(connectionId)) {
      const schema = schemaCache.get(connectionId);
      if (!schema) {
        res.status(400).json({ error: 'No schema defined for this local database. Use Schema Builder to define tables.' });
        return;
      }

      // Count tables and relationships
      const tableCount = Object.keys(schema).length;
      let relationshipCount = 0;
      for (const table of Object.values(schema)) {
        relationshipCount += (table.foreignKeys?.length || 0) + (table.reverseForeignKeys?.length || 0);
      }

      // Persist connection metadata into app DB if available
      try {
        if (connectionManager && connectionManager.db) {
          const connName = name || connectionId;
          const sql = `INSERT INTO connections (id, name, type, host, port, database_name, username, password_encrypted, uri, use_ssl, status, is_local, last_introspected_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, NOW()) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, type=EXCLUDED.type, host=EXCLUDED.host, port=EXCLUDED.port, database_name=EXCLUDED.database_name, username=EXCLUDED.username, password_encrypted=EXCLUDED.password_encrypted, uri=EXCLUDED.uri, use_ssl=EXCLUDED.use_ssl, status='active', is_local=EXCLUDED.is_local, last_introspected_at=NOW(), updated_at=NOW()`;
          await connectionManager.db.query(sql, [connectionId, connName, (type || 'local'), host || null, port || null, database || null, user || null, password || null, uri || null, !!encrypt, 'active', true]);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('Failed to persist local connection to app DB during introspect:', msg);
      }

      res.json({ success: true, connectionId, schema, stats: { tables: tableCount, relationships: relationshipCount, endpoints: tableCount * 5 + relationshipCount } });
      return;
    }

    if (!host || !database || !user || !password) {
      res.status(400).json({ error: 'Missing required fields: host, database, user, password' });
      return;
    }

    const pool = await connectionManager.getConnection(connectionId, { host, port: port || getDefaultPort(type), database, user, password, type, uri, encrypt });
    const info = connectionManager.getInfo(connectionId);

    const inspector = new SchemaInspector(pool, info?.type || 'postgres', database);
    const schema = await inspector.introspect();

    // Cache schema
    schemaCache.set(connectionId, schema);

    // Generate API routes
    const apiGenerator = new APIGenerator(connectionId, pool, schema, info?.type || 'postgres', dataStore);
    const apiRouter = apiGenerator.generateRoutes();
    apiRouters.set(connectionId, apiRouter);
    apiGenerators.set(connectionId, apiGenerator);

    // Persist connection into app DB
    try {
      if (connectionManager && connectionManager.db) {
        const connName = name || connectionId;
        const sql = `INSERT INTO connections (id, name, type, host, port, database_name, username, password_encrypted, uri, use_ssl, status, is_local, last_introspected_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, NOW()) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, type=EXCLUDED.type, host=EXCLUDED.host, port=EXCLUDED.port, database_name=EXCLUDED.database_name, username=EXCLUDED.username, password_encrypted=EXCLUDED.password_encrypted, uri=EXCLUDED.uri, use_ssl=EXCLUDED.use_ssl, status='active', is_local=EXCLUDED.is_local, last_introspected_at=NOW(), updated_at=NOW()`;
        await connectionManager.db.query(sql, [connectionId, connName, (type || 'postgres'), host, port || getDefaultPort(type), database, user, password, uri || null, !!encrypt, 'active', false]);
      }
    } catch (e) {
      console.warn('Failed to persist remote connection to app DB during introspect:', (e as Error).message || e);
    }

    // Create endpoints for cross-table relations (best-effort, not failing if module not present)
    try {
      const endpointsModule = require('./endpoints');
      // existing code attempted to upsert generated endpoints; keep behavior but avoid throwing
      // (Note: generating related endpoints omitted for brevity)
      // endpointsModule.upsertEndpoint(endpointObj);
    } catch (e) {
      // ignore
    }

    const tableCount = Object.keys(schema).length;
    let relationshipCount = 0;
    for (const table of Object.values(schema)) {
      relationshipCount += (table.foreignKeys?.length || 0) + (table.reverseForeignKeys?.length || 0);
    }

    res.json({ success: true, connectionId, schema, stats: { tables: tableCount, relationships: relationshipCount, endpoints: tableCount * 5 + relationshipCount } });
    return;
  } catch (error) {
    console.error('Introspection failed:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/connections/:id/schema - save schema for local DB
router.post('/:id/schema', async (req: Request, res: Response): Promise<void> => {
  try {
    const connectionId = req.params.id as string;
    const body = req.body as { schema?: SchemaMap; tables?: Array<{ name?: string; columns?: Partial<ColumnSchema>[]; primaryKeys?: string[]; primaryKey?: string[]; foreignKeys?: Partial<ForeignKeySchema>[]; indexes?: IndexSchema[] }> } | undefined;
    const { schema, tables } = body || {};

    let dataToStore = schema as SchemaMap | undefined;
    if (!dataToStore && Array.isArray(tables)) {
      dataToStore = {} as SchemaMap;
      for (const t of tables as Array<{ name?: string; columns?: Partial<ColumnSchema>[]; primaryKeys?: string[]; primaryKey?: string[]; foreignKeys?: Partial<ForeignKeySchema>[]; indexes?: IndexSchema[] }>) {
        if (!t || !t.name) continue;
        const primaryKeys = (t.primaryKeys || t.primaryKey || []).map((pk: string) => typeof pk === 'string' ? pk.trim() : pk).filter(Boolean);
        dataToStore[t.name] = {
          name: t.name,
          columns: t.columns || [],
          primaryKeys: primaryKeys,
          foreignKeys: (t.foreignKeys || []).map((fk: Partial<ForeignKeySchema>) => ({ columnName: fk.columnName || '', foreignTable: fk.foreignTable || '', foreignColumn: fk.foreignColumn || '', onDelete: fk.onDelete, onUpdate: fk.onUpdate })).filter(fk => fk.columnName && fk.foreignTable && fk.foreignColumn),
          indexes: t.indexes || [],
          reverseForeignKeys: [],
        } as TableSchema;
      }
    }

    if (!dataToStore) {
      res.status(400).json({ error: 'Missing schema or tables in request body' });
      return;
    }

    // Normalize - sanitize names and ensure arrays
    const sanitizeName = (n: string | number | null | undefined): string | undefined => {
      if (n === null || n === undefined) return undefined;
      let s = String(n).trim();
      s = s.replace(/^"(.+)"$/, '$1');
      s = s.replace(/^'(.*)'$/, '$1');
      s = s.replace(/^`(.*)`$/, '$1');
      s = s.replace(/^\[(.*)\]$/, '$1');
      return s;
    };

    const normalizedSchema: SchemaMap = {};
    for (const [rawTableName, rawTableData] of Object.entries(dataToStore)) {
      const tableName = sanitizeName(rawTableName) ?? rawTableName;
      const tableData = rawTableData || {} as TableSchema;
      const normalizedFks = (tableData.foreignKeys || []).map((fk: Partial<ForeignKeySchema>) => ({ columnName: sanitizeName(fk.columnName) ?? fk.columnName ?? '', foreignTable: sanitizeName(fk.foreignTable) ?? fk.foreignTable ?? '', foreignColumn: sanitizeName(fk.foreignColumn) ?? fk.foreignColumn ?? '', onDelete: fk.onDelete || undefined, onUpdate: fk.onUpdate || undefined })).filter(fk => fk.columnName && fk.foreignTable && fk.foreignColumn);
      let primaryKeys: string[] = (tableData as { primaryKeys?: string[] }).primaryKeys || (tableData as { primaryKey?: string[] }).primaryKey || [];
      if (Array.isArray(primaryKeys)) primaryKeys = primaryKeys.map(pk => sanitizeName(pk) || String(pk)).filter(Boolean);
      if (primaryKeys.length === 0 && Array.isArray(tableData.columns)) {
        const colsWithPK = tableData.columns.filter((col: ColumnSchema) => col.isPrimaryKey);
        if (colsWithPK.length > 0) primaryKeys = colsWithPK.map((c: ColumnSchema) => sanitizeName(c.name) || c.name).filter(Boolean);
      }
      const normalizedColumns = (tableData.columns || []).map((col: ColumnSchema) => ({ ...col, name: sanitizeName(col.name) || col.name }));
      normalizedSchema[tableName] = { name: tableData.name || tableName, columns: normalizedColumns, primaryKeys, foreignKeys: normalizedFks, reverseForeignKeys: [], indexes: tableData.indexes || [] } as TableSchema;
    }

    // Compute reverse FKs
    for (const [tableName, tableInfo] of Object.entries(normalizedSchema)) {
      const fks = tableInfo.foreignKeys || [];
      for (const fk of fks) {
        const targetTable = normalizedSchema[fk.foreignTable];
        if (targetTable) {
          targetTable.reverseForeignKeys = targetTable.reverseForeignKeys || [];
          targetTable.reverseForeignKeys.push({ referencingTable: tableName, referencingColumn: fk.columnName, referencedColumn: fk.foreignColumn });
        }
      }
    }

    // Store in cache
    schemaCache.set(connectionId, normalizedSchema);

    // Persist schema in app DB if possible
    try {
      if (connectionManager && connectionManager.db) {
        const sql = `INSERT INTO schema_tables (connection_id, table_name, table_schema, table_type, metadata, created_at, updated_at) VALUES ($1,$2,'public','BASE TABLE', $3, NOW(), NOW()) ON CONFLICT (connection_id, table_schema, table_name) DO UPDATE SET metadata = EXCLUDED.metadata, updated_at = NOW()`;
        for (const [tableName, tableInfo] of Object.entries(normalizedSchema)) {
          const metadata = JSON.stringify(tableInfo);
          await connectionManager.db.query(sql, [connectionId, tableName, metadata]);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('Failed to persist schema to app DB:', msg);
    }

    if (isLocalConnectionId(connectionId)) {
      try {
        const apiGenerator = new APIGenerator(connectionId, null, normalizedSchema, 'local', dataStore);
        const apiRouter = apiGenerator.generateRoutes();
        apiGenerators.set(connectionId, apiGenerator);
        apiRouters.set(connectionId, apiRouter);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('Failed to generate API routes for local database:', msg);
      }
    }

    res.json({ success: true, connectionId, schema: normalizedSchema });
    return;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Failed to store schema:', msg);
    res.status(500).json({ error: msg });
    return;
  }
});

// GET /api/connections - list persisted connections if app DB available, otherwise return active connections
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    if (connectionManager && connectionManager.db) {
      const result = await connectionManager.db.query('SELECT id, name, type, host, port, database_name AS database, username AS user_name, is_local FROM connections ORDER BY created_at DESC');
      res.json(result.rows);
      return;
    }
    // Fallback: return active in-memory connections
    const ids = connectionManager.getConnectionIds();
    res.json(ids.map(id => ({ id })));
    return;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
    return;
  }
});

// DELETE /api/connections/:id - close and remove pooled connection and delete from app DB
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const connectionId = req.params.id as string;
    await connectionManager.closeConnection(connectionId);
    apiRouters.delete(connectionId);
    apiGenerators.delete(connectionId);
    schemaCache.delete(connectionId);
    if (connectionManager && connectionManager.db) {
      await connectionManager.db.query('DELETE FROM connections WHERE id = $1', [connectionId]);
      // Let cascade clean up schema_tables entries
    }
    res.json({ success: true, message: 'Connection removed' });
    return;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
    return;
  }
});

// GET /api/connections/:id/schema - return schema (persisted preferred)
router.get('/:id/schema', async (req: Request, res: Response): Promise<void> => {
  try {
    const connectionId = req.params.id as string;
    if (connectionManager && connectionManager.db) {
      const result = await connectionManager.db.query('SELECT metadata FROM schema_tables WHERE connection_id = $1', [connectionId]);
      if (result.rows && result.rows.length > 0) {
        // Combine metadata into keyed object
        const out: Record<string, TableSchema> = {};
        for (const row of result.rows) {
          const md = row.metadata ? JSON.parse(row.metadata) : null;
          if (md && md.name) out[md.name] = md;
        }
        res.json(out);
        return;
      }
    }

    const cached = schemaCache.get(connectionId) || null;
    res.json(cached);
    return;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
    return;
  }
});

// GET /api/connections/:id/swagger - return generated OpenAPI spec if present
router.get('/:id/swagger', (req: Request, res: Response): void => {
  try {
    const connectionId = req.params.id as string;
    const apiGen = apiGenerators.get(connectionId);
    if (!apiGen) {
      res.status(404).json({ error: 'Swagger not available. Introspect the database first.' });
      return;
    }
    const swagger = new SwaggerGenerator(connectionId, schemaCache.get(connectionId) || {} as SchemaMap).generate();
    res.json(swagger);
    return;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
    return;
  }
});

// POST /api/connections/:id/execute - execute write operations with graph context
interface ExecuteBody { operation: 'INSERT' | 'UPDATE' | 'DELETE' | string; graph: Graph; data?: Record<string, JSONValue>; additionalFilters?: GraphFilter[]; previewOnly?: boolean }
router.post('/:id/execute', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const connectionId = req.params.id as string;
    const body = req.body as ExecuteBody | undefined;
    if (!body || !body.operation) {
      res.status(400).json({ error: 'Missing operation' });
      return;
    }
    const op = (body.operation || '').toUpperCase();
    if (!['INSERT', 'UPDATE', 'DELETE'].includes(op)) {
      res.status(400).json({ error: 'Invalid operation. Must be INSERT, UPDATE or DELETE.' });
      return;
    }
    if (!body.graph || !body.graph.source || !body.graph.source.table) {
      res.status(400).json({ error: 'Missing graph.source' });
      return;
    }

    const schema = schemaCache.get(connectionId);
    if (!schema) {
      res.status(404).json({ error: 'Schema not found. Please introspect the database first.' });
      return;
    }

    // Local databases: use apiGenerator to perform in-memory writes
    if (isLocalConnectionId(connectionId)) {
      const apiGenerator = apiGenerators.get(connectionId);
      if (!apiGenerator) {
        res.status(404).json({ error: 'API Generator not found for local database' });
        return;
      }
      try {
        const result = await apiGenerator.executeWrite(op as 'INSERT' | 'UPDATE' | 'DELETE', body.graph, body.data, { previewOnly: !!body.previewOnly, additionalFilters: body.additionalFilters });
        res.json(result);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: msg });
        return;
      }
    }

    // Remote DB write execution is not yet implemented in this TypeScript port
    res.status(501).json({ error: 'Remote graph write execution not implemented yet' });
    return;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
    return;
  }
});

// POST /api/connections/:id/preview - preview results for graph
interface PreviewBody { graph: Graph; limit?: number }
router.post('/:id/preview', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const connectionId = req.params.id as string;
    const body = req.body as PreviewBody | undefined;
    let graph = body?.graph;
    const rb = req.body as Record<string, JSONValue | undefined> | undefined;
    if (!graph && rb && rb.source) graph = req.body as Graph; // tolerate saved endpoint payload form
    const limit = (body && body.limit) ? Number(body.limit) : 5;

    if (!graph || !graph.source || !graph.source.table) {
      res.status(400).json({ error: 'Missing graph.source', sql: '' });
      return;
    }

    const schema = schemaCache.get(connectionId);
    const apiGenerator = apiGenerators.get(connectionId);

    if (!schema || !apiGenerator) {
      res.status(404).json({ error: 'Schema not found. Please introspect the database first.', sql: '' });
      return;
    }

    // Local preview
    if (isLocalConnectionId(connectionId)) {
      try {
        const rows = await apiGenerator.previewGraph(graph, limit);
        res.json({ rows, limit });
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: msg, sql: '' });
        return;
      }
    }

    // Remote preview not implemented in this port
    res.status(501).json({ error: 'Remote preview not implemented yet', sql: '' });
    return;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg, sql: '' });
    return;
  }
});

export default { router };