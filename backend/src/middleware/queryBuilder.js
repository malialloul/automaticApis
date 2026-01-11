/**
 * QueryBuilder - Builds parameterized SQL queries to prevent SQL injection
 * Supports filtering, pagination, sorting, and complex queries
 */
class QueryBuilder {
  constructor(tableName, schema, dialect = 'postgres') {
    this.tableName = tableName;
    this.schema = schema;
    this.dialect = dialect;
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
    if (this.dialect === 'mysql') {
      return '?';
    }
    return `$${this.paramCounter++}`;
  }

  // Get column type for a column name (lowercased), or null if not found
  getColumnType(columnName) {
    const col = this.schema.columns.find(c => c.name === columnName);
    if (!col) return null;
    return col.type ? String(col.type).toLowerCase() : null;
  }

  /**
   * Build SELECT query with filters, pagination, and sorting
   * @param {object} options - Query options
   * @returns {object} Query object with text and values
   */
  buildSelect(options = {}) {
    const { filters = {}, limit, offset, orderBy, orderDir = 'ASC' } = options;

    let query = `SELECT * FROM ${this.sanitizeIdentifier(this.tableName)}`;

    // Build WHERE clause, support operator suffixes: __gt, __gte, __lt, __lte, __like
    const whereClauses = [];
    for (const [rawColumn, value] of Object.entries(filters)) {
      // detect operator suffix
      const opMatch = rawColumn.match(/(.+?)__(gt|gte|lt|lte|like)$/);
      if (opMatch) {
        const column = opMatch[1];
        const op = opMatch[2];
        if (!this.isValidColumn(column)) continue;
        if (op === 'like') {
          whereClauses.push(`${this.sanitizeIdentifier(column)} LIKE ${this.addParam(value)}`);
        } else {
          const map = { gt: '>', gte: '>=', lt: '<', lte: '<=' };
          const sqlOp = map[op] || '=';
          whereClauses.push(`${this.sanitizeIdentifier(column)} ${sqlOp} ${this.addParam(value)}`);
        }
      } else {
        // no operator suffix, direct column equality
        const column = rawColumn;
        if (!this.isValidColumn(column)) continue;
        const colType = this.getColumnType(column) || '';
        if (colType.includes('json')) {
          // value must be valid JSON to compare against a json/jsonb column; compare using jsonb when possible
          try {
            // allow objects/arrays and JSON strings
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            // store JSON string param and cast to jsonb for comparison
            whereClauses.push(`${this.sanitizeIdentifier(column)}::jsonb = ${this.addParam(JSON.stringify(parsed))}::jsonb`);
          } catch (e) {
            // Fallback: compare JSON column text representation to scalar value (permissive)
            whereClauses.push(`${this.sanitizeIdentifier(column)}::text = ${this.addParam(value)}`);
          }
        } else {
          whereClauses.push(`${this.sanitizeIdentifier(column)} = ${this.addParam(value)}`);
        }
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

    const base = `INSERT INTO ${this.sanitizeIdentifier(this.tableName)} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
    if (this.dialect === 'postgres') {
      return { text: `${base} RETURNING *`, values: this.params };
    }
    return { text: base, values: this.params };
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

    const base = `UPDATE ${this.sanitizeIdentifier(this.tableName)} SET ${setClauses.join(', ')} WHERE ${this.sanitizeIdentifier(primaryKey)} = ${this.addParam(id)}`;
    if (this.dialect === 'postgres') {
      return { text: `${base} RETURNING *`, values: this.params };
    }
    return { text: base, values: this.params };
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

    const base = `DELETE FROM ${this.sanitizeIdentifier(this.tableName)} WHERE ${this.sanitizeIdentifier(primaryKey)} = ${this.addParam(id)}`;
    if (this.dialect === 'postgres') {
      return { text: `${base} RETURNING *`, values: this.params };
    }
    return { text: base, values: this.params };
  }

  /**
   * Build DELETE query using filter object (supports operator suffixes)
   * @param {object} filters - Filter map possibly containing operator suffixes
   * @returns {object} Query object
   */
  buildDeleteWhere(filters = {}) {
    const whereClauses = [];
    for (const [rawColumn, value] of Object.entries(filters)) {
      const opMatch = rawColumn.match(/(.+?)__(gt|gte|lt|lte|like)$/);
      if (opMatch) {
        const column = opMatch[1];
        const op = opMatch[2];
        if (!this.isValidColumn(column)) continue;
        if (op === 'like') {
          whereClauses.push(`${this.sanitizeIdentifier(column)} LIKE ${this.addParam(value)}`);
        } else {
          const map = { gt: '>', gte: '>=', lt: '<', lte: '<=' };
          const sqlOp = map[op] || '=';
          whereClauses.push(`${this.sanitizeIdentifier(column)} ${sqlOp} ${this.addParam(value)}`);
        }
      } else {
        const column = rawColumn;
        if (!this.isValidColumn(column)) continue;
        const colType = this.getColumnType(column) || '';
        if (colType.includes('json')) {
          try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            whereClauses.push(`${this.sanitizeIdentifier(column)}::jsonb = ${this.addParam(JSON.stringify(parsed))}::jsonb`);
          } catch (e) {
            // Fallback: compare JSON column text representation to scalar value (permissive)
            whereClauses.push(`${this.sanitizeIdentifier(column)}::text = ${this.addParam(value)}`);
          }
        } else {
          whereClauses.push(`${this.sanitizeIdentifier(column)} = ${this.addParam(value)}`);
        }
      }
    }

    if (whereClauses.length === 0) {
      throw new Error('Refusing to run DELETE without filters');
    }

    let query = `DELETE FROM ${this.sanitizeIdentifier(this.tableName)} WHERE ${whereClauses.join(' AND ')}`;
    if (this.dialect === 'postgres') {
      query += ' RETURNING *';
    }
    return { text: query, values: this.params };
  }

  /**
   * Build query for related records via foreign key
   * @param {string} relatedTable - Related table name
   * @param {any} id - Primary key value of the parent record
   * @param {object} options - Query options (pagination, sorting)
   * @returns {object} Query object
   */
  buildRelatedQuery(relatedTable, id, options = {}, fkColumn = null) {
    const { limit, offset, orderBy, orderDir = 'ASC' } = options;
    const relatedSchema = this.schema;

    // If fkColumn is provided, use it to find the correct FK or reverse FK
    if (fkColumn) {
      // Check if this table has FK to relatedTable via fkColumn
      const fk = relatedSchema.foreignKeys?.find(fk => fk.foreignTable === relatedTable && fk.columnName === fkColumn);
      if (fk) {
        // e.g., SELECT * FROM relatedTable WHERE id = (SELECT fk FROM thisTable WHERE fkCol = id)
        const subquery = `SELECT ${this.sanitizeIdentifier(fk.columnName)} FROM ${this.sanitizeIdentifier(this.tableName)} WHERE ${this.sanitizeIdentifier(fk.columnName)} = ${this.addParam(id)}`;
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
      // Check if relatedTable has FK to this table via fkColumn (reverse FK)
      const reverseFk = relatedSchema.reverseForeignKeys?.find(rfk => rfk.referencingTable === relatedTable && rfk.referencedColumn === fkColumn);
      if (reverseFk) {
        // e.g., SELECT * FROM relatedTable WHERE referencingColumn = id
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
    }

    // Fallback: try to find any FK or reverse FK (legacy)
    const fk = relatedSchema.foreignKeys?.find(fk => fk.foreignTable === relatedTable);
    if (fk) {
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
    const reverseFk = relatedSchema.reverseForeignKeys?.find(rfk => rfk.referencingTable === relatedTable);
    if (reverseFk) {
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
    // Only allow alphanumeric and underscore, must start with letter or underscore
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new Error(`Invalid identifier: ${identifier}`);
    }

    // Reject system tables/schemas
    if (identifier.toLowerCase().startsWith('pg_') || identifier.toLowerCase().startsWith('information_schema')) {
      throw new Error(`Cannot access system tables: ${identifier}`);
    }

    // Always quote identifiers to allow reserved words and prevent SQL injection
    if (this.dialect === 'mysql') {
      return `\`${identifier}\``;
    }
    return `"${identifier}"`;
  }
}

module.exports = QueryBuilder;
