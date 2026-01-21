import express, { Request, Response, Router } from 'express';
import connectionManager, { ConnectionConfig } from '../utils/connectionManager';
import { Pool, PoolConfig } from 'pg';
import mysql, { RowDataPacket } from 'mysql2/promise';

const router: Router = express.Router();

// POST /api/schema-builder/create-database
interface CreateDatabaseBody { host?: string; port?: number; user?: string; password?: string; database?: string; sql?: string; createDatabase?: boolean; uri?: string }
router.post('/create-database', async (req: Request, res: Response<{ success: boolean; message: string; connectionId?: string; connection?: Partial<import('../types').ConnectionRow> } | { error: string }>) => {
  try {
    const body = req.body as CreateDatabaseBody | undefined;
    const { host, port, user, password, database, sql, createDatabase = true, uri } = body || {};
    const databaseName = database;
    if (!databaseName) return res.status(400).json({ error: 'Database name is required' });

    let poolConfig: PoolConfig | { connectionString: string; ssl?: false | { rejectUnauthorized: boolean } };
    if (uri) {
      const url = new URL(uri);
      url.pathname = '/postgres';
      poolConfig = {
        connectionString: url.toString(),
        ssl: uri.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
      };
    } else {
      if (!host || !user) return res.status(400).json({ error: 'Host and user are required' });
      poolConfig = { host, port: port || 5432, database: 'postgres', user, password: password || '' };
    }

    const safeName = databaseName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    const pool = new Pool(poolConfig);

    try {
      const checkResult = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [safeName]);
      const dbExists = checkResult.rows.length > 0;
      if (!dbExists && createDatabase) {
        await pool.query(`CREATE DATABASE "${safeName}"`);
      } else if (!dbExists && !createDatabase) {
        await pool.end();
        return res.status(400).json({ error: `Database '${safeName}' does not exist. Enable 'Create database if it doesn't exist' option.` });
      }
      await pool.end();

      const dbPoolConfig = uri ? { connectionString: uri.replace(/\/[^/?]+(\?|$)/, `/${safeName}$1`), ssl: uri.includes('sslmode=require') ? { rejectUnauthorized: false } : false } : { host, port: port || 5432, database: safeName, user, password: password || '' };
      const dbPool = new Pool(dbPoolConfig);
      if (sql && sql.trim()) {
        try {
          await dbPool.query(sql);
        } catch (sqlError) {
          await dbPool.end();
          const msg = sqlError instanceof Error ? sqlError.message : String(sqlError);
          return res.status(400).json({ success: false, error: `SQL execution failed: ${msg}` });
        }
      }
      await dbPool.end();

      const connectionId = `schemabuilder_${safeName}_${Date.now()}`;
      const connectionConfig: ConnectionConfig = {
        host: host || (uri ? new URL(uri).hostname : 'localhost'),
        port: port || (uri ? Number(new URL(uri).port) || 5432 : 5432),
        database: safeName,
        user: user || (uri ? new URL(uri).username : ''),
        password: password || (uri ? decodeURIComponent(new URL(uri).password || '') : ''),
        type: 'postgres',
      };

      await connectionManager.getConnection(connectionId, connectionConfig);

      // Introspect schema after creation
      const pool = await connectionManager.getExistingConnection(connectionId);
      let schema = null;
      if (pool) {
        const info = connectionManager.getInfo(connectionId);
        const inspector = new (require('../middleware/schemaInspector').default)(pool, info?.type || 'postgres', safeName);
        schema = await inspector.introspect();
      }
      res.json({ success: true, connectionId, connection: { id: connectionId, ...connectionConfig }, schema });
    } catch (err) {
      try { await pool.end(); } catch {}
      throw err;
    }
  } catch (error) {
    console.error('Failed to create database:', error);
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
});

