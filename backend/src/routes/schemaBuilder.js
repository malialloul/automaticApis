const express = require('express');
const connectionManager = require('../utils/connectionManager');
const { Pool } = require('pg');

const router = express.Router();

/**
 * POST /api/schema-builder/create-database
 * Create a new PostgreSQL database and optionally execute SQL to create tables
 */
router.post('/create-database', async (req, res) => {
  try {
    const { host, port, user, password, database, sql, createDatabase = true, uri } = req.body;

    const databaseName = database;
    
    if (!databaseName) {
      return res.status(400).json({ error: 'Database name is required' });
    }

    // Connect to default 'postgres' database first
    let poolConfig;
    if (uri) {
      // Parse URI and replace database with 'postgres'
      const url = new URL(uri);
      url.pathname = '/postgres';
      poolConfig = {
        connectionString: url.toString(),
        ssl: uri.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
      };
    } else {
      if (!host || !user) {
        return res.status(400).json({ error: 'Host and user are required' });
      }
      poolConfig = {
        host,
        port: port || 5432,
        database: 'postgres',
        user,
        password: password || '',
      };
    }

    const safeName = databaseName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    const pool = new Pool(poolConfig);
    
    try {
      // Check if database already exists
      const checkResult = await pool.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [safeName]
      );
      
      const dbExists = checkResult.rows.length > 0;
      
      if (!dbExists && createDatabase) {
        // Create the database
        await pool.query(`CREATE DATABASE "${safeName}"`);
      } else if (!dbExists && !createDatabase) {
        await pool.end();
        return res.status(400).json({ error: `Database '${safeName}' does not exist. Enable 'Create database if it doesn't exist' option.` });
      }
      
      await pool.end();

      // Now connect to the new database to execute SQL
      const dbPoolConfig = uri ? {
        connectionString: uri.replace(/\/[^/?]+(\?|$)/, `/${safeName}$1`),
        ssl: uri.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
      } : {
        host,
        port: port || 5432,
        database: safeName,
        user,
        password: password || '',
      };
      
      const dbPool = new Pool(dbPoolConfig);
      
      // Execute the SQL to create tables if provided
      if (sql && sql.trim()) {
        try {
          await dbPool.query(sql);
        } catch (sqlError) {
          await dbPool.end();
          return res.status(400).json({ 
            success: false,
            error: `SQL execution failed: ${sqlError.message}` 
          });
        }
      }
      
      await dbPool.end();
      
      // Generate a connection ID and register with connection manager
      const connectionId = `schemabuilder_${safeName}_${Date.now()}`;
      const connectionConfig = {
        host: host || (uri ? new URL(uri).hostname : 'localhost'),
        port: port || (uri ? new URL(uri).port || 5432 : 5432),
        database: safeName,
        user: user || (uri ? new URL(uri).username : ''),
        password: password || (uri ? decodeURIComponent(new URL(uri).password || '') : ''),
        type: 'postgres',
      };
      
      // Store in connection manager so it can be used for queries
      await connectionManager.getConnection(connectionId, connectionConfig);

      // Return connection details for the new database
      res.json({
        success: true,
        message: dbExists ? `Connected to existing database '${safeName}'` : `Database '${safeName}' created successfully`,
        connectionId,
        connection: {
          id: connectionId,
          name: safeName,
          ...connectionConfig,
        },
      });
    } catch (err) {
      try { await pool.end(); } catch {}
      throw err;
    }
  } catch (error) {
    console.error('Failed to create database:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/schema-builder/:connectionId/tables
 * List all tables in the database
 */
router.get('/:connectionId/tables', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const info = connectionManager.getInfo(connectionId);
    const dbType = info?.type || 'postgres';

    let tables = [];
    if (dbType === 'postgres') {
      const result = await pool.query(`
        SELECT table_name, table_schema
        FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          AND table_type = 'BASE TABLE'
        ORDER BY table_schema, table_name
      `);
      tables = result.rows.map(r => ({ name: r.table_name, schema: r.table_schema }));
    } else if (dbType === 'mysql') {
      const [rows] = await pool.query(`
        SELECT TABLE_NAME as table_name, TABLE_SCHEMA as table_schema
        FROM information_schema.tables
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
      `);
      tables = rows.map(r => ({ name: r.table_name, schema: r.table_schema }));
    }

    res.json({ tables });
  } catch (error) {
    console.error('Failed to list tables:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/schema-builder/:connectionId/tables/:tableName
 * Get detailed table structure (columns, constraints, indexes)
 */
router.get('/:connectionId/tables/:tableName', async (req, res) => {
  try {
    const { connectionId, tableName } = req.params;
    const { schema = 'public' } = req.query;
    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const info = connectionManager.getInfo(connectionId);
    const dbType = info?.type || 'postgres';

    let columns = [];
    let constraints = [];
    let indexes = [];

    if (dbType === 'postgres') {
      // Get columns
      const colResult = await pool.query(`
        SELECT 
          c.column_name,
          c.data_type,
          c.udt_name,
          c.character_maximum_length,
          c.numeric_precision,
          c.numeric_scale,
          c.is_nullable,
          c.column_default,
          c.ordinal_position
        FROM information_schema.columns c
        WHERE c.table_schema = $1 AND c.table_name = $2
        ORDER BY c.ordinal_position
      `, [schema, tableName]);
      columns = colResult.rows.map(r => ({
        name: r.column_name,
        type: r.udt_name || r.data_type,
        maxLength: r.character_maximum_length,
        precision: r.numeric_precision,
        scale: r.numeric_scale,
        nullable: r.is_nullable === 'YES',
        default: r.column_default,
        position: r.ordinal_position,
      }));

      // Get constraints (PK, FK, UNIQUE, CHECK)
      const constraintResult = await pool.query(`
        SELECT 
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name,
          ccu.table_schema AS foreign_table_schema,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          rc.update_rule,
          rc.delete_rule
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        LEFT JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
        LEFT JOIN information_schema.referential_constraints rc
          ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
        WHERE tc.table_schema = $1 AND tc.table_name = $2
        ORDER BY tc.constraint_name
      `, [schema, tableName]);
      
      // Group constraints
      const constraintMap = new Map();
      for (const row of constraintResult.rows) {
        const key = row.constraint_name;
        if (!constraintMap.has(key)) {
          constraintMap.set(key, {
            name: row.constraint_name,
            type: row.constraint_type,
            columns: [],
            foreignTable: row.foreign_table_name,
            foreignSchema: row.foreign_table_schema,
            foreignColumns: [],
            onUpdate: row.update_rule,
            onDelete: row.delete_rule,
          });
        }
        const c = constraintMap.get(key);
        if (row.column_name && !c.columns.includes(row.column_name)) {
          c.columns.push(row.column_name);
        }
        if (row.foreign_column_name && !c.foreignColumns.includes(row.foreign_column_name)) {
          c.foreignColumns.push(row.foreign_column_name);
        }
      }
      constraints = Array.from(constraintMap.values());

      // Get indexes
      const indexResult = await pool.query(`
        SELECT
          i.relname AS index_name,
          a.attname AS column_name,
          ix.indisunique AS is_unique,
          ix.indisprimary AS is_primary
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = $1 AND t.relname = $2
        ORDER BY i.relname, a.attnum
      `, [schema, tableName]);

      const indexMap = new Map();
      for (const row of indexResult.rows) {
        const key = row.index_name;
        if (!indexMap.has(key)) {
          indexMap.set(key, {
            name: row.index_name,
            columns: [],
            unique: row.is_unique,
            primary: row.is_primary,
          });
        }
        indexMap.get(key).columns.push(row.column_name);
      }
      indexes = Array.from(indexMap.values());
    }

    res.json({ tableName, schema, columns, constraints, indexes });
  } catch (error) {
    console.error('Failed to get table details:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/schema-builder/:connectionId/tables
 * Create a new table
 */
router.post('/:connectionId/tables', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { tableName, schema = 'public', columns, primaryKey, preview } = req.body;

    if (!tableName || !columns || columns.length === 0) {
      return res.status(400).json({ error: 'Table name and at least one column are required' });
    }

    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const info = connectionManager.getInfo(connectionId);
    const dbType = info?.type || 'postgres';

    // Build CREATE TABLE SQL
    const columnDefs = columns.map(col => {
      let def = `"${col.name}" ${col.type}`;
      if (col.maxLength) def += `(${col.maxLength})`;
      else if (col.precision) def += `(${col.precision}${col.scale ? `, ${col.scale}` : ''})`;
      if (!col.nullable) def += ' NOT NULL';
      if (col.default) def += ` DEFAULT ${col.default}`;
      if (col.unique) def += ' UNIQUE';
      return def;
    });

    if (primaryKey && primaryKey.length > 0) {
      columnDefs.push(`PRIMARY KEY (${primaryKey.map(c => `"${c}"`).join(', ')})`);
    }

    const sql = `CREATE TABLE "${schema}"."${tableName}" (\n  ${columnDefs.join(',\n  ')}\n)`;

    if (preview) {
      return res.json({ sql });
    }

    await pool.query(sql);
    res.json({ success: true, message: `Table ${tableName} created successfully`, sql });
  } catch (error) {
    console.error('Failed to create table:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/schema-builder/:connectionId/tables/:tableName
 * Rename a table
 */
router.put('/:connectionId/tables/:tableName', async (req, res) => {
  try {
    const { connectionId, tableName } = req.params;
    const { newName, schema = 'public', preview } = req.body;

    if (!newName) {
      return res.status(400).json({ error: 'New table name is required' });
    }

    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const sql = `ALTER TABLE "${schema}"."${tableName}" RENAME TO "${newName}"`;

    if (preview) {
      return res.json({ sql });
    }

    await pool.query(sql);
    res.json({ success: true, message: `Table renamed to ${newName}`, sql });
  } catch (error) {
    console.error('Failed to rename table:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/schema-builder/:connectionId/tables/:tableName
 * Drop a table
 */
router.delete('/:connectionId/tables/:tableName', async (req, res) => {
  try {
    const { connectionId, tableName } = req.params;
    const { schema = 'public', cascade = false, preview } = req.query;

    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const sql = `DROP TABLE "${schema}"."${tableName}"${cascade === 'true' ? ' CASCADE' : ''}`;

    if (preview === 'true') {
      return res.json({ sql });
    }

    await pool.query(sql);
    res.json({ success: true, message: `Table ${tableName} dropped`, sql });
  } catch (error) {
    console.error('Failed to drop table:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/schema-builder/:connectionId/tables/:tableName/columns
 * Add a column to existing table
 */
router.post('/:connectionId/tables/:tableName/columns', async (req, res) => {
  try {
    const { connectionId, tableName } = req.params;
    const { column, schema = 'public', preview } = req.body;

    if (!column || !column.name || !column.type) {
      return res.status(400).json({ error: 'Column name and type are required' });
    }

    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    let typeDef = column.type;
    if (column.maxLength) typeDef += `(${column.maxLength})`;
    else if (column.precision) typeDef += `(${column.precision}${column.scale ? `, ${column.scale}` : ''})`;

    let sql = `ALTER TABLE "${schema}"."${tableName}" ADD COLUMN "${column.name}" ${typeDef}`;
    if (!column.nullable) sql += ' NOT NULL';
    if (column.default) sql += ` DEFAULT ${column.default}`;
    if (column.unique) sql += ' UNIQUE';

    if (preview) {
      return res.json({ sql });
    }

    await pool.query(sql);
    res.json({ success: true, message: `Column ${column.name} added`, sql });
  } catch (error) {
    console.error('Failed to add column:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/schema-builder/:connectionId/tables/:tableName/columns/:columnName
 * Modify a column (rename, change type, set nullable, set default)
 */
router.put('/:connectionId/tables/:tableName/columns/:columnName', async (req, res) => {
  try {
    const { connectionId, tableName, columnName } = req.params;
    const { newName, type, maxLength, precision, scale, nullable, default: defaultVal, schema = 'public', preview } = req.body;

    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const statements = [];

    // Rename column
    if (newName && newName !== columnName) {
      statements.push(`ALTER TABLE "${schema}"."${tableName}" RENAME COLUMN "${columnName}" TO "${newName}"`);
    }

    const targetCol = newName || columnName;

    // Change type
    if (type) {
      let typeDef = type;
      if (maxLength) typeDef += `(${maxLength})`;
      else if (precision) typeDef += `(${precision}${scale ? `, ${scale}` : ''})`;
      statements.push(`ALTER TABLE "${schema}"."${tableName}" ALTER COLUMN "${targetCol}" TYPE ${typeDef}`);
    }

    // Set nullable
    if (nullable !== undefined) {
      if (nullable) {
        statements.push(`ALTER TABLE "${schema}"."${tableName}" ALTER COLUMN "${targetCol}" DROP NOT NULL`);
      } else {
        statements.push(`ALTER TABLE "${schema}"."${tableName}" ALTER COLUMN "${targetCol}" SET NOT NULL`);
      }
    }

    // Set default
    if (defaultVal !== undefined) {
      if (defaultVal === null || defaultVal === '') {
        statements.push(`ALTER TABLE "${schema}"."${tableName}" ALTER COLUMN "${targetCol}" DROP DEFAULT`);
      } else {
        statements.push(`ALTER TABLE "${schema}"."${tableName}" ALTER COLUMN "${targetCol}" SET DEFAULT ${defaultVal}`);
      }
    }

    const sql = statements.join(';\n');

    if (preview) {
      return res.json({ sql });
    }

    for (const stmt of statements) {
      await pool.query(stmt);
    }

    res.json({ success: true, message: `Column ${columnName} modified`, sql });
  } catch (error) {
    console.error('Failed to modify column:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/schema-builder/:connectionId/tables/:tableName/columns/:columnName
 * Drop a column
 */
router.delete('/:connectionId/tables/:tableName/columns/:columnName', async (req, res) => {
  try {
    const { connectionId, tableName, columnName } = req.params;
    const { schema = 'public', preview } = req.query;

    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const sql = `ALTER TABLE "${schema}"."${tableName}" DROP COLUMN "${columnName}"`;

    if (preview === 'true') {
      return res.json({ sql });
    }

    await pool.query(sql);
    res.json({ success: true, message: `Column ${columnName} dropped`, sql });
  } catch (error) {
    console.error('Failed to drop column:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/schema-builder/:connectionId/tables/:tableName/constraints
 * Add a constraint (PK, FK, UNIQUE, CHECK)
 */
router.post('/:connectionId/tables/:tableName/constraints', async (req, res) => {
  try {
    const { connectionId, tableName } = req.params;
    const { constraint, schema = 'public', preview } = req.body;

    if (!constraint || !constraint.type) {
      return res.status(400).json({ error: 'Constraint type is required' });
    }

    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    let sql = '';
    const constraintName = constraint.name || `${tableName}_${constraint.type.toLowerCase()}_${Date.now()}`;

    switch (constraint.type.toUpperCase()) {
      case 'PRIMARY KEY':
        sql = `ALTER TABLE "${schema}"."${tableName}" ADD CONSTRAINT "${constraintName}" PRIMARY KEY (${constraint.columns.map(c => `"${c}"`).join(', ')})`;
        break;
      case 'FOREIGN KEY':
        sql = `ALTER TABLE "${schema}"."${tableName}" ADD CONSTRAINT "${constraintName}" FOREIGN KEY (${constraint.columns.map(c => `"${c}"`).join(', ')}) REFERENCES "${constraint.foreignSchema || schema}"."${constraint.foreignTable}" (${constraint.foreignColumns.map(c => `"${c}"`).join(', ')})`;
        if (constraint.onUpdate) sql += ` ON UPDATE ${constraint.onUpdate}`;
        if (constraint.onDelete) sql += ` ON DELETE ${constraint.onDelete}`;
        break;
      case 'UNIQUE':
        sql = `ALTER TABLE "${schema}"."${tableName}" ADD CONSTRAINT "${constraintName}" UNIQUE (${constraint.columns.map(c => `"${c}"`).join(', ')})`;
        break;
      case 'CHECK':
        sql = `ALTER TABLE "${schema}"."${tableName}" ADD CONSTRAINT "${constraintName}" CHECK (${constraint.expression})`;
        break;
      default:
        return res.status(400).json({ error: 'Invalid constraint type' });
    }

    if (preview) {
      return res.json({ sql });
    }

    await pool.query(sql);
    res.json({ success: true, message: `Constraint ${constraintName} added`, sql });
  } catch (error) {
    console.error('Failed to add constraint:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/schema-builder/:connectionId/tables/:tableName/constraints/:constraintName
 * Drop a constraint
 */
router.delete('/:connectionId/tables/:tableName/constraints/:constraintName', async (req, res) => {
  try {
    const { connectionId, tableName, constraintName } = req.params;
    const { schema = 'public', preview } = req.query;

    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const sql = `ALTER TABLE "${schema}"."${tableName}" DROP CONSTRAINT "${constraintName}"`;

    if (preview === 'true') {
      return res.json({ sql });
    }

    await pool.query(sql);
    res.json({ success: true, message: `Constraint ${constraintName} dropped`, sql });
  } catch (error) {
    console.error('Failed to drop constraint:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/schema-builder/:connectionId/tables/:tableName/indexes
 * Create an index
 */
router.post('/:connectionId/tables/:tableName/indexes', async (req, res) => {
  try {
    const { connectionId, tableName } = req.params;
    const { index, schema = 'public', preview } = req.body;

    if (!index || !index.columns || index.columns.length === 0) {
      return res.status(400).json({ error: 'Index columns are required' });
    }

    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const indexName = index.name || `idx_${tableName}_${index.columns.join('_')}`;
    let sql = `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX "${indexName}" ON "${schema}"."${tableName}" (${index.columns.map(c => `"${c}"`).join(', ')})`;

    if (preview) {
      return res.json({ sql });
    }

    await pool.query(sql);
    res.json({ success: true, message: `Index ${indexName} created`, sql });
  } catch (error) {
    console.error('Failed to create index:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/schema-builder/:connectionId/indexes/:indexName
 * Drop an index
 */
router.delete('/:connectionId/indexes/:indexName', async (req, res) => {
  try {
    const { connectionId, indexName } = req.params;
    const { schema = 'public', preview } = req.query;

    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const sql = `DROP INDEX "${schema}"."${indexName}"`;

    if (preview === 'true') {
      return res.json({ sql });
    }

    await pool.query(sql);
    res.json({ success: true, message: `Index ${indexName} dropped`, sql });
  } catch (error) {
    console.error('Failed to drop index:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/schema-builder/:connectionId/execute
 * Execute raw SQL (for advanced users)
 */
router.post('/:connectionId/execute', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { sql } = req.body;

    if (!sql) {
      return res.status(400).json({ error: 'SQL is required' });
    }

    const pool = connectionManager.getExistingConnection(connectionId);
    if (!pool) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const result = await pool.query(sql);
    res.json({ 
      success: true, 
      message: 'SQL executed successfully',
      rowCount: result.rowCount,
      rows: result.rows?.slice(0, 1000), // Limit returned rows
      fields: result.fields?.map(f => ({ name: f.name, dataTypeID: f.dataTypeID })) || [],
    });
  } catch (error) {
    console.error('Failed to execute SQL:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/schema-builder/:connectionId/data-types
 * Get available data types for the database
 */
router.get('/:connectionId/data-types', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const info = connectionManager.getInfo(connectionId);
    const dbType = info?.type || 'postgres';

    let dataTypes = [];
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
        { name: 'macaddr', label: 'MACADDR', category: 'Network' },
      ];
    } else if (dbType === 'mysql') {
      dataTypes = [
        { name: 'INT', label: 'INT', category: 'Numeric' },
        { name: 'BIGINT', label: 'BIGINT', category: 'Numeric' },
        { name: 'SMALLINT', label: 'SMALLINT', category: 'Numeric' },
        { name: 'TINYINT', label: 'TINYINT', category: 'Numeric' },
        { name: 'DECIMAL', label: 'DECIMAL', category: 'Numeric', hasPrecision: true },
        { name: 'FLOAT', label: 'FLOAT', category: 'Numeric' },
        { name: 'DOUBLE', label: 'DOUBLE', category: 'Numeric' },
        { name: 'VARCHAR', label: 'VARCHAR', category: 'Text', hasLength: true },
        { name: 'CHAR', label: 'CHAR', category: 'Text', hasLength: true },
        { name: 'TEXT', label: 'TEXT', category: 'Text' },
        { name: 'LONGTEXT', label: 'LONGTEXT', category: 'Text' },
        { name: 'BOOLEAN', label: 'BOOLEAN', category: 'Boolean' },
        { name: 'DATE', label: 'DATE', category: 'Date/Time' },
        { name: 'TIME', label: 'TIME', category: 'Date/Time' },
        { name: 'DATETIME', label: 'DATETIME', category: 'Date/Time' },
        { name: 'TIMESTAMP', label: 'TIMESTAMP', category: 'Date/Time' },
        { name: 'JSON', label: 'JSON', category: 'Other' },
        { name: 'BLOB', label: 'BLOB', category: 'Other' },
      ];
    }

    res.json({ dataTypes });
  } catch (error) {
    console.error('Failed to get data types:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
