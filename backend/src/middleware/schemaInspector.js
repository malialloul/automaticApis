/**
 * SchemaInspector - Introspects PostgreSQL database schema
 * Discovers tables, columns, primary keys, and foreign key relationships
 */
class SchemaInspector {
  constructor(pool) {
    this.pool = pool;
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
   * Get all tables in the database
   * @returns {Promise<Array>} List of tables
   */
  async getTables() {
    const query = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    const result = await this.pool.query(query);
    return result.rows;
  }

  /**
   * Get columns for a specific table
   * @param {string} tableName - Table name
   * @returns {Promise<Array>} List of columns with metadata
   */
  async getColumns(tableName) {
    const query = `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = $1
      ORDER BY ordinal_position;
    `;

    const result = await this.pool.query(query, [tableName]);
    return result.rows.map(col => ({
      name: col.column_name,
      type: col.data_type,
      nullable: col.is_nullable === 'YES',
      default: col.column_default,
      maxLength: col.character_maximum_length,
      precision: col.numeric_precision,
      scale: col.numeric_scale,
    }));
  }

  /**
   * Get primary keys for a table
   * @param {string} tableName - Table name
   * @returns {Promise<Array>} List of primary key columns
   */
  async getPrimaryKeys(tableName) {
    const query = `
      SELECT a.attname as column_name
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass
      AND i.indisprimary;
    `;

    const result = await this.pool.query(query, [tableName]);
    return result.rows.map(row => row.column_name);
  }

  /**
   * Get foreign keys for a table (relationships this table has to other tables)
   * @param {string} tableName - Table name
   * @returns {Promise<Array>} List of foreign key relationships
   */
  async getForeignKeys(tableName) {
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
  }

  /**
   * Get reverse foreign keys (tables that reference this table)
   * @param {string} tableName - Table name
   * @returns {Promise<Array>} List of reverse foreign key relationships
   */
  async getReverseForeignKeys(tableName) {
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
