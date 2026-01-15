/**
 * SchemaInspector - Introspects database schema for several dialects
 * Supports: PostgreSQL, MySQL, MongoDB, MSSQL (limited), Oracle
 * Discovers tables/collections, columns/fields, primary keys, and foreign key relationships
 */
class SchemaInspector {
  constructor(pool, dialect = 'postgres', database = null) {
    this.pool = pool;
    this.dialect = (dialect || 'postgres').toLowerCase();
    this.database = database;
    this.schemaCache = null;
  }

  /**
   * Introspect the database schema
   * @returns {Promise<object>} Complete schema information
   */
  async introspect() {
    const tables = await this.getTables();
    const schema = {};

    for (const table of tables) {
      const columns = await this.getColumns(table.table_name);
      const primaryKeys = await this.getPrimaryKeys(table.table_name);
      const foreignKeys = await this.getForeignKeys(table.table_name);
      const reverseForeignKeys = await this.getReverseForeignKeys(table.table_name);

      schema[table.table_name] = {
        name: table.table_name,
        columns: columns,
        primaryKeys: primaryKeys,
        foreignKeys: foreignKeys,
        reverseForeignKeys: reverseForeignKeys,
      };
    }

    this.schemaCache = schema;
    return schema;
  }

  /**
   * Get all tables/collections in the database
   * @returns {Promise<Array>} List of tables
   */
  async getTables() {
    if (this.dialect === 'postgres') {
      const query = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `;
      const result = await this.pool.query(query);
      return result.rows;
    } else if (this.dialect === 'oracle') {
      const conn = await this.pool.getConnection();
      try {
        const result = await conn.execute(
          `SELECT table_name FROM user_tables ORDER BY table_name`,
          [],
          { outFormat: require('oracledb').OUT_FORMAT_OBJECT }
        );
        return result.rows.map(r => ({ table_name: r.TABLE_NAME }));
      } finally {
        try { await conn.close(); } catch (e) {}
      }
    } else if (this.dialect === 'mongodb') {
      const cols = await this.pool.db.listCollections().toArray();
      return cols.map(c => ({ table_name: c.name }));
    } else {
      const sql = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ?
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `;
      const [rows] = await this.pool.query(sql, [this.database]);
      return rows.map(r => ({ table_name: r.table_name || r.TABLE_NAME }));
    }
  }

  /**
   * Helper to get a JS type name for Mongo values
   */
  _mongoType(val) {
    if (val === null) return 'null';
    if (Array.isArray(val)) return 'array';
    if (val && val._bsontype) return val._bsontype.toLowerCase();
    const t = typeof val;
    if (t === 'object') return 'object';
    return t;
  }