// GET /api/schema-builder/:connectionId/tables
router.get('/:connectionId/tables', async (req: Request, res: Response<{ tables: Array<{ name: string; schema: string }> } | { error: string }>) => {
  try {
    const connectionIdRaw = req.params.connectionId;
    const connectionId = Array.isArray(connectionIdRaw) ? connectionIdRaw[0] : connectionIdRaw;
    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) return res.status(404).json({ error: 'Connection not found' });

    const info = connectionManager.getInfo(connectionId);
    const dbType = info?.type || 'postgres';
    let tables: Array<{ name: string; schema: string }> = [];
    if (dbType === 'postgres') {
      const result = await connectionManager.queryPool<{ table_name: string; table_schema: string }>(pool, info, `SELECT table_name, table_schema FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') AND table_type = 'BASE TABLE' ORDER BY table_schema, table_name`);
      tables = result.rows.map(r => ({ name: r.table_name, schema: r.table_schema }));
    } else if (dbType === 'mysql') {
      const result = await connectionManager.queryPool<RowDataPacket & { table_name?: string; table_schema?: string }>(pool, info, `SELECT TABLE_NAME as table_name, TABLE_SCHEMA as table_schema FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`);
      tables = result.rows.map(r => ({ name: (r as RowDataPacket).TABLE_NAME || r.table_name, schema: (r as RowDataPacket).TABLE_SCHEMA || r.table_schema }));
    }
    res.json({ tables });
  } catch (error) {
    console.error('Failed to list tables:', error);
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

// GET /api/schema-builder/:connectionId/tables/:tableName
type ColumnInfo = { name: string; type: string; maxLength?: number | null; precision?: number | null; scale?: number | null; nullable?: boolean; default?: string | null; position?: number };
type ConstraintInfo = { name: string; type: string; columns: string[]; foreignTable?: string; foreignSchema?: string; foreignColumns: string[]; onUpdate?: string; onDelete?: string };
type IndexInfo = { name: string; columns: string[]; unique?: boolean; primary?: boolean };

router.get('/:connectionId/tables/:tableName', async (req: Request, res: Response<{ tableName: string; schema: string; columns: ColumnInfo[]; constraints: ConstraintInfo[]; indexes: IndexInfo[] } | { error: string }>) => {
  try {
    const connectionIdRaw = req.params.connectionId;
    const connectionId = Array.isArray(connectionIdRaw) ? connectionIdRaw[0] : connectionIdRaw;
    const tableName = Array.isArray(req.params.tableName) ? req.params.tableName[0] : req.params.tableName;
    const queryObj = req.query as Record<string, string | undefined>;
    const schema = queryObj.schema || 'public';
    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) return res.status(404).json({ error: 'Connection not found' });

    const info = connectionManager.getInfo(connectionId);
    const dbType = info?.type || 'postgres';

    type ColumnInfo = { name: string; type: string; maxLength?: number | null; precision?: number | null; scale?: number | null; nullable?: boolean; default?: string | null; position?: number };
    type ConstraintInfo = { name: string; type: string; columns: string[]; foreignTable?: string; foreignSchema?: string; foreignColumns: string[]; onUpdate?: string; onDelete?: string };
    type IndexInfo = { name: string; columns: string[]; unique?: boolean; primary?: boolean };

    let columns: ColumnInfo[] = [];
    let constraints: ConstraintInfo[] = [];
    let indexes: IndexInfo[] = [];

    if (dbType === 'postgres') {
      const colResult = await connectionManager.queryPool<{ column_name: string; data_type: string; udt_name?: string; character_maximum_length?: number | null; numeric_precision?: number | null; numeric_scale?: number | null; is_nullable?: string; column_default?: string | null; ordinal_position?: number }>(pool, info, `SELECT c.column_name, c.data_type, c.udt_name, c.character_maximum_length, c.numeric_precision, c.numeric_scale, c.is_nullable, c.column_default, c.ordinal_position FROM information_schema.columns c WHERE c.table_schema = $1 AND c.table_name = $2 ORDER BY c.ordinal_position`, [schema, tableName]);
      columns = colResult.rows.map(r => ({ name: r.column_name, type: r.udt_name || r.data_type, maxLength: r.character_maximum_length, precision: r.numeric_precision, scale: r.numeric_scale, nullable: r.is_nullable === 'YES', default: r.column_default, position: r.ordinal_position }));

      const constraintResult = await connectionManager.queryPool<{ constraint_name: string; constraint_type: string; column_name?: string; foreign_table_schema?: string; foreign_table_name?: string; foreign_column_name?: string; update_rule?: string; delete_rule?: string }>(pool, info, `SELECT tc.constraint_name, tc.constraint_type, kcu.column_name, ccu.table_schema AS foreign_table_schema, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name, rc.update_rule, rc.delete_rule FROM information_schema.table_constraints tc LEFT JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema LEFT JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.constraint_schema LEFT JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema WHERE tc.table_schema = $1 AND tc.table_name = $2 ORDER BY tc.constraint_name`, [schema, tableName]);      const constraintMap = new Map<string, ConstraintInfo>();
      for (const row of constraintResult.rows) {
        const key = row.constraint_name;
        if (!constraintMap.has(key)) {
          constraintMap.set(key, { name: row.constraint_name, type: row.constraint_type, columns: [], foreignTable: row.foreign_table_name, foreignSchema: row.foreign_table_schema, foreignColumns: [], onUpdate: row.update_rule, onDelete: row.delete_rule });
        }
        const c = constraintMap.get(key)!;
        if (row.column_name && !c.columns.includes(row.column_name)) c.columns.push(row.column_name);
        if (row.foreign_column_name && !c.foreignColumns.includes(row.foreign_column_name)) c.foreignColumns.push(row.foreign_column_name);
      }
      constraints = Array.from(constraintMap.values());

      const indexResult = await connectionManager.queryPool<{ index_name: string; column_name: string; is_unique?: boolean; is_primary?: boolean }>(pool, info, `SELECT i.relname AS index_name, a.attname AS column_name, ix.indisunique AS is_unique, ix.indisprimary AS is_primary FROM pg_class t JOIN pg_index ix ON t.oid = ix.indrelid JOIN pg_class i ON i.oid = ix.indexrelid JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey) JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = $1 AND t.relname = $2 ORDER BY i.relname, a.attnum`, [schema, tableName]);
      const indexMap = new Map<string, IndexInfo>();
      for (const row of indexResult.rows) {
        const key = row.index_name;
        if (!indexMap.has(key)) indexMap.set(key, { name: row.index_name, columns: [], unique: row.is_unique, primary: row.is_primary });
        indexMap.get(key)!.columns.push(row.column_name);
      }
      indexes = Array.from(indexMap.values());
    }

    res.json({ tableName, schema, columns, constraints, indexes });
  } catch (error) {
    console.error('Failed to get table details:', error);
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

// POST /api/schema-builder/:connectionId/tables
router.post('/:connectionId/tables', async (req: Request, res: Response<import('../types').DDLResponse | { sql?: string } | { error: string }>) => {
  try {
    const connectionIdRaw = req.params.connectionId;
    const connectionId = Array.isArray(connectionIdRaw) ? connectionIdRaw[0] : connectionIdRaw;
    const { tableName, schema = 'public', columns, primaryKey, preview } = req.body as { tableName: string; schema?: string; columns: Array<{ name: string; type: string; maxLength?: number; precision?: number; scale?: number; nullable?: boolean; default?: string; unique?: boolean }>; primaryKey?: string[]; preview?: boolean };
    if (!tableName || !columns || (Array.isArray(columns) && columns.length === 0)) return res.status(400).json({ error: 'Table name and at least one column are required' });
    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) return res.status(404).json({ error: 'Connection not found' });
    const info = connectionManager.getInfo(connectionId);
    const dbType = info?.type || 'postgres';
    const columnDefs = columns.map((col) => {
      let def = `"${col.name}" ${col.type}`;
      if (col.maxLength) def += `(${col.maxLength})`;
      else if (col.precision) def += `(${col.precision}${col.scale ? `, ${col.scale}` : ''})`;
      if (!col.nullable) def += ' NOT NULL';
      if (col.default) def += ` DEFAULT ${col.default}`;
      if (col.unique) def += ' UNIQUE';
      return def;
    });
    if (primaryKey && primaryKey.length > 0) columnDefs.push(`PRIMARY KEY (${primaryKey.map((c: string) => `"${c}"`).join(', ')})`);
    const sql = `CREATE TABLE "${schema}"."${tableName}" (\n  ${columnDefs.join(',\n  ')}\n)`;
    if (preview) return res.json({ sql });
    await connectionManager.queryPool(pool, info, sql);
    res.json({ success: true, message: `Table ${tableName} created successfully`, sql });
  } catch (error) {
    console.error('Failed to create table:', error);
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

// PUT rename table
router.put('/:connectionId/tables/:tableName', async (req: Request, res: Response<import('../types').DDLResponse | { sql?: string } | { error: string }>) => {
  try {
    const connectionIdRaw = req.params.connectionId;
    const connectionId = Array.isArray(connectionIdRaw) ? connectionIdRaw[0] : connectionIdRaw;
        const info = connectionManager.getInfo(connectionId);
        const dbType = info?.type || 'postgres';

    const tableName = Array.isArray(req.params.tableName) ? req.params.tableName[0] : req.params.tableName;
    const { newName, schema = 'public', preview } = req.body as { newName?: string; schema?: string; preview?: boolean } || {};
    if (!newName) return res.status(400).json({ error: 'New table name is required' });
    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) return res.status(404).json({ error: 'Connection not found' });
    const sql = `ALTER TABLE "${schema}"."${tableName}" RENAME TO "${newName}"`;
    if (preview) return res.json({ sql });
    await connectionManager.queryPool(pool, info, sql);
    res.json({ success: true, message: `Table renamed to ${newName}`, sql });
  } catch (error) {
    console.error('Failed to get table details:', error);
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

// DELETE table
router.delete('/:connectionId/tables/:tableName', async (req: Request, res: Response<import('../types').DDLResponse | { sql?: string } | { error: string }>) => {
  try {
    const connectionIdRaw = req.params.connectionId;
    const connectionId = Array.isArray(connectionIdRaw) ? connectionIdRaw[0] : connectionIdRaw;
    const tableName = Array.isArray(req.params.tableName) ? req.params.tableName[0] : req.params.tableName;
    const queryObj = req.query as Record<string, string | undefined>;
    const schema = queryObj.schema || 'public';
    const cascade = queryObj.cascade === 'true';
    const preview = queryObj.preview === 'true';
     const info = connectionManager.getInfo(connectionId);
        const dbType = info?.type || 'postgres';
    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) return res.status(404).json({ error: 'Connection not found' });
    const sql = `DROP TABLE "${schema}"."${tableName}"${cascade ? ' CASCADE' : ''}`;
    if (preview) return res.json({ sql });
    await connectionManager.queryPool(pool, info, sql);
    res.json({ success: true, message: `Table ${tableName} dropped`, sql });
  } catch (error) {
    console.error('Failed to drop table:', error);
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

// POST /api/schema-builder/:connectionId/tables/:tableName/columns
router.post('/:connectionId/tables/:tableName/columns', async (req: Request, res: Response<import('../types').DDLResponse | { sql?: string } | { error: string }>) => {
  try {
    const connectionIdRaw = req.params.connectionId;
    const connectionId = Array.isArray(connectionIdRaw) ? connectionIdRaw[0] : connectionIdRaw;
    const tableName = Array.isArray(req.params.tableName) ? req.params.tableName[0] : req.params.tableName;
    const body = req.body as { column?: { name: string; type: string; maxLength?: number; precision?: number; scale?: number; nullable?: boolean; default?: string; unique?: boolean }; schema?: string; preview?: boolean } | undefined;
    const { column, schema = 'public', preview } = body || {};
    if (!column || !column.name || !column.type) return res.status(400).json({ error: 'Column name and type are required' });

    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) return res.status(404).json({ error: 'Connection not found' });

    let typeDef = column.type;
    if (column.maxLength) typeDef += `(${column.maxLength})`;
    else if (column.precision) typeDef += `(${column.precision}${column.scale ? `, ${column.scale}` : ''})`;

    let sql = `ALTER TABLE "${schema}"."${tableName}" ADD COLUMN "${column.name}" ${typeDef}`;
    if (!column.nullable) sql += ' NOT NULL';
    if (column.default) sql += ` DEFAULT ${column.default}`;
    if (column.unique) sql += ' UNIQUE';

    if (preview) { res.json({ sql }); return; }

    await connectionManager.queryPool(pool, connectionManager.getInfo(connectionId), sql);
    res.json({ success: true, message: `Column ${column.name} added`, sql });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Failed to add column:', msg);
    res.status(500).json({ error: msg });
  }
});

// PUT /api/schema-builder/:connectionId/tables/:tableName/columns/:columnName
router.put('/:connectionId/tables/:tableName/columns/:columnName', async (req: Request, res: Response<import('../types').DDLResponse | { sql?: string } | { error: string }>) => {
  try {
    const connectionIdRaw = req.params.connectionId;
    const connectionId = Array.isArray(connectionIdRaw) ? connectionIdRaw[0] : connectionIdRaw;
    const tableName = Array.isArray(req.params.tableName) ? req.params.tableName[0] : req.params.tableName;
    const columnName = Array.isArray(req.params.columnName) ? req.params.columnName[0] : req.params.columnName;
    const body = req.body as { newName?: string; type?: string; maxLength?: number; precision?: number; scale?: number; nullable?: boolean; default?: string | null; schema?: string; preview?: boolean } | undefined;
    const { newName, type, maxLength, precision, scale, nullable, default: defaultVal, schema = 'public', preview } = body || {};

    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) return res.status(404).json({ error: 'Connection not found' });

    const statements: string[] = [];

    if (newName && newName !== columnName) {
      statements.push(`ALTER TABLE "${schema}"."${tableName}" RENAME COLUMN "${columnName}" TO "${newName}"`);
    }

    const targetCol = newName || columnName;

    if (type) {
      let typeDef = type;
      if (maxLength) typeDef += `(${maxLength})`;
      else if (precision) typeDef += `(${precision}${scale ? `, ${scale}` : ''})`;
      statements.push(`ALTER TABLE "${schema}"."${tableName}" ALTER COLUMN "${targetCol}" TYPE ${typeDef}`);
    }

    if (nullable !== undefined) {
      if (nullable) statements.push(`ALTER TABLE "${schema}"."${tableName}" ALTER COLUMN "${targetCol}" DROP NOT NULL`);
      else statements.push(`ALTER TABLE "${schema}"."${tableName}" ALTER COLUMN "${targetCol}" SET NOT NULL`);
    }

    if (defaultVal !== undefined) {
      if (defaultVal === null || defaultVal === '') statements.push(`ALTER TABLE "${schema}"."${tableName}" ALTER COLUMN "${targetCol}" DROP DEFAULT`);
      else statements.push(`ALTER TABLE "${schema}"."${tableName}" ALTER COLUMN "${targetCol}" SET DEFAULT ${defaultVal}`);
    }

    const sql = statements.join(';\n');
    if (preview) { res.json({ sql }); return; }

    for (const stmt of statements) await connectionManager.queryPool(pool, connectionManager.getInfo(connectionId), stmt);
    res.json({ success: true, message: `Column ${columnName} modified`, sql });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Failed to modify column:', msg);
    res.status(500).json({ error: msg });
  }
});

// DELETE /api/schema-builder/:connectionId/tables/:tableName/columns/:columnName
router.delete('/:connectionId/tables/:tableName/columns/:columnName', async (req: Request, res: Response<import('../types').DDLResponse | { sql?: string } | { error: string }>) => {
  try {
    const connectionIdRaw = req.params.connectionId;
    const connectionId = Array.isArray(connectionIdRaw) ? connectionIdRaw[0] : connectionIdRaw;
    const tableName = Array.isArray(req.params.tableName) ? req.params.tableName[0] : req.params.tableName;
    const columnName = Array.isArray(req.params.columnName) ? req.params.columnName[0] : req.params.columnName;
    const queryObj = req.query as Record<string, string | undefined>;
    const schema = queryObj.schema || 'public';
    const preview = queryObj.preview === 'true';

    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) return res.status(404).json({ error: 'Connection not found' });

    const sql = `ALTER TABLE "${schema}"."${tableName}" DROP COLUMN "${columnName}"`;
    if (preview) { res.json({ sql }); return; }

    await connectionManager.queryPool(pool, connectionManager.getInfo(connectionId), sql);
    res.json({ success: true, message: `Column ${columnName} dropped`, sql });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Failed to drop column:', msg);
    res.status(500).json({ error: msg });
  }
});

// POST /api/schema-builder/:connectionId/tables/:tableName/constraints
router.post('/:connectionId/tables/:tableName/constraints', async (req: Request, res: Response) => {
  try {
    const connectionIdRaw = req.params.connectionId;
    const connectionId = Array.isArray(connectionIdRaw) ? connectionIdRaw[0] : connectionIdRaw;
    const tableName = Array.isArray(req.params.tableName) ? req.params.tableName[0] : req.params.tableName;
    const body = req.body as { constraint?: ConstraintInfo; schema?: string; preview?: boolean } | undefined;
    const { constraint, schema = 'public', preview } = body || {};
    if (!constraint || !constraint.type) return res.status(400).json({ error: 'Constraint type is required' });

    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) return res.status(404).json({ error: 'Connection not found' });

    const constraintName = constraint.name || `${tableName}_${(constraint.type || '').toLowerCase()}_${Date.now()}`;
    let sql = '';

    switch ((constraint.type || '').toUpperCase()) {
      case 'PRIMARY KEY':
        sql = `ALTER TABLE "${schema}"."${tableName}" ADD CONSTRAINT "${constraintName}" PRIMARY KEY (${constraint.columns.map((c: string) => `"${c}"`).join(', ')})`;
        break;
      case 'FOREIGN KEY':
        sql = `ALTER TABLE "${schema}"."${tableName}" ADD CONSTRAINT "${constraintName}" FOREIGN KEY (${constraint.columns.map((c: string) => `"${c}"`).join(', ')}) REFERENCES "${constraint.foreignSchema || schema}"."${constraint.foreignTable}" (${constraint.foreignColumns.map((c: string) => `"${c}"`).join(', ')})`;
        if (constraint.onUpdate) sql += ` ON UPDATE ${constraint.onUpdate}`;
        if (constraint.onDelete) sql += ` ON DELETE ${constraint.onDelete}`;
        break;
      case 'UNIQUE':
        sql = `ALTER TABLE "${schema}"."${tableName}" ADD CONSTRAINT "${constraintName}" UNIQUE (${constraint.columns.map((c: string) => `"${c}"`).join(', ')})`;
        break;
      case 'CHECK':
        sql = `ALTER TABLE "${schema}"."${tableName}" ADD CONSTRAINT "${constraintName}" CHECK (${constraint.expression})`;
        break;
      default:
        return res.status(400).json({ error: 'Invalid constraint type' });
    }

    if (preview) { res.json({ sql }); return; }
    await connectionManager.queryPool(pool, connectionManager.getInfo(connectionId), sql);
    res.json({ success: true, message: `Constraint ${constraintName} added`, sql });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Failed to add constraint:', msg);
    res.status(500).json({ error: msg });
  }
});

// DELETE /api/schema-builder/:connectionId/tables/:tableName/constraints/:constraintName
router.delete('/:connectionId/tables/:tableName/constraints/:constraintName', async (req: Request, res: Response) => {
  try {
    const connectionIdRaw = req.params.connectionId;
    const connectionId = Array.isArray(connectionIdRaw) ? connectionIdRaw[0] : connectionIdRaw;
    const tableName = Array.isArray(req.params.tableName) ? req.params.tableName[0] : req.params.tableName;
    const constraintName = Array.isArray(req.params.constraintName) ? req.params.constraintName[0] : req.params.constraintName;
    const queryObj = req.query as Record<string, string | undefined>;
    const schema = queryObj.schema || 'public';
    const preview = queryObj.preview === 'true';

    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) return res.status(404).json({ error: 'Connection not found' });

    const sql = `ALTER TABLE "${schema}"."${tableName}" DROP CONSTRAINT "${constraintName}"`;
    if (preview) { res.json({ sql }); return; }
    await connectionManager.queryPool(pool, connectionManager.getInfo(connectionId), sql);
    res.json({ success: true, message: `Constraint ${constraintName} dropped`, sql });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Failed to drop constraint:', msg);
    res.status(500).json({ error: msg });
  }
});

// POST /api/schema-builder/:connectionId/tables/:tableName/indexes
router.post('/:connectionId/tables/:tableName/indexes', async (req: Request, res: Response) => {
  try {
    const connectionIdRaw = req.params.connectionId;
    const connectionId = Array.isArray(connectionIdRaw) ? connectionIdRaw[0] : connectionIdRaw;
    const tableName = Array.isArray(req.params.tableName) ? req.params.tableName[0] : req.params.tableName;
    const body = req.body as { index?: IndexInfo; schema?: string; preview?: boolean } | undefined;
    const { index, schema = 'public', preview } = body || {};
    if (!index || !index.columns || index.columns.length === 0) return res.status(400).json({ error: 'Index columns are required' });

    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) return res.status(404).json({ error: 'Connection not found' });

    const indexName = index.name || `idx_${tableName}_${index.columns.join('_')}`;
    let sql = `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX "${indexName}" ON "${schema}"."${tableName}" (${index.columns.map((c: string) => `"${c}"`).join(', ')})`;
    if (preview) { res.json({ sql }); return; }
    await connectionManager.queryPool(pool, connectionManager.getInfo(connectionId), sql);
    res.json({ success: true, message: `Index ${indexName} created`, sql });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Failed to create index:', msg);
    res.status(500).json({ error: msg });
  }
});

// DELETE /api/schema-builder/:connectionId/indexes/:indexName
router.delete('/:connectionId/indexes/:indexName', async (req: Request, res: Response) => {
  try {
    const connectionIdRaw = req.params.connectionId;
    const connectionId = Array.isArray(connectionIdRaw) ? connectionIdRaw[0] : connectionIdRaw;
    const indexName = Array.isArray(req.params.indexName) ? req.params.indexName[0] : req.params.indexName;
    const queryObj = req.query as Record<string, string | undefined>;
    const schema = queryObj.schema || 'public';
    const preview = queryObj.preview === 'true';

    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) return res.status(404).json({ error: 'Connection not found' });

    const sql = `DROP INDEX "${schema}"."${indexName}"`;
    if (preview) { res.json({ sql }); return; }
    await connectionManager.queryPool(pool, connectionManager.getInfo(connectionId), sql);
    res.json({ success: true, message: `Index ${indexName} dropped`, sql });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Failed to drop index:', msg);
    res.status(500).json({ error: msg });
  }
});

// POST /api/schema-builder/:connectionId/execute
router.post('/:connectionId/execute', async (req: Request, res: Response) => {
  try {
    const connectionIdRaw = req.params.connectionId;
    const connectionId = Array.isArray(connectionIdRaw) ? connectionIdRaw[0] : connectionIdRaw;
    const body = req.body as { sql?: string } | undefined;
    const sql = (body && body.sql) || '';
    if (!sql) return res.status(400).json({ error: 'SQL is required' });

    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) return res.status(404).json({ error: 'Connection not found' });

    const result = await connectionManager.queryPool(pool, connectionManager.getInfo(connectionId), sql as string);
    res.json({ success: true, message: 'SQL executed successfully', rowCount: result.rowCount, rows: result.rows?.slice(0, 1000) || [], fields: result.fields?.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })) || [] });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Failed to execute SQL:', msg);
    res.status(500).json({ error: msg });
  }
});

