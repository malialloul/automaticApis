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
// Store data for local databases: { connectionId: { tableName: [rows] } }
const dataStore = new Map();

// Helper: determine if a connection id refers to a local (Schema Builder) database
function isLocalConnectionId(id) {
  return typeof id === 'string' && (id.startsWith('db_') || id.startsWith('local_'));
}

// Helper to choose sensible default port per DB type
function getDefaultPort(type) {
  const t = (type || 'postgres').toLowerCase();
  if (t === 'postgres') return 5432;
  if (t === 'mysql') return 3306;

  return 5432;
}

/**
 * POST /api/connections/test
 * Test database connection
 */
router.post('/test', async (req, res) => {
  try {
    const { host, port, database, user, password, type, uri, encrypt } = req.body;


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
      uri,
      encrypt,
    });

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

    // For local databases, introspect is a no-op (schema is managed via POST /api/connections/:id/schema)
    if (type === 'local' || isLocalConnectionId(connectionId)) {
      console.log(`Introspect called for local database: ${connectionId}`);
      const schema = schemaCache.get(connectionId);
      if (!schema) {
        console.log(`No schema found in cache for local database ${connectionId}. Available connections:`, Array.from(schemaCache.keys()));
        return res.status(400).json({
          error: 'No schema defined for this local database. Use Schema Builder to define tables.'
        });
      }

      const tableCount = Object.keys(schema).length;
      let relationshipCount = 0;
      for (const table of Object.values(schema)) {
        relationshipCount += (table.foreignKeys?.length || 0) + (table.reverseForeignKeys?.length || 0);
      }

      console.log(`Introspect returned for local database ${connectionId}:`, { tableCount, relationshipCount });
      return res.json({
        success: true,
        message: 'Local database schema retrieved',
        connectionId,
        stats: {
          tables: tableCount,
          relationships: relationshipCount,
          endpoints: tableCount * 5 + relationshipCount,
        },
      });
    }

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
    const apiGenerator = new APIGenerator(connectionId, pool, schema, info?.type || 'postgres', dataStore);
    const apiRouter = apiGenerator.generateRoutes();
    apiRouters.set(connectionId, apiRouter);
    apiGenerators.set(connectionId, apiGenerator);

    // Persist generated cross-table endpoints into the simple endpoints store so UI can show them
    try {
      const endpointsModule = require('./endpoints');
      const generated = [];
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
 * POST /api/connections/:id/schema
 * Save/store a schema for a connection (used for local databases from Schema Builder)
 */
router.post('/:id/schema', (req, res) => {
  try {
    const connectionId = req.params.id;
    const { schema, tables } = req.body;

    console.log(`POST /connections/${connectionId}/schema - Incoming request`, {
      schemaType: typeof schema,
      schemaKeys: schema ? Object.keys(schema).length : 'null',
      tablesType: typeof tables,
      tablesLength: Array.isArray(tables) ? tables.length : 'not an array'
    });

    // DEBUG: Log the actual schema object structure
    console.log('[DEBUG POST /schema RAW REQUEST] req.body:', {
      hasSchema: !!schema,
      schemaPropNames: schema ? Object.keys(schema).slice(0, 3) : null,
    });

    if (schema && typeof schema === 'object') {
      const firstTableName = Object.keys(schema)[0];
      if (firstTableName) {
        console.log(`[DEBUG POST /schema RAW] First table "${firstTableName}":`, schema[firstTableName]);
      }
    }

    // DEBUG: Log first table's primaryKeys from incoming schema
    if (schema && typeof schema === 'object') {
      const firstTable = Object.entries(schema)[0];
      if (firstTable) {
        console.log(`[DEBUG POST /schema] First table: ${firstTable[0]}`, {
          hasPrimaryKeys: 'primaryKeys' in firstTable[1],
          primaryKeysValue: firstTable[1].primaryKeys,
          hasPrimaryKey: 'primaryKey' in firstTable[1],
          primaryKeyValue: firstTable[1].primaryKey,
        });
      }
    }

    // Accept either 'schema' object or 'tables' array
    // If 'tables' is provided (SchemaBuilder format), convert to keyed object
    let dataToStore = schema;
    if (!dataToStore && Array.isArray(tables)) {
      dataToStore = {};
      for (const t of tables) {
        if (!t || !t.name) continue;
        const primaryKeys = (t.primaryKeys || t.primaryKey || []).map(pk =>
          typeof pk === 'string' ? pk.trim() : pk
        ).filter(Boolean);
        dataToStore[t.name] = {
          name: t.name,
          columns: t.columns || [],
          primaryKeys: primaryKeys,
          foreignKeys: (t.foreignKeys || []).map((fk) => ({
            columnName: fk.columnName || fk.column,
            foreignTable: fk.foreignTable || fk.refTable,
            foreignColumn: fk.foreignColumn || fk.refColumn,
            onDelete: fk.onDelete,
            onUpdate: fk.onUpdate,
          })),
          indexes: t.indexes || [],
        };
      }
    }

    if (!dataToStore) {
      return res.status(400).json({ error: 'Missing schema or tables in request body' });
    }

    // Normalize schema: ensure each table has foreignKeys and reverseForeignKeys arrays
    const sanitizeName = (n) => {
      if (!n || typeof n !== 'string') return n;
      // Trim whitespace and strip surrounding quotes/backticks/brackets
      let s = n.trim();
      s = s.replace(/^"(.+)"$/, '$1');
      s = s.replace(/^'(.*)'$/, '$1');
      s = s.replace(/^`(.*)`$/, '$1');
      s = s.replace(/^\[(.*)\]$/, '$1');
      return s;
    };

    const normalizedSchema = {};
    for (const [rawTableName, rawTableData] of Object.entries(dataToStore)) {
      const tableName = sanitizeName(rawTableName);
      const tableData = rawTableData || {};

      // Normalize foreign keys: convert variants and sanitize referenced names
      const normalizedFks = (tableData.foreignKeys || []).map((fk) => ({
        columnName: sanitizeName(fk.columnName || fk.column || fk.column_name),
        foreignTable: sanitizeName(fk.foreignTable || fk.refTable || fk.foreign_table),
        foreignColumn: sanitizeName(fk.foreignColumn || fk.refColumn || fk.foreign_column),
        onDelete: fk.onDelete || undefined,
        onUpdate: fk.onUpdate || undefined,
      })).filter((fk) => fk.columnName && fk.foreignTable && fk.foreignColumn);

      // Normalize primary keys: handle multiple field name variants and sanitize
      let primaryKeys = tableData.primaryKeys || tableData.primaryKey || [];
      if (Array.isArray(primaryKeys)) {
        primaryKeys = primaryKeys.map(pk => sanitizeName(pk)).filter(Boolean);
      } else {
        primaryKeys = [];
      }

      // FALLBACK: If primaryKeys array is empty but columns have isPrimaryKey flag, extract from there
      if (primaryKeys.length === 0 && Array.isArray(tableData.columns)) {
        const colsWithPK = tableData.columns.filter(col => col.isPrimaryKey);
        if (colsWithPK.length > 0) {
          console.log(`[DEBUG POST /schema] Extracting primaryKeys from column.isPrimaryKey for table ${tableName}:`, colsWithPK.map(c => c.name));
          primaryKeys = colsWithPK.map(col => sanitizeName(col.name)).filter(Boolean);
        }
      }

      // Normalize columns and sanitize names
      const normalizedColumns = (tableData.columns || []).map(col => ({
        ...col,
        name: sanitizeName(col.name),
      }));

      normalizedSchema[tableName] = {
        name: tableData.name || tableName,
        columns: normalizedColumns,
        primaryKeys: primaryKeys,
        foreignKeys: normalizedFks,
        reverseForeignKeys: [],
        indexes: tableData.indexes || [],
      };
    }

    // Compute reverse foreign keys from normalized FKs
    for (const [tableName, tableInfo] of Object.entries(normalizedSchema)) {
      const fks = tableInfo.foreignKeys || [];
      for (const fk of fks) {
        const targetTable = normalizedSchema[fk.foreignTable];
        if (targetTable) {
          targetTable.reverseForeignKeys = targetTable.reverseForeignKeys || [];
          targetTable.reverseForeignKeys.push({
            referencingTable: tableName,
            referencingColumn: fk.columnName,
            referencedColumn: fk.foreignColumn,
          });
        }
      }
    }

    // Store schema in cache
    schemaCache.set(connectionId, normalizedSchema);

    // DEBUG: Log what was stored
    const firstNormTable = Object.entries(normalizedSchema)[0];
    if (firstNormTable) {
      console.log(`[DEBUG POST /schema NORMALIZED] First table: ${firstNormTable[0]}`, {
        primaryKeys: firstNormTable[1].primaryKeys,
      });
    }

    console.log(`Schema cached for ${connectionId}`, { cachedKeys: Object.keys(normalizedSchema).length });

    // Create an APIGenerator for this local database so it has __generated_endpoints
    // Local databases are identified by IDs starting with 'db_' or 'local_'
    if (isLocalConnectionId(connectionId)) {
      try {
        console.log(`[SCHEMA] Creating APIGenerator for local database ${connectionId}`);
        console.log(`[SCHEMA] dataStore has ${connectionId}:`, dataStore.has(connectionId), dataStore.get(connectionId) ? Object.keys(dataStore.get(connectionId)) : 'none');
        const apiGenerator = new APIGenerator(connectionId, null, normalizedSchema, 'local', dataStore);
        const apiRouter = apiGenerator.generateRoutes();
        apiGenerators.set(connectionId, apiGenerator);
        // Register the router so it's accessible via /api/:connectionId paths
        apiRouters.set(connectionId, apiRouter);
        console.log(`[SCHEMA] APIGenerator and router registered for ${connectionId}. Tables:`, Object.keys(normalizedSchema));
      } catch (err) {
        console.warn('Failed to generate API routes for local database:', err);
        // Don't fail the request, just warn
      }
    }

    res.json({
      success: true,
      message: 'Schema stored successfully',
      connectionId
    });
  } catch (error) {
    console.error('Failed to store schema:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/connections/:id/schema
 * Delete a stored schema (for cleaning up local databases)
 */
router.delete('/:id/schema', (req, res) => {
  try {
    const connectionId = req.params.id;

    if (schemaCache.has(connectionId)) {
      schemaCache.delete(connectionId);

      // Also clean up APIGenerator and router for local databases
      if (isLocalConnectionId(connectionId)) {
        apiGenerators.delete(connectionId);
        apiRouters.delete(connectionId);
      }

      res.json({
        success: true,
        message: 'Schema deleted successfully',
        connectionId
      });
    } else {
      res.status(404).json({ error: 'Schema not found' });
    }
  } catch (error) {
    console.error('Failed to delete schema:', error);
    res.status(500).json({ error: error.message });
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
 * POST /api/connections/:id/import-sql
 * Parse a full SQL script (CREATE TABLE, INSERT) and populate local schema/data
 * Only supported for local (Schema Builder) connections: ids starting with db_ or local_
 */
router.post('/:id/import-sql', async (req, res) => {
  try {
    const connectionId = req.params.id;
    const { sql, dialect = 'PostgreSQL' } = req.body || {};
    if (!isLocalConnectionId(connectionId)) {
      return res.status(400).json({ error: 'SQL import is only supported for local databases' });
    }
    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ error: 'Missing SQL script in request body' });
    }

    let Parser;
    try {
      ({ Parser } = require('node-sql-parser'));
    } catch (e) {
      return res.status(500).json({ error: 'node-sql-parser not installed on server' });
    }
    const parser = new Parser();

    // Normalize dialect to values accepted by node-sql-parser
    const normalizeDialect = (d) => {
      const s = String(d || '').toLowerCase();
      if (s === 'postgres' || s === 'postgresql') return 'postgresql';
      if (s === 'mysql') return 'mysql';
      if (s === 'sqlite') return 'sqlite';
      return 'postgresql';
    };
    const dbOpt = normalizeDialect(dialect);

    // Helpers to strip comments and split into individual statements safely
    const stripComments = (s) => s
      .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
      .replace(/--.*$/gm, ''); // line comments

    const splitStatements = (s) => {
      const stmts = [];
      let cur = '';
      let inStr = false;
      let strCh = '';
      let depth = 0;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        const next2 = s.slice(i, i + 2);
        // Enter/exit string
        if (!inStr && (ch === '"' || ch === "'")) { inStr = true; strCh = ch; cur += ch; continue; }
        if (inStr) { cur += ch; if (ch === strCh) { inStr = false; } continue; }
        // Track parentheses depth
        if (ch === '(') { depth++; cur += ch; continue; }
        if (ch === ')') { depth--; cur += ch; continue; }
        // Statement boundary on semicolon at depth 0
        if (ch === ';' && depth === 0) { if (cur.trim()) stmts.push(cur.trim()); cur = ''; continue; }
        cur += ch;
      }
      if (cur.trim()) stmts.push(cur.trim());
      return stmts;
    };

    // Normalize newlines and trim; split into statements
    const normalizedSql = String(sql).replace(/\r\n/g, '\n').trim();
    const rawStatements = splitStatements(normalizedSql);
    let ast = [];
    const parseErrors = [];
    if (rawStatements.length === 0) {
      // Retry after stripping comments
      const cleaned = splitStatements(stripComments(normalizedSql));
      rawStatements.push(...cleaned);
    }
    // Parse each statement individually; tolerate failures
    rawStatements.forEach(stmtText => {
      try {
        const out = parser.astify(stmtText, { database: dbOpt });
        if (Array.isArray(out)) ast.push(...out); else ast.push(out);
      } catch (e) {
        // Fallback: try alternate dialect if parse fails
        const alt = dbOpt === 'postgresql' ? 'mysql' : 'postgresql';
        try {
          const outAlt = parser.astify(stmtText, { database: alt });
          if (Array.isArray(outAlt)) ast.push(...outAlt); else ast.push(outAlt);
        } catch (e2) {
          parseErrors.push({ statement: stmtText.slice(0, 100), error: e.message });
        }
      }
    });
    if (ast.length === 0 && parseErrors.length > 0) {
      return res.status(400).json({ error: `Failed to parse SQL: ${parseErrors[0].error}` });
    }

    // Start from existing schema if present
    const existing = schemaCache.get(connectionId) || {};
    const newSchema = { ...existing };
    const insertedCounts = {};
    const updatedCounts = {};

    // Helper: ensure dataStore initialized for this connection and table
    const ensureTableRows = (tableName) => {
      if (!dataStore.has(connectionId)) dataStore.set(connectionId, {});
      const connData = dataStore.get(connectionId);
      if (!connData[tableName]) connData[tableName] = [];
      return connData[tableName];
    };

    // Helper: normalize CREATE TABLE to app schema format
    const upsertTableSchema = (stmt) => {
      const tableName = stmt.table?.[0]?.table;
      if (!tableName) return;

      const columns = [];
      const primaryKeys = [];
      const foreignKeys = [];

      const safeValue = (v) => {
        if (v === null || v === undefined) return null;
        if (typeof v === 'string' || typeof v === 'number') return v;
        return JSON.stringify(v);
      };

      const normalizeDefault = (dv) => {
        if (!dv) return null;
        if (typeof dv === 'string' || typeof dv === 'number') return dv;
        if (dv.type === 'function') return dv.name;
        if (dv.type === 'number') return dv.value;
        if (dv.type === 'string') return dv.value;
        return JSON.stringify(dv);
      };

      (stmt.create_definitions || []).forEach(def => {

        /* ---------- COLUMNS ---------- */
        if (def.resource === 'column') {
          const name = def.column?.column;
          const dt = def.definition?.dataType || '';
          const nullable = def.nullable?.type !== 'not null';
          const unique = def.unique === 'unique';

          if (def.primary_key === 'primary key') {
            if (!primaryKeys.includes(name)) primaryKeys.push(name);
          }

          const isAuto =
            /\bserial\b|\bbigserial\b/i.test(String(dt)) ||
            /nextval\(/i.test(String(def.definition?.default_val || ''));

          const defVal = normalizeDefault(def.default_val?.value);

          columns.push({
            name: safeValue(name),
            type: safeValue(String(dt).toLowerCase()),
            nullable,
            unique,
            default: safeValue(defVal),
            isAutoIncrement: isAuto,
            isPrimaryKey: def.primary_key === 'primary key'
          });
        }

        /* ---------- FOREIGN KEYS ---------- */
        if (def.resource === 'constraint' && def.constraint_type === 'FOREIGN KEY') {
          const fkCols = def.definition || [];
          const refDef = def.reference_definition;

          const refTable = refDef?.table?.[0]?.table;
          const refCols = refDef?.definition || [];

          fkCols.forEach((col, i) => {
            foreignKeys.push({
              columnName: safeValue(col.column),
              foreignTable: safeValue(refTable),
              foreignColumn: safeValue(refCols[i]?.column || refCols[0]?.column || 'id'),
            });
          });
        }
      });
      //
      newSchema[tableName] = {
        columns,
        primaryKeys,
        foreignKeys,
        indexes: newSchema[tableName]?.indexes || []
      };
    };




    // Helper: DROP TABLE handler (clear schema and data)
    const handleDropTable = (stmt) => {
      const tableName = stmt.table?.[0]?.table;
      if (!tableName) return;
      delete newSchema[tableName];
      if (dataStore.has(connectionId)) {
        const connData = dataStore.get(connectionId);
        delete connData[tableName];
      }
    };

    // Helper: CREATE INDEX handler
    const handleCreateIndex = (stmt) => {
      const tableName = stmt.table?.[0]?.table;
      const index = stmt.index || stmt.definition || null;
      if (!tableName || !newSchema[tableName]) return;
      const cols = (index?.columns || stmt.columns || []).map(c => c.column || c?.expr?.column).filter(Boolean);
      const idxName = index?.name || stmt.index_name || stmt.name || `${tableName}_${(cols.join('_') || 'idx')}`;
      const unique = !!(stmt.unique || index?.unique);
      const idxObj = { name: idxName, columns: cols, unique };
      const arr = newSchema[tableName].indexes || [];
      arr.push(idxObj);
      newSchema[tableName].indexes = arr;
    };

    // First pass: handle drops and build/merge schema from CREATE TABLE statements and indexes
    ast.forEach(stmt => {
      if (stmt.type === 'drop') handleDropTable(stmt);
      else if (stmt.type === 'create') {
        // Distinguish table vs index/function/procedure
        const kw = (stmt.keyword || '').toLowerCase();
        if (kw === 'table' || !kw) {
          upsertTableSchema(stmt);
        } else if (kw === 'index' || stmt.resource === 'index') {
          handleCreateIndex(stmt);
        } else {
          // function/procedure/event: ignore for local import
        }
      }
    });

    // Cache schema and ensure routes
    schemaCache.set(connectionId, newSchema);
    try {
      const apiGenerator = new APIGenerator(connectionId, null, newSchema, 'local', dataStore);
      const apiRouter = apiGenerator.generateRoutes();
      apiGenerators.set(connectionId, apiGenerator);
      apiRouters.set(connectionId, apiRouter);
      console.log(`[IMPORT-SQL] Registered API router for ${connectionId}. Tables:`, Object.keys(newSchema));
    } catch (e) {
      // If route generation fails, still try to insert data
      console.warn('Route generation failed during import-sql:', e?.message || e);
    }

    // Helper: value coercion
    const getNodeValue = (v) => {
      if (!v) return null;
      if (v.value !== undefined) return v.value;
      if (v.raw !== undefined) {
        const raw = v.raw;
        if (/^NULL$/i.test(raw)) return null;
        if (/^(TRUE|FALSE)$/i.test(raw)) return /^TRUE$/i.test(raw);
        if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
        return String(raw).replace(/^'|"|`|\(|\)$/g, '').trim();
      }
      return null;
    };

    // Helper: where evaluator for simple binary expressions
    const evalWhere = (row, node) => {
      if (!node) return true;
      if (node.type === 'binary_expr') {
        const op = (node.operator || '').toUpperCase();
        if (op === 'AND' || op === 'OR') {
          const left = evalWhere(row, node.left);
          const right = evalWhere(row, node.right);
          return op === 'AND' ? (left && right) : (left || right);
        }
        // Left should be column ref
        const col = node.left?.column || node.left?.expr?.column || node.left?.value || node.left?.raw;
        const val = getNodeValue(node.right);
        const rowVal = row[String(col)];
        switch (op) {
          case '=': return String(rowVal) === String(val);
          case '!=':
          case '<>': return String(rowVal) !== String(val);
          case '>': return Number(rowVal) > Number(val);
          case '>=': return Number(rowVal) >= Number(val);
          case '<': return Number(rowVal) < Number(val);
          case '<=': return Number(rowVal) <= Number(val);
          case 'LIKE': return String(rowVal).includes(String(val).replace(/%/g, ''));
          default: return false;
        }
      }
      return true;
    };

    // Second pass: execute INSERT/UPDATE statements into dataStore
    ast.forEach(stmt => {
      if (stmt.type !== 'insert') return;
      const tableName = stmt.table?.[0]?.table;
      if (!tableName) return;
      const tableSchema = newSchema[tableName] || { columns: [], primaryKeys: [] };
      const rowsArr = ensureTableRows(tableName);

      // Robust column extraction: handle different AST shapes
      let cols = (stmt.columns || []).map(c => {
        if (typeof c === 'string') return c;
        return c?.column || c?.expr?.column || c?.name;
      }).filter(Boolean);

      (stmt.values || []).forEach(row => {
        const values = row?.value || [];
        const obj = {};

        if (!cols || cols.length === 0) {
          // No explicit columns list: map in order of table columns
          const allCols = (tableSchema.columns || []).map(c => c.name);
          for (let idx = 0; idx < values.length; idx++) {
            const v = values[idx];
            const colName = allCols[idx];
            if (!colName) continue;
            obj[colName] = v && v.value !== undefined ? v.value : (v?.raw ?? null);
          }
        } else {
          // Use explicit columns list; if a column name is missing, try fallback to schema order
          const allCols = (tableSchema.columns || []).map(c => c.name);
          for (let idx = 0; idx < values.length; idx++) {
            const v = values[idx];
            const explicitName = cols[idx];
            const colName = explicitName || allCols[idx] || null;
            if (!colName) continue;
            obj[colName] = v && v.value !== undefined ? v.value : (v?.raw ?? null);
          }
        }

        // Auto-increment PK if needed
        if ((tableSchema.primaryKeys || []).length === 1) {
          const pk = tableSchema.primaryKeys[0];
          if (obj[pk] === undefined || obj[pk] === null) {
            const maxId = Math.max(...rowsArr.map(r => parseInt(r[pk]) || 0), 0);
            obj[pk] = maxId + 1;
          }
        }

        rowsArr.push(obj);
        insertedCounts[tableName] = (insertedCounts[tableName] || 0) + 1;
      });
    });

    // Apply UPDATE statements
    ast.forEach(stmt => {
      if (stmt.type !== 'update') return;
      const tableName = stmt.table?.[0]?.table;
      if (!tableName) return;
      const rowsArr = ensureTableRows(tableName);
      const sets = (stmt.set || []).map(s => ({
        col: s.column?.column || s.column?.expr?.column || s.column?.name,
        val: getNodeValue(s.value)
      })).filter(s => s.col);
      let updated = 0;
      for (let i = 0; i < rowsArr.length; i++) {
        if (evalWhere(rowsArr[i], stmt.where)) {
          sets.forEach(s => { rowsArr[i][s.col] = s.val; });
          updated++;
        }
      }
      if (updated) updatedCounts[tableName] = (updatedCounts[tableName] || 0) + updated;
    });

    const totalTables = Object.keys(newSchema).length;
    const totalRows = Object.values(insertedCounts).reduce((a, b) => a + b, 0);
    const totalUpdated = Object.values(updatedCounts).reduce((a, b) => a + b, 0);
    // Diagnostics: log dataStore summary for this connection
    try {
      const connData = dataStore.get(connectionId) || {};
      const summary = Object.fromEntries(Object.entries(connData).map(([t, rows]) => [t, rows.length]));
      console.log(`[IMPORT-SQL] Summary for ${connectionId}: tables=${totalTables}, insertedRows=${totalRows}, updatedRows=${totalUpdated}, dataStoreCounts=`, summary);
    } catch { }
    return res.json({ success: true, connectionId, schema: newSchema, tables: totalTables, inserted: insertedCounts, totalRows, updated: updatedCounts, totalUpdated, parseErrors });
  } catch (error) {
    console.error('Failed to import SQL:', error);
    return res.status(500).json({ error: error.message });
  }
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

    // Handle local databases (db_* or local_*) - execute in-memory via APIGenerator
    if (isLocalConnectionId(connectionId)) {
      const apiGenerator = apiGenerators.get(connectionId);
      if (!apiGenerator) {
        return res.status(404).json({ error: 'API Generator not found for local database' });
      }

      try {
        const result = await apiGenerator.executeWrite(operation.toUpperCase(), graph, data, { previewOnly, additionalFilters });
        return res.json(result);
      } catch (err) {
        console.error('Local DB execute error:', err);
        return res.status(500).json({ error: err.message });
      }
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
        const insertParams = [...tableQb.getParams()];

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
          const paramOffset = tableQb.getParams().length;
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
              const [rows] = await pool.query(sql, [...tableQb.getParams(), ...qb.getParams()]);
              results.push({ table, affectedRows: rows.affectedRows });
            } else {
              try {
                // Postgres numbered params: combine SET params then WHERE params (renumbered above)
                const pgResult = await pool.query(sql, [...tableQb.getParams(), ...qb.getParams()]);
                results.push({ table, affectedRows: pgResult.rowCount });
              } catch (e) {
                return res.status(400).json({ error: e.message, sql, params: [...tableQb.getParams(), ...qb.getParams()] });
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

    const params = qb.getParams();

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
      // For local databases, use in-memory graph execution
      if (connectionId.startsWith('db_')) {
        const apiGenerator = apiGenerators.get(connectionId);
        if (!apiGenerator) {
          return res.status(404).json({ error: 'API Generator not found for local database' });
        }

        const result = await apiGenerator.executeGraph(graph, { limit, offset: 0 });
        const columns = result.columns;
        const rows = result.rows;
        const friendlySummary = summaryParts.join(' ; ');
        return res.json({ columns, rows, sql: '(in-memory execution)', params: [], summary: friendlySummary });
      }

      // For SQL databases, execute the built SQL query
      const pool = await connectionManager.getConnection(connectionId);
      let rows;
      if (dialect === 'mysql') {
        const [mysqlRows] = await pool.query(sql, qb.getParams());
        rows = mysqlRows;
      } else {
        const result = await pool.query(sql, qb.getParams());
        rows = result.rows ?? result[0] ?? [];
      }
      const columns = rows[0] ? Object.keys(rows[0]) : (typeof selectColumnNames !== 'undefined' && selectColumnNames.length > 0 ? selectColumnNames : selects.map(s => s));
      const friendlySummary = summaryParts.join(' ; ');
      // Return SQL for debugging/preview (safe to show to authorized users in this app)
      return res.json({ columns, rows, sql, params: qb.getParams(), summary: friendlySummary });
    } catch (err) {
      console.error('Preview SQL failed', err, sql);
      return res.status(500).json({ error: 'Preview failed to execute query', details: String(err.message), sql: sql, params: qb.getParams() });
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

module.exports = { router, apiRouters, schemaCache, apiGenerators, dataStore };
