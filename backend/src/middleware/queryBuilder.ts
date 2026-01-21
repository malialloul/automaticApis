import { TableSchema, JSONValue } from '../types';

export interface QueryObject {
  text: string;
  values: Array<string | number | boolean | null>;
}

export default class QueryBuilder {
  private tableName: string;
  private schema: TableSchema;
  private dialect: string;
  private params: Array<string | number | boolean | null>;
  private paramCounter: number;

  constructor(tableName: string, schema: TableSchema, dialect = 'postgres') {
    this.tableName = tableName;
    this.schema = schema;
    this.dialect = (dialect || 'postgres').toLowerCase();
    this.params = [];
    this.paramCounter = 1;
  }

  public getParams(): Array<string | number | boolean | null> {
    return this.params;
  }

  convertTimestampForDialect(value: string | number | Date | null): string | number | Date | null {
    if (this.dialect !== 'mysql') return value;
    if (typeof value !== 'string') return value;

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        }
      } catch {
        // fallback
      }
    }
    return value;
  }

  private normalizeParam(value: JSONValue): string | number | boolean | null {
    if (value === null) return null;
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    return String(value);
  }

  addParam(value: string | number | boolean | null): string {
    const convertedValue = this.convertTimestampForDialect(value as string | number | Date | null) as string | number | boolean | null;
    this.params.push(convertedValue);
    if (this.dialect === 'mysql') {
      return '?';
    }
    return `$${this.paramCounter++}`;
  }

  getColumnType(columnName: string): string | null {
    const col = this.schema.columns.find(c => c.name === columnName);
    if (!col) return null;
    return (col.dataType || '').toString().toLowerCase();
  }

  buildSelect(options: { filters?: Record<string, JSONValue>; limit?: number | string; offset?: number | string; orderBy?: string; orderDir?: string } = {}): QueryObject {
    const { filters = {}, limit, offset, orderBy, orderDir = 'ASC' } = options;

    const OP_LIKE_OPS: Array<import('../types').Operator> = ['like', 'contains', 'startswith', 'endswith'];
    const MAP_OPS: Record<import('../types').Operator, string> = { gt: '>', gte: '>=', lt: '<', lte: '<=', eq: '=', ne: '!=' , like: 'LIKE', contains: 'LIKE', startswith: 'LIKE', endswith: 'LIKE' };

    let query = `SELECT * FROM ${this.sanitizeIdentifier(this.tableName)}`;
    const whereClauses: string[] = [];

    for (const [rawColumn, value] of Object.entries(filters)) {
      const opMatch = rawColumn.match(/(.+?)__(gt|gte|lt|lte|eq|ne|like|contains|startswith|endswith)$/);
      if (opMatch) {
        const column = opMatch[1];
        const op = opMatch[2] as import('../types').Operator;
        if (!this.isValidColumn(column)) continue;
        if (OP_LIKE_OPS.includes(op as import('../types').Operator)) {
          let v = value as string;
          if (op === 'contains') v = `%${value}%`;
          else if (op === 'startswith') v = `${value}%`;
          else if (op === 'endswith') v = `%${value}`;
          whereClauses.push(`${this.sanitizeIdentifier(column)} LIKE ${this.addParam(v)}`);
        } else {
          const sqlOp = MAP_OPS[op] || '=';
          whereClauses.push(`${this.sanitizeIdentifier(column)} ${sqlOp} ${this.addParam(this.normalizeParam(value as JSONValue))}`);
        }
      } else {
        const column = rawColumn;
        if (!this.isValidColumn(column)) continue;
        const colType = this.getColumnType(column) || '';
        if (colType.includes('json')) {
          if (this.dialect === 'postgres') {
            try {
              const parsed = typeof value === 'string' ? JSON.parse(value) : value;
              whereClauses.push(`${this.sanitizeIdentifier(column)}::jsonb = ${this.addParam(JSON.stringify(parsed))}::jsonb`);
            } catch (e) {
              whereClauses.push(`${this.sanitizeIdentifier(column)}::text = ${this.addParam(String(value))}`);
            }
          } else if (this.dialect === 'mysql') {
            try {
              const parsed = typeof value === 'string' ? JSON.parse(value) : value;
              whereClauses.push(`${this.sanitizeIdentifier(column)} = CAST(${this.addParam(JSON.stringify(parsed))} AS JSON)`);
            } catch (e) {
              whereClauses.push(`CAST(${this.sanitizeIdentifier(column)} AS CHAR) = ${this.addParam(String(value))}`);
            }
          } else {
            whereClauses.push(`${this.sanitizeIdentifier(column)} = ${this.addParam(String(value))}`);
          }
        } else {
          whereClauses.push(`${this.sanitizeIdentifier(column)} = ${this.addParam(String(value))}`);
        }
      }
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    if (orderBy && this.isValidColumn(orderBy)) {
      const direction = (orderDir || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query += ` ORDER BY ${this.sanitizeIdentifier(orderBy)} ${direction}`;
    }

    if (limit) {
      query += ` LIMIT ${this.addParam(Number(limit))}`;
    }

    if (offset) {
      query += ` OFFSET ${this.addParam(Number(offset))}`;
    }

    return { text: query, values: this.params };
  }

  buildSelectById(id: string | number): QueryObject {
    const primaryKey = this.schema.primaryKeys[0];
    if (!primaryKey) throw new Error(`No primary key found for table ${this.tableName}`);
    const query = `SELECT * FROM ${this.sanitizeIdentifier(this.tableName)} WHERE ${this.sanitizeIdentifier(primaryKey)} = ${this.addParam(id)}`;
    return { text: query, values: this.params };
  }

  buildInsert(data: Record<string, JSONValue>): QueryObject {
    const columns: string[] = [];
    const placeholders: string[] = [];
    for (const [column, value] of Object.entries(data)) {
      if (this.isValidColumn(column)) {
        columns.push(this.sanitizeIdentifier(column));
        placeholders.push(this.addParam(this.normalizeParam(value as JSONValue)));
      }
    }

    if (columns.length === 0) throw new Error('No valid columns to insert');
    const base = `INSERT INTO ${this.sanitizeIdentifier(this.tableName)} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
    if (this.dialect === 'postgres') return { text: `${base} RETURNING *`, values: this.params };
    return { text: base, values: this.params };
  }

  buildUpdate(id: string | number, data: Record<string, JSONValue>): QueryObject {
    const primaryKey = this.schema.primaryKeys[0];
    if (!primaryKey) throw new Error(`No primary key found for table ${this.tableName}`);
    const setClauses: string[] = [];
    for (const [column, value] of Object.entries(data)) {
      if (this.isValidColumn(column) && column !== primaryKey) {
        setClauses.push(`${this.sanitizeIdentifier(column)} = ${this.addParam(this.normalizeParam(value as JSONValue))}`);
      }
    }

    if (setClauses.length === 0) throw new Error('No valid columns to update');
    const base = `UPDATE ${this.sanitizeIdentifier(this.tableName)} SET ${setClauses.join(', ')} WHERE ${this.sanitizeIdentifier(primaryKey)} = ${this.addParam(id)}`;
    if (this.dialect === 'postgres') return { text: `${base} RETURNING *`, values: this.params };
    return { text: base, values: this.params };
  }

  buildDelete(id: string | number): QueryObject {
    const primaryKey = this.schema.primaryKeys[0];
    if (!primaryKey) throw new Error(`No primary key found for table ${this.tableName}`);
    const base = `DELETE FROM ${this.sanitizeIdentifier(this.tableName)} WHERE ${this.sanitizeIdentifier(primaryKey)} = ${this.addParam(id)}`;
    if (this.dialect === 'postgres') return { text: `${base} RETURNING *`, values: this.params };
    return { text: base, values: this.params };
  }

  buildDeleteWhere(filters: Record<string, JSONValue> = {}): QueryObject {
    const whereClauses: string[] = [];
    for (const [rawColumn, value] of Object.entries(filters)) {
      const opMatch = rawColumn.match(/(.+?)__(gt|gte|lt|lte|like|contains|startswith|endswith)$/);
      if (opMatch) {
        const column = opMatch[1];
        const op = opMatch[2];
        if (!this.isValidColumn(column)) continue;
        if (['like','contains','startswith','endswith'].includes(op)) {
          let v = value as string;
          if (op === 'contains') v = `%${value}%`;
          else if (op === 'startswith') v = `${value}%`;
          else if (op === 'endswith') v = `%${value}`;
          whereClauses.push(`${this.sanitizeIdentifier(column)} LIKE ${this.addParam(v)}`);
        } else {
          const map: Record<string, string> = { gt: '>', gte: '>=', lt: '<', lte: '<=' };
          const sqlOp = map[op] || '=';
          whereClauses.push(`${this.sanitizeIdentifier(column)} ${sqlOp} ${this.addParam(this.normalizeParam(value as JSONValue))}`);
        }
      } else {
        const column = rawColumn;
        if (!this.isValidColumn(column)) continue;
        const colType = this.getColumnType(column) || '';
        if (colType.includes('json')) {
          if (this.dialect === 'postgres') {
            try {
              const parsed = typeof value === 'string' ? JSON.parse(value) : value;
              whereClauses.push(`${this.sanitizeIdentifier(column)}::jsonb = ${this.addParam(JSON.stringify(parsed))}::jsonb`);
            } catch (e) {
              whereClauses.push(`${this.sanitizeIdentifier(column)}::text = ${this.addParam(String(value))}`);
            }
          } else if (this.dialect === 'mysql') {
            try {
              const parsed = typeof value === 'string' ? JSON.parse(value) : value;
              whereClauses.push(`${this.sanitizeIdentifier(column)} = CAST(${this.addParam(JSON.stringify(parsed))} AS JSON)`);
            } catch (e) {
              whereClauses.push(`CAST(${this.sanitizeIdentifier(column)} AS CHAR) = ${this.addParam(String(value))}`);
            }
          } else {
            whereClauses.push(`${this.sanitizeIdentifier(column)} = ${this.addParam(String(value))}`);
          }
        } else {
          whereClauses.push(`${this.sanitizeIdentifier(column)} = ${this.addParam(String(value))}`);
        }
      }
    }

    if (whereClauses.length === 0) throw new Error('Refusing to run DELETE without filters');

    let query = `DELETE FROM ${this.sanitizeIdentifier(this.tableName)} WHERE ${whereClauses.join(' AND ')}`;
    if (this.dialect === 'postgres') query += ' RETURNING *';
    return { text: query, values: this.params };
  }

  buildRelatedQuery(relatedTable: string, id: string | number, options: { limit?: number | string; offset?: number | string; orderBy?: string; orderDir?: string } = {}, fkColumn: string | null = null): QueryObject {
    const { limit, offset, orderBy, orderDir = 'ASC' } = options;
    const relatedSchema = this.schema;

    if (fkColumn) {
      const fk = relatedSchema.foreignKeys?.find(fk => fk.foreignTable === relatedTable && fk.columnName === fkColumn);
      if (fk) {
        let query = `SELECT * FROM ${this.sanitizeIdentifier(relatedTable)} WHERE ${this.sanitizeIdentifier(fk.foreignColumn)} = ${this.addParam(id)}`;
        if (orderBy) {
          const direction = orderDir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
          query += ` ORDER BY ${this.sanitizeIdentifier(orderBy)} ${direction}`;
        }
        if (limit) {
          query += ` LIMIT ${this.addParam(Number(limit))}`;
        }
        if (offset) {
          query += ` OFFSET ${this.addParam(Number(offset))}`;
        }
        return { text: query, values: this.params };
      }
      const reverseFk = relatedSchema.reverseForeignKeys?.find(rfk => rfk.referencingTable === relatedTable && rfk.referencedColumn === fkColumn);
      if (reverseFk) {
        let query = `SELECT * FROM ${this.sanitizeIdentifier(relatedTable)} WHERE ${this.sanitizeIdentifier(reverseFk.referencingColumn)} = ${this.addParam(id)}`;
        if (orderBy) {
          const direction = orderDir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
          query += ` ORDER BY ${this.sanitizeIdentifier(orderBy)} ${direction}`;
        }
        if (limit) {
          query += ` LIMIT ${this.addParam(Number(limit))}`;
        }
        if (offset) {
          query += ` OFFSET ${this.addParam(Number(offset))}`;
        }
        return { text: query, values: this.params };
      }
    }

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
        query += ` LIMIT ${this.addParam(Number(limit))}`;
      }
      if (offset) {
        query += ` OFFSET ${this.addParam(Number(offset))}`;
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
        query += ` LIMIT ${this.addParam(Number(limit))}`;
      }
      if (offset) {
        query += ` OFFSET ${this.addParam(Number(offset))}`;
      }
      return { text: query, values: this.params };
    }
    throw new Error(`No relationship found between ${this.tableName} and ${relatedTable}`);
  }

  isValidColumn(columnName: string): boolean {
    return this.schema.columns.some(col => col.name === columnName);
  }

  sanitizeIdentifier(identifier: string): string {
    if (typeof identifier !== 'string' || identifier.trim() === '') {
      throw new Error(`Invalid identifier (not a non-empty string): ${String(identifier)}`);
    }

    if (/[;"'`]/.test(identifier)) {
      throw new Error(`Invalid identifier (contains forbidden characters): ${identifier}`);
    }

    const lower = identifier.toLowerCase();
    if (lower.startsWith('pg_') || lower.startsWith('information_schema')) {
      throw new Error(`Cannot access system tables: ${identifier}`);
    }

    if (this.dialect === 'mysql') {
      return `\`${identifier}\``;
    }
    return `"${identifier}"`;
  }
}

module.exports = QueryBuilder;