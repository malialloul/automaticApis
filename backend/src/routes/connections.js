const express = require('express');
const connectionManager = require('../utils/connectionManager');
const SchemaInspector = require('../middleware/schemaInspector');
const APIGenerator = require('../middleware/apiGenerator');
const SwaggerGenerator = require('../middleware/swaggerGenerator');
const QueryBuilder = require('../middleware/queryBuilder');

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
    const { host, port, database, user, password, type, uri, encrypt } = req.body;

    // For MongoDB: either provide a URI or host + database; user/password are optional
    if ((type || 'postgres').toLowerCase() === 'mongodb') {
      if (!uri && !host) {
        return res.status(400).json({ error: 'Missing required fields: host or uri' });
      }
      if (!uri && !database) {
        return res.status(400).json({ error: 'Missing required fields: database' });
      }
    } else {
      if (!host || !database || !user || !password) {
        return res.status(400).json({
          error: 'Missing required fields: host, database, user, password'
        });
      }
    }

    const result = await connectionManager.testConnection({
      host,
      port: port || getDefaultPort(type),
      database,
      user,
      password,
      type,
      uri,
      encrypt,
    });

    // Include any additional info returned by the driver (e.g., MongoDB ping result)
    res.json({
      success: true,
      message: 'Connection successful',
      timestamp: result.timestamp,
      info: result.info || null,
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
    const { host, port, database, user, password, type, uri, encrypt } = req.body;

    if ((type || 'postgres').toLowerCase() === 'mongodb') {
      if (!uri && !host) {
        return res.status(400).json({ error: 'Missing required fields: host or uri' });
      }
      if (!uri && !database) {
        return res.status(400).json({ error: 'Missing required fields: database' });
      }
    } else {
      if (!host || !database || !user || !password) {
        return res.status(400).json({
          error: 'Missing required fields: host, database, user, password'
        });
      }
    }

    // Get or create connection pool
    const pool = await connectionManager.getConnection(connectionId, {
      host,
      port: port || getDefaultPort(type),
      database,
      user,
      password,
      type,
      uri,
      encrypt,
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

    // Persist generated cross-table endpoints into the simple endpoints store so UI can show them
    try {
      const endpointsModule = require('./endpoints');
      const generated = apiGenerator._generatedCrossTableEndpoints || [];
      generated.forEach((g, idx) => {
        try {
          // Build a friendly name and graph for the generated endpoint
          const name = `Related ${g.fkB?.foreignTable || g.fkB?.foreign_table || 'items'} for ${g.fkA?.foreignTable || g.fkA?.foreign_table || g.fkA?.table || 'parent'}`;
          const slugBase = (g.endpoint || name).replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '').slice(0, 40);
          // Construct graph: source is fkA.foreignTable, join to fkB.foreignTable via fk columns
          const sourceTable = g.fkA?.foreignTable || g.fkA?.foreign_table || null;
          const toTable = g.fkB?.foreignTable || g.fkB?.foreign_table || null;
          const fromCol = g.fkA?.columnName || g.fkA?.column_name || g.fkA?.column || null;
          const toCol = g.fkB?.foreignColumn || g.fkB?.foreign_column || g.fkB?.foreignColumn || null;
          const graph = {
            source: { table: sourceTable },
            joins: [],
            outputFields: {},
            filters: [],
            groupBy: [],
            aggregations: [],
            having: [],
          };
          if (sourceTable && toTable && fromCol && toCol) {
            graph.joins.push({ type: 'LEFT', from: { table: sourceTable, field: fromCol }, to: { table: toTable, field: toCol }, alias: toTable });
            graph.outputFields[sourceTable] = ['*'];
            graph.outputFields[toTable] = ['*'];
          }

          const endpointObj = {
            name,
            slug: slugBase,
            method: 'GET',
            path: g.endpoint,
            graph,
          };
          endpointsModule.upsertEndpoint(endpointObj);
        } catch (e) {
          // ignore single generated endpoint errors
        }
      });
    } catch (e) {
      // ignore if endpoints module can't be loaded
    }

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
 * GET /api/connections/:id/operators
 * Return operator options per table and column (useful for UIs to show valid operators)
 */
router.get('/:id/operators', (req, res) => {
  const connectionId = req.params.id;
  const schema = schemaCache.get(connectionId);

  if (!schema) {
    return res.status(404).json({ error: 'Schema not found. Please introspect the database first.' });
  }

  const operators = {};
  for (const [tableName, table] of Object.entries(schema)) {
    operators[tableName] = {};
    for (const col of table.columns || []) {
      const type = (col.type || '').toLowerCase();
      let ops = [];
      if (Array.isArray(col.enumOptions) && col.enumOptions.length > 0) {
        ops = [{ value: 'eq', label: '=' }];
      } else if (["bool", "boolean"].some((t) => type.includes(t))) {
        ops = [{ value: 'eq', label: '=' }];
      } else if (["date", "timestamp", "datetime", "time"].some((t) => type.includes(t))) {
        ops = [
          { value: 'eq', label: '=' },
          { value: 'gt', label: '>' },
          { value: 'gte', label: '>=' },
          { value: 'lt', label: '<' },
          { value: 'lte', label: '<=' },
        ];
      } else if (["int", "integer", "bigint", "smallint", "numeric", "decimal", "float", "double", "real"].some((t) => type.includes(t))) {
        ops = [
          { value: 'eq', label: '=' },
          { value: 'gt', label: '>' },
          { value: 'gte', label: '>=' },
          { value: 'lt', label: '<' },
          { value: 'lte', label: '<=' },
        ];
      } else {
        ops = [
          { value: 'eq', label: '=' },
          { value: 'contains', label: 'contains' },
          { value: 'startswith', label: 'starts with' },
          { value: 'endswith', label: 'ends with' },
        ];
      }
      operators[tableName][col.name] = ops;
    }
  }

  res.json(operators);
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

/**
 * POST /api/connections/:id/execute
 * Execute UPDATE or DELETE with full graph context (joins for filtering)
 * If previewOnly=true, returns the SQL without executing
 */
router.post('/:id/execute', async (req, res) => {
  try {
    const connectionId = req.params.id;
    const { operation, graph, data, additionalFilters, previewOnly } = req.body;

    if (!operation || !['INSERT', 'UPDATE', 'DELETE'].includes(operation.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid operation. Must be INSERT, UPDATE or DELETE.' });
    }

    if (!graph || !graph.source || !graph.source.table) {
      return res.status(400).json({ error: 'Missing graph.source' });
    }

    const schema = schemaCache.get(connectionId);
    if (!schema) {
      return res.status(404).json({ error: 'Schema not found. Please introspect the database first.' });
    }

    // Debug: Log the users table schema
    console.log('[DEBUG] Users table schema:', JSON.stringify(schema.users, null, 2));

    const connInfo = connectionManager.getInfo(connectionId);
    if (!connInfo) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    const dialect = connInfo.type || 'postgres';
    const pool = connInfo.pool;

    // Helper function to get enum type names for columns with enumOptions
    const getEnumTypeName = async (tableName, colName) => {
      // First check if schema already has udtName (from recent introspection)
      const col = schema[tableName]?.columns?.find(c => c.name === colName);
      if (col?.udtName) return col.udtName;

      // If not, try to look it up from information_schema for PostgreSQL
      if (dialect === 'postgres' && col?.enumOptions) {
        try {
          const result = await pool.query(
            `SELECT udt_name FROM information_schema.columns 
             WHERE table_name = $1 AND column_name = $2`,
            [tableName, colName]
          );
          if (result.rows.length > 0 && result.rows[0].udt_name) {
            return result.rows[0].udt_name;
          }
        } catch (e) {
          // Fallback if query fails
        }
      }

      // Last resort: try to guess from column name (e.g., "role" -> "user_role")
      if (dialect === 'postgres' && col?.enumOptions) {
        try {
          const guesses = [`${tableName}_${colName}`, `${colName}`, `${colName}_type`, `${colName}_enum`];
          for (const guess of guesses) {
            const result = await pool.query(
              `SELECT 1 FROM pg_type WHERE typname = $1`,
              [guess]
            );
            if (result.rows.length > 0) {
              return guess;
            }
          }
        } catch (e) {
          // ignore if lookup fails
        }
      }

      return null;
    };

    const sourceTable = graph.source.table;
    const qb = new QueryBuilder(sourceTable, schema[sourceTable] || { columns: [], primaryKeys: [] }, dialect);

    // Build alias map
    const aliasMap = {};
    const used = new Set();
    function getAlias(t) {
      if (aliasMap[t]) return aliasMap[t];
      const base = (t && t[0]) || 't';
      let a = base;
      let i = 1;
      while (used.has(a)) { a = `${base}${i}`; i++; }
      used.add(a);
      aliasMap[t] = a;
      return a;
    }

    const sourceAlias = getAlias(sourceTable);

    // Build JOINs
    const joins = graph.joins || [];
    let joinsSql = '';
    const joinedTables = new Set([sourceTable]);
    const processed = new Set();

    let added = true;
    while (added) {
      added = false;
      for (let i = 0; i < joins.length; i++) {
        if (processed.has(i)) continue;
        const j = joins[i];
        const type = (j.type || 'LEFT').toUpperCase();
        const fromTable = j.from && j.from.table ? j.from.table : j.fromTable || j.from;
        const toTable = j.to && j.to.table ? j.to.table : j.toTable || j.to;
        const fromField = j.from && j.from.field ? j.from.field : j.fromColumn || j.from_col || j.from;
        const toField = j.to && j.to.field ? j.to.field : j.toColumn || j.to_col || j.to;

        const fromAlias = getAlias(fromTable);
        const toAlias = getAlias(toTable);

        let joinTable, joinAlias;
        if (joinedTables.has(fromTable) && !joinedTables.has(toTable)) {
          joinTable = toTable;
          joinAlias = toAlias;
        } else if (joinedTables.has(toTable) && !joinedTables.has(fromTable)) {
          joinTable = fromTable;
          joinAlias = fromAlias;
        } else {
          continue;
        }

        joinsSql += ` ${type} JOIN ${qb.sanitizeIdentifier(joinTable)} ${joinAlias} ON ${fromAlias}.${qb.sanitizeIdentifier(fromField)} = ${toAlias}.${qb.sanitizeIdentifier(toField)}`;
        joinedTables.add(joinTable);
        processed.add(i);
        added = true;
      }
    }

    // Build WHERE clause
    const whereClauses = [];

    // Process graph filters
    const processFilter = (f) => {
      // Get the table name - f.table is the actual table name (e.g., "user_posts")
      let table = f.table || f.source || (f.field || '').split('.')[0];
      // Get the field name - strip table prefix if present
      const field = f.field && f.field.includes('.') ? f.field.split('.')[1] : f.field;
      // Look up the alias for this table from aliasMap
      const alias = aliasMap[table] || sourceAlias;
      const op = (f.op || '=').toLowerCase();
      const sqlOp = {
        'eq': '=', 'neq': '!=', 'lt': '<', 'lte': '<=', 'gt': '>', 'gte': '>=',
        'in': 'IN', 'like': 'LIKE', 'contains': 'LIKE',
      }[op] || op;

      if (op === 'in') {
        const vals = String(f.value).split(',').map(s => s.trim());
        const placeholders = vals.map(v => qb.addParam(v));
        whereClauses.push(`${qb.sanitizeIdentifier(alias)}.${qb.sanitizeIdentifier(field)} IN (${placeholders.join(', ')})`);
      } else if (op === 'between') {
        const [a, b] = String(f.value).split(',').map(s => s.trim());
        const p1 = qb.addParam(a); const p2 = qb.addParam(b);
        whereClauses.push(`${qb.sanitizeIdentifier(alias)}.${qb.sanitizeIdentifier(field)} BETWEEN ${p1} AND ${p2}`);
      } else if (['contains', 'like'].includes(op)) {
        const p = qb.addParam(`%${f.value}%`);
        whereClauses.push(`${qb.sanitizeIdentifier(alias)}.${qb.sanitizeIdentifier(field)} LIKE ${p}`);
      } else {
        const p = qb.addParam(f.value);
        whereClauses.push(`${qb.sanitizeIdentifier(alias)}.${qb.sanitizeIdentifier(field)} ${sqlOp} ${p}`);
      }
    };

    (graph.filters || []).forEach(processFilter);
    if (Array.isArray(additionalFilters)) {
      additionalFilters.forEach(processFilter);
    }

    const opUpper = operation.toUpperCase();

    // For preview mode, skip validation that requires actual data/filters
    if (!previewOnly) {
      // INSERT doesn't need filters, but UPDATE/DELETE do
      if (opUpper !== 'INSERT' && whereClauses.length === 0) {
        return res.status(400).json({ error: 'At least one filter is required for UPDATE/DELETE operations.' });
      }
    }

    const whereClause = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';
    let sql;

    if (opUpper === 'INSERT') {
      // For preview mode, show template INSERT with selected columns from outputFields
      if (previewOnly) {
        const allTables = [sourceTable, ...Array.from(joinedTables).filter(t => t !== sourceTable)];
        const outputFields = graph.outputFields || {};

        const sqlStatements = await Promise.all(allTables.map(async table => {
          const cols = schema[table]?.columns || [];
          const pks = schema[table]?.primaryKeys || [];
          const selectedFields = outputFields[table] || [];

          // If outputFields specifies columns for this table, use only those (excluding auto-increment PKs)
          // Otherwise fall back to all non-auto-increment columns
          let insertCols;
          if (selectedFields.length > 0) {
            insertCols = selectedFields.filter(colName => {
              const col = cols.find(c => c.name === colName);
              return col && !(pks.includes(colName) && col.isAutoIncrement);
            });
          } else {
            insertCols = cols.filter(c => !(pks.includes(c.name) && c.isAutoIncrement)).map(c => c.name);
          }

          if (insertCols.length === 0) return null;

          // Build placeholders with enum casting for PostgreSQL
          const placeholders = await Promise.all(insertCols.map(async (colName, i) => {
            const placeholder = dialect === 'mysql' ? '?' : `$${i + 1}`;
            const colSchema = cols.find(c => c.name === colName);

            // Check if column needs enum casting (enumOptions OR type is USER-DEFINED)
            if (dialect === 'postgres' && (colSchema?.enumOptions || colSchema?.type === 'USER-DEFINED')) {
              const enumTypeName = colSchema.udtName || await getEnumTypeName(table, colName);
              if (enumTypeName) {
                return `${placeholder}::text::${qb.sanitizeIdentifier(enumTypeName)}`;
              }
            }
            return placeholder;
          }));
          return `INSERT INTO ${qb.sanitizeIdentifier(table)} (${insertCols.map(c => qb.sanitizeIdentifier(c)).join(', ')}) VALUES (${placeholders.join(', ')})`;
        }));

        return res.json({ operation: 'INSERT', sql: sqlStatements.filter(Boolean).join(';\n'), tables: allTables, previewOnly: true });
      }

      // INSERT: Create new record(s) in tables based on graph
      if (!data || Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'No data provided for INSERT.' });
      }

      // Group fields by table (format: "table.column" or just "column" for source)
      const tableData = {};
      Object.entries(data).forEach(([key, val]) => {
        let table, col;
        if (key.includes('.')) {
          [table, col] = key.split('.');
        } else {
          table = sourceTable;
          col = key;
        }
        if (!tableData[table]) tableData[table] = {};
        tableData[table][col] = val;
      });

      // Insert into each table that has data
      const results = [];
      for (const [table, cols] of Object.entries(tableData)) {
        const columns = Object.keys(cols);
        const values = Object.values(cols);

        // Create fresh QueryBuilder for each table to avoid parameter index issues
        const tableQb = new QueryBuilder(table, schema[table] || { columns: [], primaryKeys: [] }, dialect);
        const tableSchema = schema[table] || { columns: [] };

        // Build placeholders with enum type casting for PostgreSQL
        const placeholders = [];
        for (let idx = 0; idx < columns.length; idx++) {
          const colName = columns[idx];
          const p = tableQb.addParam(values[idx]);
          const colSchema = tableSchema.columns.find(c => c.name === colName);

          // Check if column needs enum casting (enumOptions OR type is USER-DEFINED)
          if (dialect === 'postgres' && (colSchema?.enumOptions || colSchema?.type === 'USER-DEFINED')) {
            const enumTypeName = colSchema.udtName || await getEnumTypeName(table, colName);
            if (enumTypeName) {
              placeholders.push(`${p}::text::${tableQb.sanitizeIdentifier(enumTypeName)}`);
            } else {
              placeholders.push(p);
            }
          } else {
            placeholders.push(p);
          }
        }

        const insertSql = `INSERT INTO ${tableQb.sanitizeIdentifier(table)} (${columns.map(c => tableQb.sanitizeIdentifier(c)).join(', ')}) VALUES (${placeholders.join(', ')})`;
        const insertParams = [...tableQb.params];

        if (dialect === 'mysql') {
          const [rows] = await pool.query(insertSql, insertParams);
          results.push({ table, insertId: rows.insertId, affectedRows: rows.affectedRows });
        } else {
          const pgResult = await pool.query(insertSql + ' RETURNING *', insertParams);
          results.push({ table, insertedRow: pgResult.rows[0], affectedRows: pgResult.rowCount });
        }
      }

      return res.json({ operation: 'INSERT', results });
    } else if (opUpper === 'UPDATE') {
      // For preview mode, show template UPDATE with multiple table support
      if (previewOnly) {
        // Group data by table for preview - but for PUT only use source table
        const dataByTable = {};
        Object.entries(data || {}).forEach(([key, val]) => {
          let table, col;
          if (key.includes('.')) {
            const parts = key.split('.');
            table = parts[0];
            col = parts[parts.length - 1];
          } else {
            table = sourceTable;
            col = key;
          }

          // For PUT (UPDATE), only collect source table columns
          // For other operations, collect all tables
          if (operation.toUpperCase() === 'UPDATE' && table !== sourceTable) {
            return; // Skip non-source table columns for UPDATE
          }

          if (!dataByTable[table]) dataByTable[table] = {};
          dataByTable[table][col] = val;
        });

        console.log('[DEBUG] Processed data by table:', JSON.stringify(dataByTable, null, 2));

        const sqlStatements = [];

        // Generate UPDATE for each table (but for UPDATE it will only be source table)
        for (const [table, cols] of Object.entries(dataByTable)) {
          const updateCols = Object.keys(cols);
          const tableSchema = schema[table] || { columns: [] };
          // Build SET clause with enum casting for PostgreSQL
          const setTemplate = await Promise.all(updateCols.map(async c => {
            const colSchema = tableSchema.columns.find(col => col.name === c);
            // Check if column needs enum casting (enumOptions OR type is USER-DEFINED)
            if (dialect === 'postgres' && (colSchema?.enumOptions || colSchema?.type === 'USER-DEFINED')) {
              const enumTypeName = colSchema.udtName || await getEnumTypeName(table, c);
              if (enumTypeName) {
                return `${qb.sanitizeIdentifier(c)} = ?::text::${qb.sanitizeIdentifier(enumTypeName)}`;
              }
            }
            return `${qb.sanitizeIdentifier(c)} = ?`;
          }));
          const setTemplateStr = setTemplate.join(', ');

          if (table === sourceTable) {
            // Source table: use full JOIN context for filtering
            const filterTemplate = whereClauses.length > 0 ? whereClause : ' WHERE <filter_conditions>';
            if (dialect === 'mysql') {
              if (joinsSql) {
                sqlStatements.push(`UPDATE ${qb.sanitizeIdentifier(sourceTable)} ${sourceAlias}${joinsSql} SET ${setTemplateStr}${filterTemplate}`);
              } else {
                sqlStatements.push(`UPDATE ${qb.sanitizeIdentifier(table)} SET ${setTemplateStr}${filterTemplate}`);
              }
            } else if (joinsSql) {
              const fromTables = Array.from(joinedTables).filter(t => t !== sourceTable);
              const fromClause = fromTables.map(t => `${qb.sanitizeIdentifier(t)} ${aliasMap[t]}`).join(', ');
              const joinConditions = [];
              joins.forEach(j => {
                const fromTable = j.from && j.from.table ? j.from.table : j.fromTable || j.from;
                const toTable = j.to && j.to.table ? j.to.table : j.toTable || j.to;
                const fromField = j.from && j.from.field ? j.from.field : j.fromColumn || j.from_col;
                const toField = j.to && j.to.field ? j.to.field : j.toColumn || j.to_col;
                // For PostgreSQL UPDATE, use table name for source table (can't alias target table)
                const fromRef = fromTable === sourceTable ? qb.sanitizeIdentifier(sourceTable) : aliasMap[fromTable];
                const toRef = toTable === sourceTable ? qb.sanitizeIdentifier(sourceTable) : aliasMap[toTable];
                joinConditions.push(`${fromRef}.${qb.sanitizeIdentifier(fromField)} = ${toRef}.${qb.sanitizeIdentifier(toField)}`);
              });
              // Replace source alias with table name in WHERE clauses for PostgreSQL UPDATE
              const fixedWhereClauses = whereClauses.map(clause =>
                clause.replace(new RegExp(`"${sourceAlias}"\\.`, 'g'), `${qb.sanitizeIdentifier(sourceTable)}.`)
              );
              sqlStatements.push(`UPDATE ${qb.sanitizeIdentifier(table)} SET ${setTemplateStr} FROM ${fromClause} WHERE ${joinConditions.join(' AND ')}${fixedWhereClauses.length > 0 ? ' AND ' + fixedWhereClauses.join(' AND ') : ''}`);
            } else {
              // No joins - replace source alias with table name in WHERE for preview
              const fixedFilterTemplate = filterTemplate.replace(new RegExp(`"${sourceAlias}"\\.`, 'g'), `${qb.sanitizeIdentifier(sourceTable)}.`);
              sqlStatements.push(`UPDATE ${qb.sanitizeIdentifier(table)} SET ${setTemplateStr}${fixedFilterTemplate}`);
            }
          } else {
            // Joined table: find join condition to filter rows
            const joinForTable = joins.find(j =>
              (j.from?.table || j.fromTable || j.from) === table ||
              (j.to?.table || j.toTable || j.to) === table
            );

            if (joinForTable) {
              const fromTable = joinForTable.from?.table || joinForTable.fromTable || joinForTable.from;
              const toTable = joinForTable.to?.table || joinForTable.toTable || joinForTable.to;
              const fromField = joinForTable.from?.field || joinForTable.fromColumn || joinForTable.from_col;
              const toField = joinForTable.to?.field || joinForTable.toColumn || joinForTable.to_col;

              // Determine which side of the join is the 'target' and which is the 'parent'
              const isFrom = fromTable === table;
              const targetCol = isFrom ? fromField : toField;
              const parentTable = isFrom ? toTable : fromTable;
              const parentCol = isFrom ? toField : fromField;

              // Generate a subquery-based UPDATE for the preview
              sqlStatements.push(
                `UPDATE ${qb.sanitizeIdentifier(table)} SET ${setTemplateStr} ` +
                `WHERE ${qb.sanitizeIdentifier(targetCol)} IN (` +
                `SELECT ${qb.sanitizeIdentifier(parentCol)} FROM ${qb.sanitizeIdentifier(parentTable)} WHERE <filter_conditions>)`
              );
            }
          }

        }

        return res.json({
          operation: 'UPDATE',
          sql: sqlStatements.filter(Boolean).join(';\n'),
          previewOnly: true
        });
      }

      if (!data || Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'No data provided for UPDATE.' });
      }

      // Group data by table for execution
      const dataByTable = {};
      Object.entries(data).forEach(([key, val]) => {
        let table, col;
        if (key.includes('.')) {
          const parts = key.split('.');
          table = parts[0];
          col = parts[parts.length - 1];
        } else {
          table = sourceTable;
          col = key;
        }
        if (!dataByTable[table]) dataByTable[table] = {};
        dataByTable[table][col] = val;
      });

      // Execute UPDATE for each table
      const results = [];
      for (const [table, cols] of Object.entries(dataByTable)) {
        try {
          const updateCols = Object.keys(cols);
          const tableQb = new QueryBuilder(table, schema[table] || { columns: [], primaryKeys: [] }, dialect);
          const tableSchema = schema[table] || { columns: [] };

          const setClauses = [];
          // Build SET clauses with enum type lookup and basic type coercion
          for (const col of updateCols) {
            let val = cols[col];
            const colSchema = tableSchema.columns.find(c => c.name === col);

            // Coerce basic types for numeric/boolean columns to avoid PG casting errors
            if ((dialect === 'postgres' || dialect === 'mysql') && colSchema?.type) {
              const t = String(colSchema.type).toLowerCase();
              if (/(integer|bigint|smallint|numeric|decimal)/.test(t)) {
                if (typeof val === 'string') {
                  if (/^\s*-?\d+(\.\d+)?\s*$/.test(val)) {
                    val = Number(val);
                  } else {
                    throw new Error(`Invalid value for numeric column ${table}.${col}: "${val}"`);
                  }
                }
              } else if (/boolean/.test(t)) {
                if (typeof val === 'string') {
                  const low = val.toLowerCase();
                  if (low === 'true') val = true;
                  else if (low === 'false') val = false;
                  else throw new Error(`Invalid value for boolean column ${table}.${col}: "${val}"`);
                }
              }
            }

            const p = tableQb.addParam(val);

          console.log(`[UPDATE EXECUTION] Column: ${col}, Value: ${val}`, {
            hasEnumOptions: !!colSchema?.enumOptions,
            enumOptions: colSchema?.enumOptions,
            type: colSchema?.type,
            udtName: colSchema?.udtName,
              colSchemaKeys: colSchema ? Object.keys(colSchema) : 'NO SCHEMA'
          });

          // Check if column needs enum casting
          // For PostgreSQL: check enumOptions OR if type is USER-DEFINED (enum)
          if (dialect === 'postgres' && (colSchema?.enumOptions || colSchema?.type === 'USER-DEFINED')) {
            const enumTypeName = colSchema.udtName || await getEnumTypeName(table, col);
            console.log(`[UPDATE EXECUTION] Enum detected for ${col}, enumTypeName: ${enumTypeName}`);
            if (enumTypeName) {
              setClauses.push(`${tableQb.sanitizeIdentifier(col)} = ${p}::text::${tableQb.sanitizeIdentifier(enumTypeName)}`);
            } else {
              setClauses.push(`${tableQb.sanitizeIdentifier(col)} = ${p}`);
            }
          } else {
            setClauses.push(`${tableQb.sanitizeIdentifier(col)} = ${p}`);
          }
          }

        let sql;
        // Parameter offset for WHERE placeholders (Postgres numbered params)
        const paramOffset = tableQb.params.length;
        const renumberPlaceholders = (s) => {
          if (!s || dialect === 'mysql') return s;
          return s.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + paramOffset}`);
        };
        if (table === sourceTable) {
          // Source table: use full filter context with joins
          if (dialect === 'mysql') {
            if (joinsSql) {
              sql = `UPDATE ${tableQb.sanitizeIdentifier(sourceTable)} ${sourceAlias}${joinsSql} SET ${setClauses.join(', ')}${whereClause}`;
            } else {
              sql = `UPDATE ${tableQb.sanitizeIdentifier(table)} SET ${setClauses.join(', ')}${whereClause}`;
            }
          } else {
            if (joinsSql) {
              const fromTables = Array.from(joinedTables).filter(t => t !== sourceTable);
              const fromClause = fromTables.map(t => `${tableQb.sanitizeIdentifier(t)} ${aliasMap[t]}`).join(', ');
              const joinConditions = [];
              joins.forEach(j => {
                const fromTable = j.from?.table || j.fromTable || j.from;
                const toTable = j.to?.table || j.toTable || j.to;
                const fromField = j.from?.field || j.fromColumn || j.from_col;
                const toField = j.to?.field || j.toColumn || j.to_col;
                // For PostgreSQL UPDATE, use table name for source table (can't alias target table)
                const fromRef = fromTable === sourceTable ? tableQb.sanitizeIdentifier(sourceTable) : aliasMap[fromTable];
                const toRef = toTable === sourceTable ? tableQb.sanitizeIdentifier(sourceTable) : aliasMap[toTable];
                joinConditions.push(`${fromRef}.${tableQb.sanitizeIdentifier(fromField)} = ${toRef}.${tableQb.sanitizeIdentifier(toField)}`);
              });
              // Replace source alias with table name in WHERE clauses for PostgreSQL UPDATE
              let fixedWhereClauses = whereClauses.map(clause =>
                clause.replace(new RegExp(`"${sourceAlias}"\\.`, 'g'), `${tableQb.sanitizeIdentifier(sourceTable)}.`)
              );
              fixedWhereClauses = fixedWhereClauses.map(renumberPlaceholders);
              sql = `UPDATE ${tableQb.sanitizeIdentifier(table)} SET ${setClauses.join(', ')} FROM ${fromClause} WHERE ${joinConditions.join(' AND ')}${fixedWhereClauses.length > 0 ? ' AND ' + fixedWhereClauses.join(' AND ') : ''}`;
            } else {
              // No joins - replace source alias with table name in WHERE
              let fixedWhereClause = whereClause.replace(new RegExp(`"${sourceAlias}"\\.`, 'g'), `${tableQb.sanitizeIdentifier(sourceTable)}.`);
              fixedWhereClause = renumberPlaceholders(fixedWhereClause);
              sql = `UPDATE ${tableQb.sanitizeIdentifier(table)} SET ${setClauses.join(', ')}${fixedWhereClause}`;
            }
          }
        } else {
          // Joined table: find the join condition
          const joinForTable = joins.find(j =>
            (j.from?.table || j.fromTable || j.from) === table || (j.to?.table || j.toTable || j.to) === table
          );
          if (joinForTable) {
            const fromTable = joinForTable.from?.table || joinForTable.fromTable || joinForTable.from;
            const toTable = joinForTable.to?.table || joinForTable.toTable || joinForTable.to;
            const fromField = joinForTable.from?.field || joinForTable.fromColumn || joinForTable.from_col;
            const toField = joinForTable.to?.field || joinForTable.toColumn || joinForTable.to_col;

            if (dialect === 'mysql') {
              sql = `UPDATE ${tableQb.sanitizeIdentifier(table)} JOIN ${tableQb.sanitizeIdentifier(sourceTable)} ON ${tableQb.sanitizeIdentifier(table)}.${tableQb.sanitizeIdentifier(toField)} = ${tableQb.sanitizeIdentifier(sourceTable)}.${tableQb.sanitizeIdentifier(fromField)} SET ${setClauses.join(', ')}${whereClause}`;
            } else {
              const renumWhereClauses = whereClauses.map(renumberPlaceholders);
              sql = `UPDATE ${tableQb.sanitizeIdentifier(table)} SET ${setClauses.join(', ')} FROM ${tableQb.sanitizeIdentifier(sourceTable)} WHERE ${tableQb.sanitizeIdentifier(table)}.${tableQb.sanitizeIdentifier(toField)} = ${tableQb.sanitizeIdentifier(sourceTable)}.${tableQb.sanitizeIdentifier(fromField)}${renumWhereClauses.length > 0 ? ' AND ' + renumWhereClauses.join(' AND ') : ''}`;
            }
          }
        }

          if (sql) {
            if (dialect === 'mysql') {
            // MySQL uses '?' so params are simply concatenated
            const [rows] = await pool.query(sql, [...tableQb.params, ...qb.params]);
              results.push({ table, affectedRows: rows.affectedRows });
            } else {
              try {
                // Postgres numbered params: combine SET params then WHERE params (renumbered above)
                const pgResult = await pool.query(sql, [...tableQb.params, ...qb.params]);
                results.push({ table, affectedRows: pgResult.rowCount });
              } catch (e) {
                return res.status(400).json({ error: e.message, sql, params: [...tableQb.params, ...qb.params] });
              }
            }
          }
        } catch (e) {
          // Return validation/type errors early with context
          return res.status(400).json({ error: e.message, sql: null });
        }
      }

      return res.json({ operation: 'UPDATE', results });
    } else {
      // DELETE
      // For preview mode, show template DELETE
      if (previewOnly) {
        const filterTemplate = whereClauses.length > 0 ? whereClause : ' WHERE <filter_conditions>';
        let previewSql;
        if (dialect === 'mysql') {
          previewSql = `DELETE ${sourceAlias} FROM ${qb.sanitizeIdentifier(sourceTable)} ${sourceAlias}${joinsSql}${filterTemplate}`;
        } else if (joinsSql) {
          const usingTables = Array.from(joinedTables).filter(t => t !== sourceTable);
          const usingClause = usingTables.map(t => `${qb.sanitizeIdentifier(t)} ${aliasMap[t]}`).join(', ');
          const joinConditions = [];
          joins.forEach(j => {
            const fromTable = j.from && j.from.table ? j.from.table : j.fromTable || j.from;
            const toTable = j.to && j.to.table ? j.to.table : j.toTable || j.to;
            const fromField = j.from && j.from.field ? j.from.field : j.fromColumn || j.from_col;
            const toField = j.to && j.to.field ? j.to.field : j.toColumn || j.to_col;
            joinConditions.push(`${aliasMap[fromTable]}.${qb.sanitizeIdentifier(fromField)} = ${aliasMap[toTable]}.${qb.sanitizeIdentifier(toField)}`);
          });
          previewSql = `DELETE FROM ${qb.sanitizeIdentifier(sourceTable)} ${sourceAlias} USING ${usingClause} WHERE ${joinConditions.join(' AND ')}${whereClauses.length > 0 ? ' AND ' + whereClauses.join(' AND ') : ''}`;
        } else {
          previewSql = `DELETE FROM ${qb.sanitizeIdentifier(sourceTable)} ${sourceAlias}${filterTemplate}`;
        }
        return res.json({ operation: 'DELETE', sql: previewSql, previewOnly: true });
      }

      if (dialect === 'mysql') {
        // MySQL: DELETE alias FROM table alias JOIN ...
        sql = `DELETE ${sourceAlias} FROM ${qb.sanitizeIdentifier(sourceTable)} ${sourceAlias}${joinsSql}${whereClause}`;
      } else {
        // PostgreSQL: DELETE with USING clause for joins
        if (joinsSql) {
          const usingTables = Array.from(joinedTables).filter(t => t !== sourceTable);
          const usingClause = usingTables.map(t => `${qb.sanitizeIdentifier(t)} ${aliasMap[t]}`).join(', ');
          const joinConditions = [];
          joins.forEach(j => {
            const fromTable = j.from && j.from.table ? j.from.table : j.fromTable || j.from;
            const toTable = j.to && j.to.table ? j.to.table : j.toTable || j.to;
            const fromField = j.from && j.from.field ? j.from.field : j.fromColumn || j.from_col;
            const toField = j.to && j.to.field ? j.to.field : j.toColumn || j.to_col;
            joinConditions.push(`${aliasMap[fromTable]}.${qb.sanitizeIdentifier(fromField)} = ${aliasMap[toTable]}.${qb.sanitizeIdentifier(toField)}`);
          });
          sql = `DELETE FROM ${qb.sanitizeIdentifier(sourceTable)} ${sourceAlias} USING ${usingClause} WHERE ${joinConditions.join(' AND ')} AND ${whereClauses.join(' AND ')}`;
        } else {
          sql = `DELETE FROM ${qb.sanitizeIdentifier(sourceTable)} ${sourceAlias}${whereClause}`;
        }
      }
    }

    const params = qb.params;

    // Execute the query
    let result;
    if (dialect === 'mysql') {
      const [rows] = await pool.query(sql, params);
      result = { affectedRows: rows.affectedRows, sql, params };
    } else {
      const pgResult = await pool.query(sql, params);
      result = { affectedRows: pgResult.rowCount, sql, params };
    }

    res.json(result);
  } catch (error) {
    console.error('Execute error:', error);
    res.status(500).json({ error: error.message, sql: error.sql || '' });
  }
});

/**
 * POST /api/connections/:id/preview
 * Preview query results with full graph context
 */
router.post('/:id/preview', async (req, res) => {
  try {
    const connectionId = req.params.id;
    // Accept either { graph: {...} } or a top-level graph-like payload (for saved endpoints)
    let graph = req.body && req.body.graph;
    if (!graph && req.body && req.body.source) graph = req.body; // accept payloads that directly contain source/joins/etc
    const limit = req.body && Number(req.body.limit) ? Number(req.body.limit) : 5;
    const schema = schemaCache.get(connectionId);
    const apiGenerator = apiGenerators.get(connectionId);

    if (!schema || !apiGenerator) return res.status(404).json({ error: 'Schema not found. Please introspect the database first.', sql: '' });

    // Basic validation
    if (!graph || !graph.source || !graph.source.table) return res.status(400).json({ error: 'Missing graph.source', sql: '' });

    // Get dialect from connection info
    const connInfo = connectionManager.getInfo(connectionId);
    const dialect = connInfo?.type || 'postgres';

    const sourceTable = graph.source.table;
    const qb = new QueryBuilder(sourceTable, schema[sourceTable] || { columns: [], primaryKeys: [] }, dialect);

    // Build alias map
    const aliasMap = {};
    const used = new Set();
    function getAlias(t) {
      if (aliasMap[t]) return aliasMap[t];
      const base = (t && t[0]) || 't';
      let a = base;
      let i = 1;
      while (used.has(a)) { a = `${base}${i}`; i++; }
      used.add(a);
      aliasMap[t] = a;
      return a;
    }

    getAlias(sourceTable);
    // Assign aliases for joined tables, reusing for same table
    (graph.joins || []).forEach(j => {
      const ft = (j.from && j.from.table) ? j.from.table : (j.fromTable || j.from);
      const tt = (j.to && j.to.table) ? j.to.table : (j.toTable || j.to);
      if (ft) j._fromAlias = getAlias(ft);
      if (tt) j._toAlias = getAlias(tt);
    });

    // Special case: if a join references the source table, ensure it uses the source alias
    (graph.joins || []).forEach(j => {
      const tt = (j.to && j.to.table) ? j.to.table : (j.toTable || j.to);
      if (tt === sourceTable) j._toAlias = getAlias(sourceTable);
    });

    // If outputFields is provided but joined tables are missing, include them as "all fields" so
    // common Builder flows (add table A, join table B) return both tables' columns as expected.
    const effectiveOutputFields = {};
    if (graph.outputFields && Object.keys(graph.outputFields).length > 0) {
      Object.entries(graph.outputFields).forEach(([k, v]) => { effectiveOutputFields[k] = v; });
      (graph.joins || []).forEach(j => {
        const ft = (j.from && j.from.table) ? j.from.table : (j.fromTable || j.from);
        const tt = (j.to && j.to.table) ? j.to.table : (j.toTable || j.to);
        if (ft && !(ft in effectiveOutputFields)) effectiveOutputFields[ft] = [];
        if (tt && !(tt in effectiveOutputFields)) effectiveOutputFields[tt] = [];
      });
    } else if (graph.outputFields && Object.keys(graph.outputFields).length === 0) {
      // explicit empty object - treat as no selection
    }

    // Helper to resolve field references (accept either table.field or alias.field)
    function resolveField(f) {
      if (!f) return f;
      const s = String(f);
      if (!s.includes('.')) return s;
      const [left, ...rest] = s.split('.');
      const right = rest.join('.');

      try {
        // If left matches a table name, convert to that table's alias
        if (schema[left]) return `${qb.sanitizeIdentifier(getAlias(left))}.${qb.sanitizeIdentifier(right)}`;

        // If left is an existing alias value, assume it's already an alias
        const aliasKey = Object.keys(aliasMap).find(k => aliasMap[k] === left);
        if (aliasKey) return `${qb.sanitizeIdentifier(left)}.${qb.sanitizeIdentifier(right)}`;

        // If left corresponds to a per-join alias key like 'table#1' in aliasMap, use it
        if (aliasMap[left]) return `${qb.sanitizeIdentifier(aliasMap[left])}.${qb.sanitizeIdentifier(right)}`;
      } catch (e) {
        // If sanitization fails (e.g., expressions), fall back to original string
        return s;
      }

      // fallback to as-is (may be a bare column or expression)
      return s;
    }

    // Helper to check if a table is in the query (source or joined)
    function isTableInQuery(t) {
      if (t === sourceTable) return true;
      return (graph.joins || []).some(j => {
        const ft = (j.from && j.from.table) ? j.from.table : (j.fromTable || j.from);
        const tt = (j.to && j.to.table) ? j.to.table : (j.toTable || j.to);
        return ft === t || tt === t;
      });
    }

    // Aggregations (map then filter to only tables in query). Supports aggregations specified
    // as { field: 'table.column' } as well as { table: 'table', field: 'column' }.
    // Build aggregations list, normalizing { field: 'table.col' } forms and ensuring
    // aggregation aliases do not collide with table aliases (e.g., user-provided "u").
    const aggs = (graph.aggregations || []).map(a => {
      const tableField = String(a.field || a.fieldName || '').split('.');
      let tbl = a.table;
      let fld = a.field;
      if (tableField.length === 2) { tbl = tableField[0]; fld = tableField[1]; }

      // If tbl is an alias (not a real table), resolve it to the actual table name
      const actualTable = Object.keys(aliasMap).find(k => aliasMap[k] === tbl) || tbl;

      let alias = a.as || a.alias || `${(a.type || a.func || 'agg').toLowerCase()}_${fld}`;
      // avoid alias colliding with table alias
      if (alias === getAlias(actualTable)) alias = `${alias}_agg`;
      return { type: a.type || a.func, table: actualTable, field: fld, as: alias, fieldAlias: tbl };
    }).filter(a => isTableInQuery(a.table));

    // Determine select list and build a human-friendly summary for the UI.
    const selects = [];
    const summaryParts = [];

    // Check if we should skip individual fields (aggregations without groupBy)
    const hasAggs = (graph.aggregations || []).length > 0;
    const hasGroupBy = graph.groupBy && graph.groupBy.length > 0;
    const skipIndividualFields = hasAggs && !hasGroupBy;

    if (graph.fields && Array.isArray(graph.fields) && graph.fields.length > 0 && !skipIndividualFields) {
      // Use explicit graph.fields and alias columns to avoid collisions (table_column)
      graph.fields.forEach((f) => {
        const s = String(f);

        // Check if this field is an aggregation alias (skip it, will be added separately)
        const isAggAlias = aggs.some(a => a.as === s);
        if (isAggAlias) {
          return; // Skip aggregation aliases; they'll be handled separately
        }

        if (s.includes('.')) {
          const [left, ...rest] = s.split('.');
          const right = rest.join('.');
          // Determine the originating table name
          let tableName = left;
          if (!schema[tableName]) {
            // Maybe left is an alias; find the original table name
            const aliasKey = Object.keys(aliasMap).find(k => aliasMap[k] === left);
            if (aliasKey) tableName = aliasKey;
          }

          // Determine alias to use in SQL (prefer explicit alias or generated alias)
          let aliasToUse = left;
          if (schema[left]) aliasToUse = getAlias(left);
          if (aliasMap[left]) aliasToUse = aliasMap[left];

          try {
            const sqlSel = `${qb.sanitizeIdentifier(aliasToUse)}.${qb.sanitizeIdentifier(right)} AS ${qb.sanitizeIdentifier(`${tableName}_${right}`)}`;
            selects.push(sqlSel);
          } catch (e) {
            // fallback to the resolved value (useful for expressions)
            selects.push(resolveField(f));
          }
        } else {
          // non-dotted expressions: preserve as provided
          selects.push(resolveField(f));
        }
      });
      summaryParts.push(`Selecting specific fields: ${graph.fields.join(', ')}`);
    } else if (Object.keys(effectiveOutputFields).length > 0) {
      for (const [t, fs] of Object.entries(effectiveOutputFields)) {
        const isSource = t === sourceTable;
        const isJoined = (graph.joins || []).some(j => {
          const ft = (j.from && j.from.table) ? j.from.table : (j.fromTable || j.from);
          const tt = (j.to && j.to.table) ? j.to.table : (j.toTable || j.to);
          return ft === t || tt === t;
        });
        if (!isSource && !isJoined) continue; // Skip tables not in the query

        // If aggregations exist but no groupBy, skip selecting individual fields
        if (skipIndividualFields) {
          summaryParts.push(`${t}: no fields (aggregation without GROUP BY)`);
          continue;
        }

        if (!fs || fs.length === 0) {
          // empty selection for a table
          if (!Boolean(graph.outputFields && Object.keys(graph.outputFields).length > 0)) {
            // interpret as all columns from that table (legacy/default behavior)
            selects.push(`${getAlias(t)}.*`);
            summaryParts.push(`${t}: all fields`);
          } else {
            // explicit empty selection -> skip selecting columns for this table
            summaryParts.push(`${t}: no fields selected`);
          }
        } else {
          (fs || []).forEach(f => {
            try {
              selects.push(`${qb.sanitizeIdentifier(getAlias(t))}.${qb.sanitizeIdentifier(f)} AS ${qb.sanitizeIdentifier(`${t}_${f}`)}`);
            } catch (e) {
              selects.push(`${getAlias(t)}.${f}`);
            }
          });
          summaryParts.push(`${t}: ${fs.join(', ')}`);
        }
      }
    } else {
      // If aggregations exist but no groupBy, skip selecting all fields
      if (skipIndividualFields) {
        summaryParts.push(`${sourceTable}: no fields (aggregation without GROUP BY)`);
      } else {
        selects.push(`${getAlias(sourceTable)}.*`);
        summaryParts.push(`${sourceTable}: all fields`);
      }
    }

    // Build FROM and JOINs
    const joinedTables = new Set([sourceTable]);
    let joinsSql = '';
    const joins = graph.joins || [];
    const processed = new Set();

    let added = true;
    while (added) {
      added = false;
      for (let i = 0; i < joins.length; i++) {
        if (processed.has(i)) continue;
        const j = joins[i];
        const type = (j.type || 'LEFT').toUpperCase();
        const fromTable = j.from && j.from.table ? j.from.table : j.fromTable || j.from;
        const toTable = j.to && j.to.table ? j.to.table : j.toTable || j.to;
        const fromField = j.from && j.from.field ? j.from.field : j.fromColumn || j.from_col || j.from;
        const toField = j.to && j.to.field ? j.to.field : j.toColumn || j.to_col || j.to;

        // Prefer per-join assigned alias if available (handles self-joins and
        // repeated references) otherwise fall back to table-scoped alias.
        const fromAlias = j._fromAlias || getAlias(fromTable);
        const toAlias = j._toAlias || getAlias(toTable);

        let joinTable, joinAlias;
        if (joinedTables.has(fromTable) && !joinedTables.has(toTable)) {
          joinTable = toTable;
          joinAlias = toAlias;
        } else if (joinedTables.has(toTable) && !joinedTables.has(fromTable)) {
          joinTable = fromTable;
          joinAlias = fromAlias;
        } else {
          continue; // cannot join yet
        }

        joinsSql += ` ${type} JOIN ${qb.sanitizeIdentifier(joinTable)} ${joinAlias} ON ${fromAlias}.${qb.sanitizeIdentifier(fromField)} = ${toAlias}.${qb.sanitizeIdentifier(toField)}`;
        joinedTables.add(joinTable);
        processed.add(i);
        added = true;
      }
    }

    // Rebuild selects based on actually joined tables
    const finalSelects = [];
    const finalSummaryParts = [];
    const userProvidedOutput = Boolean(graph.outputFields && Object.keys(graph.outputFields).length > 0);
    for (const [t, fs] of Object.entries(effectiveOutputFields)) {
      if (!joinedTables.has(t)) continue;
      const alias = getAlias(t);

      if (userProvidedOutput) {
        // User explicitly provided per-table selections. An empty array means "no columns" for that table.
        if (!Array.isArray(fs) || fs.length === 0) {
          // explicit empty selection -> skip adding columns for this table
          finalSummaryParts.push(`${t}: no fields selected`);
          continue;
        }
        // Don't add the fields here, as they are added via the unshift of selects
        finalSummaryParts.push(`${t}: ${fs.join(', ')}`);
      } else {
        // Default behavior: missing or empty => all fields
        if (!fs || fs.length === 0) {
          // If GROUP BY is present, cannot use SELECT *, must select explicit columns
          if (graph.groupBy && graph.groupBy.length > 0) {
            const allCols = (schema[t] && schema[t].columns) || [];
            allCols.forEach(c => finalSelects.push(`${qb.sanitizeIdentifier(alias)}.${qb.sanitizeIdentifier(c.name)} AS ${qb.sanitizeIdentifier(`${t}_${c.name}`)}`));
          } else {
            finalSelects.push(`${alias}.*`);
          }
          finalSummaryParts.push(`${t}: all fields`);
        } else {
          fs.forEach(f => finalSelects.push(`${qb.sanitizeIdentifier(alias)}.${qb.sanitizeIdentifier(f)} AS ${qb.sanitizeIdentifier(`${t}_${f}`)}`));
          finalSummaryParts.push(`${t}: ${fs.join(', ')}`);
        }
      }
    }

    // Add aggregations for joined tables
    aggs.forEach(a => {
      if (joinedTables.has(a.table)) {
        finalSelects.push(`${a.type}(${qb.sanitizeIdentifier(getAlias(a.table))}.${qb.sanitizeIdentifier(a.field)}) AS ${qb.sanitizeIdentifier(a.as)}`);
      }
    });

    // If explicit graph.fields were provided earlier (resolved into `selects`), prefer them
    // for the final select list (filtered to tables actually in the query).
    if (selects.length > 0) {
      const filteredSelects = selects.filter(s => {
        // match alias at start, allow optional quotes: "alias".col or `alias`.col or alias.col
        const m = String(s).match(/^\s*[`"]?([A-Za-z0-9_]+)[`"]?\./);
        if (!m) return true; // keep expressions without clear alias
        const alias = m[1];
        const tableName = Object.keys(aliasMap).find(k => aliasMap[k] === alias);
        if (!tableName) return true;
        return joinedTables.has(tableName);
      });
      if (filteredSelects.length > 0) {
        // Put explicit field selections at the front of the final select list
        finalSelects.unshift(...filteredSelects);
      }
    }

    // Transform final selects to ensure unique column names by aliasing each selected column
    // into a table_column form (or expr_N for expressions). This prevents duplicate keys
    // when multiple tables have the same column name and ensures the preview rows use only
    // the aliased names.
    const transformedSelects = [];
    const selectColumnNames = [];
    let exprCounter = 0;
    for (const s of finalSelects) {
      const ss = String(s).trim();
      // If it already contains an explicit alias (AS foo), keep it and record the alias
      // Support both PostgreSQL double quotes and MySQL backticks
      const asMatch = ss.match(/\s+AS\s+[`"]?([A-Za-z0-9_]+)[`"]?$/i);
      if (asMatch) {
        transformedSelects.push(ss);
        selectColumnNames.push(asMatch[1]);
        continue;
      }

      // alias.* expansion (turn into individual aliased columns)
      // Support both PostgreSQL double quotes and MySQL backticks
      const starMatch = ss.match(/^\s*[`"]?([A-Za-z0-9_]+)[`"]?\s*\.\s*\*\s*$/);
      if (starMatch) {
        const alias = starMatch[1];
        const tableName = Object.keys(aliasMap).find(k => aliasMap[k] === alias) || alias;
        const cols = (schema && schema[tableName] && Array.isArray(schema[tableName].columns)) ? schema[tableName].columns.map(c => c.name) : [];
        if (cols.length > 0) {
          // If there's a GROUP BY, check if this table's columns are covered
          const groupByFields = (graph.groupBy || []).map(g => String(g));
          const hasGroupBy = groupByFields.length > 0;

          cols.forEach(col => {
            const aliasName = `${tableName}_${col}`;
            if (selectColumnNames.includes(aliasName)) return; // already present; skip

            // If GROUP BY exists, only include columns that are in GROUP BY or skip non-source tables
            if (hasGroupBy) {
              const isInGroupBy = groupByFields.some(g => {
                const parts = g.split('.');
                if (parts.length === 2) {
                  const gTable = parts[0];
                  const gField = parts[1];
                  // Check if table matches (by name or alias)
                  return (gTable === tableName || gTable === alias) && gField === col;
                }
                return g === col;
              });

              // Skip columns not in GROUP BY for non-source tables (to avoid MySQL only_full_group_by error)
              if (!isInGroupBy && tableName !== sourceTable) {
                return; // skip this column
              }
            }

            transformedSelects.push(`${qb.sanitizeIdentifier(alias)}.${qb.sanitizeIdentifier(col)} AS ${qb.sanitizeIdentifier(aliasName)}`);
            selectColumnNames.push(aliasName);
          });
          continue;
        }
      }

      // alias.col -> alias with table_column naming; skip if already present
      // Support both PostgreSQL double quotes and MySQL backticks
      const colMatch = ss.match(/^\s*[`"]?([A-Za-z0-9_]+)[`"]?\s*\.\s*[`"]?([A-Za-z0-9_]+)[`"]?\s*$/);
      if (colMatch) {
        const alias = colMatch[1];
        const col = colMatch[2];
        const tableName = Object.keys(aliasMap).find(k => aliasMap[k] === alias) || alias;
        const aliasName = `${tableName}_${col}`;
        if (selectColumnNames.includes(aliasName)) continue; // skip duplicate
        transformedSelects.push(`${qb.sanitizeIdentifier(alias)}.${qb.sanitizeIdentifier(col)} AS ${qb.sanitizeIdentifier(aliasName)}`);
        selectColumnNames.push(aliasName);
        continue;
      }

      // Generic expression fallback
      exprCounter++;
      let aliasName = `expr_${exprCounter}`;
      while (selectColumnNames.includes(aliasName)) { exprCounter++; aliasName = `expr_${exprCounter}`; }
      transformedSelects.push(`${ss} AS ${qb.sanitizeIdentifier(aliasName)}`);
      selectColumnNames.push(aliasName);
    }

    if (joins.length > 0) {
      // Ensure we have at least something to select, falling back to source.* if empty
      const sel = transformedSelects.length > 0 ? transformedSelects.join(', ') : (finalSelects.length > 0 ? finalSelects.join(', ') : `${getAlias(sourceTable)}.*`);
      sql = `SELECT ${sel} FROM ${qb.sanitizeIdentifier(sourceTable)} ${getAlias(sourceTable)}${joinsSql}`;
    } else {
      // No joins, fallback to selects or default
      if (transformedSelects.length > 0) {
        sql = `SELECT ${transformedSelects.join(', ')} FROM ${qb.sanitizeIdentifier(sourceTable)} ${getAlias(sourceTable)}`;
      } else if (finalSelects.length > 0) {
        sql = `SELECT ${finalSelects.join(', ')} FROM ${qb.sanitizeIdentifier(sourceTable)} ${getAlias(sourceTable)}`;
      } else {
        sql = `SELECT ${getAlias(sourceTable)}.* FROM ${qb.sanitizeIdentifier(sourceTable)} ${getAlias(sourceTable)}`;
      }
    }

    // WHERE clauses (basic)
    const whereClauses = [];
    const params = [];

    // Helper function to process a single filter
    const processFilter = (f) => {
      let table = f.table || f.source || (f.field || '').split('.')[0];
      // If table is an alias, resolve it to actual table name
      const resolvedTable = Object.keys(aliasMap).find(k => aliasMap[k] === table) || table;

      if (!isTableInQuery(resolvedTable)) return; // Skip filters on tables not in query
      const field = f.field && f.field.includes('.') ? f.field.split('.')[1] : f.field;
      const alias = getAlias(resolvedTable || sourceTable);
      const op = (f.op || '=').toLowerCase();
      const sqlOp = {
        'eq': '=',
        'neq': '!=',
        'lt': '<',
        'lte': '<=',
        'gt': '>',
        'gte': '>=',
        'in': 'IN',
        'like': 'LIKE',
        'contains': 'LIKE',
      }[op] || op;
      if (op === 'in') {
        const vals = String(f.value).split(',').map(s => s.trim());
        const placeholders = vals.map(v => qb.addParam(v));
        whereClauses.push(`${qb.sanitizeIdentifier(alias)}.${qb.sanitizeIdentifier(field)} IN (${placeholders.join(', ')})`);
      } else if (op === 'between') {
        const [a, b] = String(f.value).split(',').map(s => s.trim());
        const p1 = qb.addParam(a); const p2 = qb.addParam(b);
        whereClauses.push(`${qb.sanitizeIdentifier(alias)}.${qb.sanitizeIdentifier(field)} BETWEEN ${p1} AND ${p2}`);
      } else if (['contains', 'like'].includes(op)) {
        const p = qb.addParam(`%${f.value}%`);
        whereClauses.push(`${qb.sanitizeIdentifier(alias)}.${qb.sanitizeIdentifier(field)} LIKE ${p}`);
      } else {
        const p = qb.addParam(f.value);
        whereClauses.push(`${qb.sanitizeIdentifier(alias)}.${qb.sanitizeIdentifier(field)} ${sqlOp} ${p}`);
      }
    };

    // Process filters from graph definition
    (graph.filters || []).forEach(processFilter);

    // Process additional filters from request body (runtime filters from "Try It")
    const additionalFilters = req.body && req.body.additionalFilters;
    if (Array.isArray(additionalFilters)) {
      additionalFilters.forEach(processFilter);
    }

    // HAVING (process early to collect HAVING->WHERE conversions)
    const havingAsWhereClauses = [];
    if (graph.having && graph.having.length > 0) {
      for (const hc of graph.having) {
        // Determine aggField (allow fallback to table+field). If aggField is empty but table provided, try to infer the field
        let rawAgg = (hc.aggField && String(hc.aggField).trim()) || null;
        if (!rawAgg && hc.table) {
          // prefer explicit field property
          if (hc.field) rawAgg = `${hc.table}.${hc.field}`;
          else {
            // try to infer from groupBy entries for this table
            const gb = (graph.groupBy || []).find(g => String(g).startsWith(hc.table + '.'));
            if (gb) rawAgg = gb;
          }
        }
        if (!rawAgg) return res.status(400).json({ error: `Invalid HAVING field for table: ${hc.table || ''}`, sql: '' });

        // If there are no aggregations defined, treat HAVING as a WHERE clause (more intuitive)
        if (!aggs || aggs.length === 0) {
          // collect as WHERE clause
          const table = hc.table || (rawAgg.includes('.') ? rawAgg.split('.')[0] : sourceTable);
          if (!isTableInQuery(table)) continue;
          const field = rawAgg.includes('.') ? rawAgg.split('.')[1] : (hc.field || rawAgg);
          const alias = getAlias(table || sourceTable);
          const op = (hc.op || '=').toLowerCase();
          const sqlOp = {
            'eq': '=',
            'neq': '!=',
            'lt': '<',
            'lte': '<=',
            'gt': '>',
            'gte': '>=',
            'in': 'IN',
            'like': 'LIKE',
            'contains': 'LIKE',
          }[op] || op;

          if (op === 'in') {
            const vals = String(hc.value).split(',').map(s => s.trim());
            const placeholders = vals.map(v => qb.addParam(v));
            havingAsWhereClauses.push(`${qb.sanitizeIdentifier(alias)}.${qb.sanitizeIdentifier(field)} IN (${placeholders.join(', ')})`);
          } else if (op === 'between') {
            const [a, b] = String(hc.value).split(',').map(s => s.trim());
            const p1 = qb.addParam(a); const p2 = qb.addParam(b);
            havingAsWhereClauses.push(`${qb.sanitizeIdentifier(alias)}.${qb.sanitizeIdentifier(field)} BETWEEN ${p1} AND ${p2}`);
          } else if (['contains', 'like'].includes(op)) {
            const p = qb.addParam(`%${hc.value}%`);
            havingAsWhereClauses.push(`${qb.sanitizeIdentifier(alias)}.${qb.sanitizeIdentifier(field)} LIKE ${p}`);
          } else {
            const p = qb.addParam(hc.value);
            havingAsWhereClauses.push(`${qb.sanitizeIdentifier(alias)}.${qb.sanitizeIdentifier(field)} ${sqlOp} ${p}`);
          }
          continue;
        }

        // For actual HAVING, we'll handle later
      }
    }

    // Add HAVING->WHERE to whereClauses
    whereClauses.push(...havingAsWhereClauses);

    if (whereClauses.length) sql += ` WHERE ${whereClauses.join(' AND ')}`;

    // Note: If user doesn't provide explicit groupBy, don't auto-add GROUP BY
    // This allows aggregations without grouping to return single aggregate result

    // GROUP BY (filter to only tables in query) - user provided groupBy takes precedence and will be appended
    if (graph.groupBy && graph.groupBy.length > 0) {
      const validGroupBy = graph.groupBy.filter(g => {
        if (String(g).includes('.')) {
          const [tbl, fld] = String(g).split('.');
          // If tbl is an alias, resolve it to actual table name
          const resolvedTbl = Object.keys(aliasMap).find(k => aliasMap[k] === tbl) || tbl;
          return isTableInQuery(resolvedTbl);
        }
        // If no table, assume source
        return true;
      }).map(g => {
        // Also normalize the groupBy to use actual table names instead of aliases
        if (String(g).includes('.')) {
          const [tbl, fld] = String(g).split('.');
          const resolvedTbl = Object.keys(aliasMap).find(k => aliasMap[k] === tbl) || tbl;
          return `${resolvedTbl}.${fld}`;
        }
        return g;
      });

      if (validGroupBy.length > 0) {
        // Ensure all selected non-aggregated columns are in GROUP BY
        for (const sel of finalSelects) {
          if (sel.includes('(')) continue; // skip aggregations
          // extract table.field from "alias"."field" AS "table_field" or `alias`.`field` AS `table_field`
          const match = sel.match(/^\s*[`"]([^`"]+)[`"]\.[`"]([^`"]+)[`"]\s+AS\s+[`"]([^`"]+)[`"]$/);
          if (match) {
            const alias = match[1];
            const field = match[2];
            const table = Object.keys(aliasMap).find(k => aliasMap[k] === alias) || alias;
            const gf = `${table}.${field}`;
            if (!validGroupBy.includes(gf)) {
              validGroupBy.push(gf);
            }
          }
        }
        const gcols = validGroupBy.map(g => {
          const s = String(g);
          const parts = s.split('.');
          if (parts.length === 2) {
            // map table.field -> alias.field and ensure it's selected (aliased) so SQL is valid
            const tbl = parts[0];
            const fld = parts[1];
            const aliasSel = `${qb.sanitizeIdentifier(getAlias(tbl))}.${qb.sanitizeIdentifier(fld)} AS ${qb.sanitizeIdentifier(`${tbl}_${fld}`)}`;
            // add group-by column to selects if not already present
            if (!finalSelects.includes(aliasSel)) {
              finalSelects.unshift(aliasSel);
            }
            return `${qb.sanitizeIdentifier(getAlias(tbl))}.${qb.sanitizeIdentifier(fld)}`;
          }
          // treat as a field on the source table and ensure selected
          const aliasSel = `${qb.sanitizeIdentifier(getAlias(sourceTable))}.${qb.sanitizeIdentifier(s)} AS ${qb.sanitizeIdentifier(`${sourceTable}_${s}`)}`;
          if (!finalSelects.includes(aliasSel)) {
            finalSelects.unshift(aliasSel);
          }
          return `${qb.sanitizeIdentifier(getAlias(sourceTable))}.${qb.sanitizeIdentifier(s)}`;
        });
        sql += ` GROUP BY ${gcols.join(', ')}`;
      }
    }

    // HAVING (for actual aggregations)
    if (graph.having && graph.having.length > 0 && aggs && aggs.length > 0) {
      const hclauses = [];
      for (const hc of graph.having) {
        // Determine aggField (allow fallback to table+field). If aggField is empty but table provided, try to infer the field
        let rawAgg = (hc.aggField && String(hc.aggField).trim()) || null;
        if (!rawAgg && hc.table) {
          // prefer explicit field property
          if (hc.field) rawAgg = `${hc.table}.${hc.field}`;
          else {
            // try to infer from groupBy entries for this table
            const gb = (graph.groupBy || []).find(g => String(g).startsWith(hc.table + '.'));
            if (gb) rawAgg = gb;
          }
        }
        if (!rawAgg) return res.status(400).json({ error: `Invalid HAVING field for table: ${hc.table || ''}`, sql: '' });

        // try to match against aggregation aliases
        const aggMatch = aggs.find(a => (a.as || '').toString() === (rawAgg || '').toString());
        let left;
        try {
          if (aggMatch) {
            // Build the actual aggregate function instead of using the alias
            // PostgreSQL doesn't allow aliases in HAVING, need the real function
            const aggAlias = qb.sanitizeIdentifier(getAlias(aggMatch.table));
            const aggField = qb.sanitizeIdentifier(aggMatch.field);
            left = `${aggMatch.type}(${aggAlias}.${aggField})`;
          } else if (String(rawAgg).includes('.')) {
            const parts = String(rawAgg).split('.');
            if (parts.length === 2) {
              const alias = qb.sanitizeIdentifier(getAlias(parts[0]));
              const col = qb.sanitizeIdentifier(parts[1]);
              left = `${alias}.${col}`;
            } else {
              left = qb.sanitizeIdentifier(rawAgg);
            }
          } else {
            // fallback to a simple identifier (alias name)
            left = qb.sanitizeIdentifier(String(rawAgg));
          }
        } catch (e) {
          // Invalid identifier in HAVING; return a helpful error
          return res.status(400).json({ error: `Invalid HAVING field: ${hc.aggField}`, sql: '' });
        }
        const right = qb.addParam(hc.value);
        hclauses.push(`${left} ${hc.op} ${right}`);
      }
      if (hclauses.length) sql += ` HAVING ${hclauses.join(' AND ')}`;
    }

    // ORDER BY, LIMIT
    sql += ` LIMIT ${qb.addParam(limit)}`;

    // Run query
    try {
      const pool = await connectionManager.getConnection(connectionId);
      let rows;
      if (dialect === 'mysql') {
        const [mysqlRows] = await pool.query(sql, qb.params);
        rows = mysqlRows;
      } else {
        const result = await pool.query(sql, qb.params);
        rows = result.rows ?? result[0] ?? [];
      }
      const columns = rows[0] ? Object.keys(rows[0]) : (typeof selectColumnNames !== 'undefined' && selectColumnNames.length > 0 ? selectColumnNames : selects.map(s => s));
      const friendlySummary = summaryParts.join(' ; ');
      // Return SQL for debugging/preview (safe to show to authorized users in this app)
      return res.json({ columns, rows, sql, params: qb.params, summary: friendlySummary });
    } catch (err) {
      console.error('Preview SQL failed', err, sql);
      return res.status(500).json({ error: 'Preview failed to execute query', details: String(err.message), sql: sql, params: qb.params });
    }
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/endpoints', (req, res) => {
  const connectionId = req.params.id;
  const apiRouter = apiRouters.get(connectionId);
  const schema = schemaCache.get(connectionId);

  if (!apiRouter) {
    return res.status(404).json({ error: `No API found for connection '${connectionId}'. Please introspect the database first.` });
  }

  const routes = [];
  // Express Router keeps layers with 'route' property for endpoints
  const stack = apiRouter.stack || [];
  for (const layer of stack) {
    if (layer.route && layer.route.path) {
      const methods = Object.keys(layer.route.methods || {}).map(m => m.toUpperCase());
      routes.push({ path: layer.route.path, methods });
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      // nested router
      for (const nested of layer.handle.stack) {
        if (nested.route && nested.route.path) {
          const methods = Object.keys(nested.route.methods || {}).map(m => m.toUpperCase());
          routes.push({ path: nested.route.path, methods });
        }
      }
    }
  }

  // dedupe and sort
  const unique = Array.from(new Map(routes.map(r => [r.path + '|' + r.methods.join(','), r])).values()).sort((a, b) => a.path.localeCompare(b.path));

  res.json({ connectionId, tables: Object.keys(schema || {}), endpoints: unique });
});

module.exports = { router, apiRouters, schemaCache, apiGenerators };
