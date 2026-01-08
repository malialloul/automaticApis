/**
 * QueryBuilder - Builds parameterized SQL queries to prevent SQL injection
 * Supports filtering, pagination, sorting, and complex queries
 */
class QueryBuilder {
  constructor(tableName, schema) {
    this.tableName = tableName;
    this.schema = schema;
    this.params = [];
    this.paramCounter = 1;
  }

  /**
   * Add a parameter and return its placeholder
   * @param {any} value - Parameter value
   * @returns {string} Placeholder like $1, $2, etc.
   */
  addParam(value) {
    this.params.push(value);
    return `$${this.paramCounter++}`;
  }

  /**
   * Build SELECT query with filters, pagination, and sorting
   * @param {object} options - Query options
   * @returns {object} Query object with text and values
   */
  buildSelect(options = {}) {
    const { filters = {}, limit, offset, orderBy, orderDir = 'ASC' } = options;

    let query = `SELECT * FROM ${this.sanitizeIdentifier(this.tableName)}`;

    // Build WHERE clause
    const whereClauses = [];
    for (const [column, value] of Object.entries(filters)) {
      if (this.isValidColumn(column)) {
        whereClauses.push(`${this.sanitizeIdentifier(column)} = ${this.addParam(value)}`);
      }
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    // Add ORDER BY
    if (orderBy && this.isValidColumn(orderBy)) {
      const direction = orderDir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query += ` ORDER BY ${this.sanitizeIdentifier(orderBy)} ${direction}`;
    }

    // Add pagination
    if (limit) {
      query += ` LIMIT ${this.addParam(parseInt(limit, 10))}`;
    }

    if (offset) {
      query += ` OFFSET ${this.addParam(parseInt(offset, 10))}`;
    }

    return { text: query, values: this.params };
  }

  /**
   * Build SELECT query for a single record by primary key
   * @param {any} id - Primary key value
   * @returns {object} Query object
   */
  buildSelectById(id) {
    const primaryKey = this.schema.primaryKeys[0]; // Assuming single primary key
    if (!primaryKey) {
      throw new Error(`No primary key found for table ${this.tableName}`);
    }

    const query = `SELECT * FROM ${this.sanitizeIdentifier(this.tableName)} WHERE ${this.sanitizeIdentifier(primaryKey)} = ${this.addParam(id)}`;
    return { text: query, values: this.params };
  }

  /**
   * Build INSERT query
   * @param {object} data - Data to insert
   * @returns {object} Query object
   */
  buildInsert(data) {
    const columns = [];
    const placeholders = [];

    for (const [column, value] of Object.entries(data)) {
      if (this.isValidColumn(column)) {
        columns.push(this.sanitizeIdentifier(column));
        placeholders.push(this.addParam(value));
      }
    }

    if (columns.length === 0) {
      throw new Error('No valid columns to insert');
    }

    const query = `INSERT INTO ${this.sanitizeIdentifier(this.tableName)} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    return { text: query, values: this.params };
  }

  /**
   * Build UPDATE query
   * @param {any} id - Primary key value
   * @param {object} data - Data to update
   * @returns {object} Query object
   */
  buildUpdate(id, data) {
    const primaryKey = this.schema.primaryKeys[0];
    if (!primaryKey) {
      throw new Error(`No primary key found for table ${this.tableName}`);
    }

    const setClauses = [];
    for (const [column, value] of Object.entries(data)) {
      if (this.isValidColumn(column) && column !== primaryKey) {
        setClauses.push(`${this.sanitizeIdentifier(column)} = ${this.addParam(value)}`);
      }
    }

    if (setClauses.length === 0) {
      throw new Error('No valid columns to update');
    }

    const query = `UPDATE ${this.sanitizeIdentifier(this.tableName)} SET ${setClauses.join(', ')} WHERE ${this.sanitizeIdentifier(primaryKey)} = ${this.addParam(id)} RETURNING *`;
    return { text: query, values: this.params };
  }

  /**
   * Build DELETE query
   * @param {any} id - Primary key value
   * @returns {object} Query object
   */
  buildDelete(id) {
    const primaryKey = this.schema.primaryKeys[0];
    if (!primaryKey) {
      throw new Error(`No primary key found for table ${this.tableName}`);
    }

    const query = `DELETE FROM ${this.sanitizeIdentifier(this.tableName)} WHERE ${this.sanitizeIdentifier(primaryKey)} = ${this.addParam(id)} RETURNING *`;
    return { text: query, values: this.params };
  }

  /**
   * Build query for related records via foreign key
   * @param {string} relatedTable - Related table name
   * @param {any} id - Primary key value of the parent record
   * @param {object} options - Query options (pagination, sorting)
   * @returns {object} Query object
   */
  buildRelatedQuery(relatedTable, id, options = {}) {
    const { limit, offset, orderBy, orderDir = 'ASC' } = options;

    // Find the foreign key relationship
    const relatedSchema = this.schema;
    let foreignKeyColumn = null;
    let isBelongsTo = false;

    // Check if this is a belongs-to relationship (this table has FK to related table)
    const fk = relatedSchema.foreignKeys?.find(fk => fk.foreignTable === relatedTable);
    if (fk) {
      // This is a belongs-to: SELECT * FROM relatedTable WHERE id = (SELECT fk FROM thisTable WHERE pk = id)
      const primaryKey = this.schema.primaryKeys[0];
      const subquery = `SELECT ${this.sanitizeIdentifier(fk.columnName)} FROM ${this.sanitizeIdentifier(this.tableName)} WHERE ${this.sanitizeIdentifier(primaryKey)} = ${this.addParam(id)}`;
      let query = `SELECT * FROM ${this.sanitizeIdentifier(relatedTable)} WHERE ${this.sanitizeIdentifier(fk.foreignColumn)} = (${subquery})`;

      if (orderBy) {
        const direction = orderDir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        query += ` ORDER BY ${this.sanitizeIdentifier(orderBy)} ${direction}`;
      }

      if (limit) {
        query += ` LIMIT ${this.addParam(parseInt(limit, 10))}`;
      }

      if (offset) {
        query += ` OFFSET ${this.addParam(parseInt(offset, 10))}`;
      }

      return { text: query, values: this.params };
    }

    // Check if this is a has-many relationship (related table has FK to this table)
    const reverseFk = relatedSchema.reverseForeignKeys?.find(rfk => rfk.referencingTable === relatedTable);
    if (reverseFk) {
      // This is a has-many: SELECT * FROM relatedTable WHERE fk = id
      let query = `SELECT * FROM ${this.sanitizeIdentifier(relatedTable)} WHERE ${this.sanitizeIdentifier(reverseFk.referencingColumn)} = ${this.addParam(id)}`;

      if (orderBy) {
        const direction = orderDir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        query += ` ORDER BY ${this.sanitizeIdentifier(orderBy)} ${direction}`;
      }

      if (limit) {
        query += ` LIMIT ${this.addParam(parseInt(limit, 10))}`;
      }

      if (offset) {
        query += ` OFFSET ${this.addParam(parseInt(offset, 10))}`;
      }

      return { text: query, values: this.params };
    }

    throw new Error(`No relationship found between ${this.tableName} and ${relatedTable}`);
  }

  /**
   * Check if a column exists in the schema
   * @param {string} columnName - Column name to check
   * @returns {boolean} True if valid
   */
  isValidColumn(columnName) {
    return this.schema.columns.some(col => col.name === columnName);
  }

  /**
   * Sanitize identifier (table/column name) to prevent SQL injection
   * @param {string} identifier - Identifier to sanitize
   * @returns {string} Sanitized identifier
   */
  sanitizeIdentifier(identifier) {
    // PostgreSQL reserved words to reject
    const reservedWords = new Set([
      'select', 'insert', 'update', 'delete', 'drop', 'create', 'alter', 'table',
      'database', 'schema', 'user', 'role', 'grant', 'revoke', 'union', 'where',
      'from', 'join', 'order', 'group', 'having', 'limit', 'offset', 'and', 'or', 'not'
    ]);
    
    // Only allow alphanumeric and underscore, must start with letter or underscore
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new Error(`Invalid identifier: ${identifier}`);
    }
    
    // Reject reserved words
    if (reservedWords.has(identifier.toLowerCase())) {
      throw new Error(`Cannot use reserved word as identifier: ${identifier}`);
    }
    
    // Reject PostgreSQL system tables/schemas
    if (identifier.toLowerCase().startsWith('pg_') || identifier.toLowerCase().startsWith('information_schema')) {
      throw new Error(`Cannot access system tables: ${identifier}`);
    }
    
    return `"${identifier}"`;
  }
}

module.exports = QueryBuilder;