// GET /api/schema-builder/:connectionId/data-types
router.get('/:connectionId/data-types', async (req: Request, res: Response) => {
  try {
    const connectionIdRaw = req.params.connectionId;
    const connectionId = Array.isArray(connectionIdRaw) ? connectionIdRaw[0] : connectionIdRaw;
    const info = connectionManager.getInfo(connectionId);
    const dbType = info?.type || 'postgres';

    interface DataTypeInfo {
      name: string;
      label: string;
      category: string;
      hasPrecision?: boolean;
      hasLength?: boolean;
    }
    let dataTypes: DataTypeInfo[] = [];
    if (dbType === 'postgres') {
      dataTypes = [
        { name: 'int4', label: 'INTEGER', category: 'Numeric' },
        { name: 'int8', label: 'BIGINT', category: 'Numeric' },
        { name: 'int2', label: 'SMALLINT', category: 'Numeric' },
        { name: 'serial', label: 'SERIAL', category: 'Numeric' },
        { name: 'bigserial', label: 'BIGSERIAL', category: 'Numeric' },
        { name: 'numeric', label: 'NUMERIC', category: 'Numeric', hasPrecision: true },
        { name: 'float4', label: 'REAL', category: 'Numeric' },
        { name: 'float8', label: 'DOUBLE PRECISION', category: 'Numeric' },
        { name: 'money', label: 'MONEY', category: 'Numeric' },
        { name: 'varchar', label: 'VARCHAR', category: 'Text', hasLength: true },
        { name: 'char', label: 'CHAR', category: 'Text', hasLength: true },
        { name: 'text', label: 'TEXT', category: 'Text' },
        { name: 'bool', label: 'BOOLEAN', category: 'Boolean' },
        { name: 'date', label: 'DATE', category: 'Date/Time' },
        { name: 'time', label: 'TIME', category: 'Date/Time' },
        { name: 'timetz', label: 'TIME WITH TIMEZONE', category: 'Date/Time' },
        { name: 'timestamp', label: 'TIMESTAMP', category: 'Date/Time' },
        { name: 'timestamptz', label: 'TIMESTAMP WITH TIMEZONE', category: 'Date/Time' },
        { name: 'interval', label: 'INTERVAL', category: 'Date/Time' },
        { name: 'uuid', label: 'UUID', category: 'Other' },
        { name: 'json', label: 'JSON', category: 'Other' },
        { name: 'jsonb', label: 'JSONB', category: 'Other' },
        { name: 'bytea', label: 'BYTEA', category: 'Other' },
        { name: 'inet', label: 'INET', category: 'Network' },
        { name: 'cidr', label: 'CIDR', category: 'Network' },
      ];
    } else if (dbType === 'mysql') {
      dataTypes = [
        { name: 'int', label: 'INT', category: 'Numeric' },
        { name: 'bigint', label: 'BIGINT', category: 'Numeric' },
        { name: 'smallint', label: 'SMALLINT', category: 'Numeric' },
        { name: 'decimal', label: 'DECIMAL', category: 'Numeric', hasPrecision: true },
        { name: 'float', label: 'FLOAT', category: 'Numeric' },
        { name: 'double', label: 'DOUBLE', category: 'Numeric' },
        { name: 'varchar', label: 'VARCHAR', category: 'Text', hasLength: true },
        { name: 'char', label: 'CHAR', category: 'Text', hasLength: true },
        { name: 'text', label: 'TEXT', category: 'Text' },
        { name: 'tinyint', label: 'TINYINT', category: 'Numeric' },
        { name: 'boolean', label: 'BOOLEAN', category: 'Boolean' },
        { name: 'date', label: 'DATE', category: 'Date/Time' },
        { name: 'time', label: 'TIME', category: 'Date/Time' },
        { name: 'datetime', label: 'DATETIME', category: 'Date/Time' },
        { name: 'timestamp', label: 'TIMESTAMP', category: 'Date/Time' },
        { name: 'json', label: 'JSON', category: 'Other' },
      ];
    }

    res.json({ dataTypes });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Failed to list data types:', msg);
    res.status(500).json({ error: msg });
  }
});

export default router;