  /**
   * Get columns/fields for a specific table/collection
   * @param {string} tableName - Table/collection name
   * @returns {Promise<Array>} List of columns with metadata
   */
  async getColumns(tableName) {
    if (this.dialect === 'postgres') {
      // existing implementation
      const query = `
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length,
          numeric_precision,
          numeric_scale,
          udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1
        ORDER BY ordinal_position;
      `;
      const result = await this.pool.query(query, [tableName]);
      // Find enum columns
      const enumCols = result.rows.filter(col => col.data_type === 'USER-DEFINED');
      let enumOptionsMap = {};
      if (enumCols.length > 0) {
        for (const col of enumCols) {
          // Get enum values for this type
          const enumRes = await this.pool.query(
            `SELECT enumlabel FROM pg_enum WHERE enumtypid = (
              SELECT oid FROM pg_type WHERE typname = $1
            ) ORDER BY enumsortorder;`,
            [col.udt_name]
          );
          enumOptionsMap[col.column_name] = enumRes.rows.map(r => r.enumlabel);
        }
      }
      // Find serial/identity columns (auto-increment)
      const autoIncRes = await this.pool.query(
        `SELECT a.attname as column_name
         FROM pg_class c
         JOIN pg_attribute a ON a.attrelid = c.oid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE c.relname = $1
         AND n.nspname = 'public'
         AND (
           a.attidentity IN ('a', 'd')
           OR (
             a.atthasdef AND (
               SELECT pg_get_expr(adbin, adrelid) FROM pg_attrdef WHERE adrelid = c.oid AND adnum = a.attnum
             ) ILIKE 'nextval%'
           )
         );`,
        [tableName]
      );
      const autoIncCols = new Set(autoIncRes.rows.map(r => r.column_name));
      return result.rows.map(col => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES',
        default: col.column_default,
        maxLength: col.character_maximum_length,
        precision: col.numeric_precision,
        scale: col.numeric_scale,
        enumOptions: enumOptionsMap[col.column_name] || undefined,
        isAutoIncrement: autoIncCols.has(col.column_name),
      }));
    } else if (this.dialect === 'oracle') {
      const conn = await this.pool.getConnection();
      try {
        const sql = `
          SELECT column_name, data_type, nullable, data_default, data_length, data_precision, data_scale
          FROM user_tab_columns
          WHERE table_name = :t
          ORDER BY column_id`;
        const result = await conn.execute(sql, [tableName.toUpperCase()], { outFormat: require('oracledb').OUT_FORMAT_OBJECT });
        return result.rows.map(r => ({
          name: r.COLUMN_NAME,
          type: r.DATA_TYPE,
          nullable: r.NULLABLE === 'Y',
          default: r.DATA_DEFAULT,
          maxLength: r.DATA_LENGTH,
          precision: r.DATA_PRECISION,
          scale: r.DATA_SCALE,
        }));
      } finally {
        try { await conn.close(); } catch (e) {}
      }
    } else if (this.dialect === 'mongodb') {
      const coll = this.pool.db.collection(tableName);
      const docs = await coll.find({}).limit(50).toArray();
      const fieldInfo = {}; // name -> { types: Set, presentCount }
      for (const doc of docs) {
        for (const key of Object.keys(doc)) {
          const val = doc[key];
          if (!fieldInfo[key]) fieldInfo[key] = { types: new Set(), present: 0 };
          fieldInfo[key].types.add(this._mongoType(val));
          fieldInfo[key].present++;
        }
      }
      const total = docs.length || 1;
      const columns = Object.entries(fieldInfo).map(([name, info]) => ({
        name,
        type: Array.from(info.types).sort().join('|'),
        nullable: info.present < total,
        samplePresentPercent: Math.round((info.present / total) * 100),
      }));
      // Ensure _id is present as primary key
      if (!columns.find(c => c.name === '_id')) {
        columns.unshift({ name: '_id', type: 'objectid', nullable: false, samplePresentPercent: 100 });
      }
      return columns;
    } else {
      const sql = `
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length,
          numeric_precision,
          numeric_scale,
          column_type,
          extra
        FROM information_schema.columns
        LEFT JOIN information_schema.tables ON columns.table_name = tables.table_name AND columns.table_schema = tables.table_schema
        WHERE columns.table_schema = ?
        AND columns.table_name = ?
        ORDER BY columns.ordinal_position;
      `;
      const [rows] = await this.pool.query(sql, [this.database, tableName]);
      return rows.map(col => {
        const name = col.column_name || col.COLUMN_NAME;
        const type = col.data_type || col.DATA_TYPE;
        let enumOptions;
        if (type === 'enum' && (col.column_type || col.COLUMN_TYPE)) {
          // Extract options from: enum('a','b','c')
          const match = (col.column_type || col.COLUMN_TYPE).match(/^enum\((.*)\)$/i);
          if (match && match[1]) {
            enumOptions = match[1]
              .split(/','/)
              .map(s => s.replace(/^'/, '').replace(/'$/, ''));
          }
        }
        // MySQL: auto-increment if extra contains 'auto_increment'
        const isAutoIncrement = (col.extra || col.EXTRA || '').toLowerCase().includes('auto_increment');
        return {
          name,
          type,
          nullable: (col.is_nullable || col.IS_NULLABLE) === 'YES',
          default: col.column_default || col.COLUMN_DEFAULT,
          maxLength: col.character_maximum_length || col.CHARACTER_MAXIMUM_LENGTH,
          precision: col.numeric_precision || col.NUMERIC_PRECISION,
          scale: col.numeric_scale || col.NUMERIC_SCALE,
          enumOptions,
          isAutoIncrement,
        };
      });
    }
  }

  /**
   * Get primary keys for a table
   * @param {string} tableName - Table name
   * @returns {Promise<Array>} List of primary key columns
   */
  async getPrimaryKeys(tableName) {
    if (this.dialect === 'postgres') {
      const query = `
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.constraint_schema = kcu.constraint_schema
          AND tc.table_name = kcu.table_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_name = $1
        AND tc.table_schema = 'public'
        ORDER BY kcu.ordinal_position;
      `;
      const result = await this.pool.query(query, [tableName]);
      return result.rows.map(row => row.column_name);
    } else if (this.dialect === 'oracle') {
      const conn = await this.pool.getConnection();
      try {
        const sql = `
          SELECT cols.column_name
          FROM all_constraints cons
          JOIN all_cons_columns cols ON cons.constraint_name = cols.constraint_name AND cons.owner = cols.owner
          WHERE cons.constraint_type = 'P'
          AND cons.table_name = :t
          AND cons.owner = USER`;
        const res = await conn.execute(sql, [tableName.toUpperCase()], { outFormat: require('oracledb').OUT_FORMAT_OBJECT });
        return res.rows.map(r => r.COLUMN_NAME);
      } finally {
        try { await conn.close(); } catch (e) {}
      }
    } else if (this.dialect === 'mongodb') {
      // MongoDB primary key is _id
      return ['_id'];
    } else {
      const sql = `
        SELECT k.COLUMN_NAME AS column_name
        FROM information_schema.table_constraints t
        JOIN information_schema.key_column_usage k
          ON k.constraint_name = t.constraint_name
          AND k.table_schema = t.table_schema
          AND k.table_name = t.table_name
        WHERE t.constraint_type = 'PRIMARY KEY'
        AND t.table_schema = ?
        AND t.table_name = ?;
      `;
      const [rows] = await this.pool.query(sql, [this.database, tableName]);
      return rows.map(r => r.column_name || r.COLUMN_NAME);
    }
  }

  /**
   * Get foreign keys for a table (relationships this table has to other tables)
   * @param {string} tableName - Table name
   * @returns {Promise<Array>} List of foreign key relationships
   */
  async getForeignKeys(tableName) {
    if (this.dialect === 'postgres') {
      const query = `
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          rc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints AS rc
          ON rc.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = $1
        AND tc.table_schema = 'public';
      `;
      const result = await this.pool.query(query, [tableName]);
      return result.rows.map(row => ({
        columnName: row.column_name,
        foreignTable: row.foreign_table_name,
        foreignColumn: row.foreign_column_name,
        constraintName: row.constraint_name,
      }));
    } else if (this.dialect === 'oracle') {
      const conn = await this.pool.getConnection();
      try {
        const sql = `
          SELECT k.column_name, r.table_name AS foreign_table_name, rcol.column_name AS foreign_column_name, k.constraint_name
          FROM all_constraints cons
          JOIN all_cons_columns k ON cons.constraint_name = k.constraint_name AND cons.owner = k.owner
          JOIN all_constraints r ON cons.r_constraint_name = r.constraint_name AND cons.owner = r.owner
          JOIN all_cons_columns rcol ON r.constraint_name = rcol.constraint_name AND r.owner = rcol.owner
          WHERE cons.constraint_type = 'R' AND cons.table_name = :t AND cons.owner = USER`;
        const res = await conn.execute(sql, [tableName.toUpperCase()], { outFormat: require('oracledb').OUT_FORMAT_OBJECT });
        return res.rows.map(r => ({
          columnName: r.COLUMN_NAME,
          foreignTable: r.FOREIGN_TABLE_NAME,
          foreignColumn: r.FOREIGN_COLUMN_NAME,
          constraintName: r.CONSTRAINT_NAME,
        }));
      } finally {
        try { await conn.close(); } catch (e) {}
      }
    } else if (this.dialect === 'mongodb') {
      // Heuristic: fields that end with _id and contain objectId values
      const coll = this.pool.db.collection(tableName);
      const doc = await coll.findOne({});
      if (!doc) return [];
      const fks = [];
      for (const key of Object.keys(doc)) {
        if (key.endsWith('_id')) {
          const val = doc[key];
          const isObjectId = val && (val._bsontype === 'objectid' || val.constructor?.name?.toLowerCase() === 'objectid');
          if (isObjectId) {
            fks.push({ columnName: key, foreignTable: key.replace(/_id$/, ''), foreignColumn: '_id', constraintName: null });
          }
        }
      }
      return fks;
    } else {
      const sql = `
        SELECT
          k.COLUMN_NAME AS column_name,
          k.REFERENCED_TABLE_NAME AS foreign_table_name,
          k.REFERENCED_COLUMN_NAME AS foreign_column_name,
          k.CONSTRAINT_NAME AS constraint_name
        FROM information_schema.key_column_usage k
        WHERE k.TABLE_SCHEMA = ?
        AND k.TABLE_NAME = ?
        AND k.REFERENCED_TABLE_NAME IS NOT NULL;
      `;
      const [rows] = await this.pool.query(sql, [this.database, tableName]);
      return rows.map(row => ({
        columnName: row.column_name || row.COLUMN_NAME,
        foreignTable: row.foreign_table_name || row.REFERENCED_TABLE_NAME,
        // MySQL alias is 'foreign_column_name' (or REFERENCED_COLUMN_NAME); ensure we map it correctly
        foreignColumn: row.foreign_column_name || row.REFERENCED_COLUMN_NAME,
        constraintName: row.constraint_name || row.CONSTRAINT_NAME,
      }));
    }
  }

  /**
   * Get reverse foreign keys (tables that reference this table)
   * @param {string} tableName - Table name
   * @returns {Promise<Array>} List of reverse foreign key relationships
   */
  async getReverseForeignKeys(tableName) {
    if (this.dialect === 'postgres') {
      const query = `
        SELECT
          tc.table_name AS referencing_table,
          kcu.column_name AS referencing_column,
          ccu.column_name AS referenced_column,
          tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = $1
        AND tc.table_schema = 'public';
      `;
      const result = await this.pool.query(query, [tableName]);
      return result.rows.map(row => ({
        referencingTable: row.referencing_table,
        referencingColumn: row.referencing_column,
        referencedColumn: row.referenced_column,
        constraintName: row.constraint_name,
      }));
    } else if (this.dialect === 'oracle') {
      const conn = await this.pool.getConnection();
      try {
        const sql = `
          SELECT a.table_name AS referencing_table, a.column_name AS referencing_column, c.column_name AS referenced_column, a.constraint_name
          FROM all_cons_columns a
          JOIN all_constraints b ON a.owner = b.owner AND a.constraint_name = b.constraint_name
          JOIN all_cons_columns c ON b.r_owner = c.owner AND b.r_constraint_name = c.constraint_name
          WHERE b.constraint_type = 'R' AND c.table_name = :t AND b.owner = USER`;
        const res = await conn.execute(sql, [tableName.toUpperCase()], { outFormat: require('oracledb').OUT_FORMAT_OBJECT });
        return res.rows.map(r => ({
          referencingTable: r.REFERENCING_TABLE,
          referencingColumn: r.REFERENCING_COLUMN,
          referencedColumn: r.REFERENCED_COLUMN,
          constraintName: r.CONSTRAINT_NAME,
        }));
      } finally {
        try { await conn.close(); } catch (e) {}
      }
    } else if (this.dialect === 'mongodb') {
      // Heuristic: search a few collections for fields referencing this collection (ending with _id)
      const all = await this.pool.db.listCollections().toArray();
      const refs = [];
      for (const c of all) {
        const coll = this.pool.db.collection(c.name);
        const doc = await coll.findOne({ [ `${tableName.replace(/s$/, '')}_id` ]: { $exists: true } });
        if (doc) {
          refs.push({ referencingTable: c.name, referencingColumn: `${tableName.replace(/s$/, '')}_id`, referencedColumn: '_id', constraintName: null });
        }
      }
      return refs;
    } else {
      const sql = `
        SELECT
          k.TABLE_NAME AS referencing_table,
          k.COLUMN_NAME AS referencing_column,
          k.REFERENCED_COLUMN_NAME AS referenced_column,
          k.CONSTRAINT_NAME AS constraint_name
        FROM information_schema.key_column_usage k
        WHERE k.TABLE_SCHEMA = ?
        AND k.REFERENCED_TABLE_NAME = ?;
      `;
      const [rows] = await this.pool.query(sql, [this.database, tableName]);
      return rows.map(row => ({
        referencingTable: row.referencing_table || row.TABLE_NAME,
        referencingColumn: row.referencing_column || row.COLUMN_NAME,
        referencedColumn: row.referenced_column || row.REFERENCED_COLUMN_NAME,
        constraintName: row.constraint_name || row.CONSTRAINT_NAME,
      }));
    }
  }

  /**
   * Get cached schema
   * @returns {object|null} Cached schema or null
   */
  getCache() {
    return this.schemaCache;
  }

  /**
   * Clear schema cache
   */
  clearCache() {
    this.schemaCache = null;
  }
}

module.exports = SchemaInspector;
