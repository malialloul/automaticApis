import { Pool, QueryResult } from 'pg';
import mysql, { RowDataPacket } from 'mysql2/promise';
import { SchemaMap, TableSchema, ColumnSchema } from '../types';

type PostgresPool = Pool;
type MysqlPool = mysql.Pool;
export type DBPool = PostgresPool | MysqlPool;

export default class SchemaInspector {
  private pool: DBPool;
  private dialect: string;
  private database: string | null;
  private schemaCache: SchemaMap | null;

  constructor(pool: DBPool, dialect: string = 'postgres', database: string | null = null) {
    this.pool = pool;
    this.dialect = (dialect || 'postgres').toLowerCase();
    this.database = database;
    this.schemaCache = null;
  }

  async introspect(): Promise<SchemaMap> {
    const tables = await this.getTables();
    const schema: SchemaMap = {};

    for (const table of tables) {
      const tableName = table.table_name || ''; // result row
      const columns = await this.getColumns(tableName);
      const primaryKeys = await this.getPrimaryKeys(tableName);
      const foreignKeys = await this.getForeignKeys(tableName);
      const reverseForeignKeys = await this.getReverseForeignKeys(tableName);

      schema[tableName] = {
        name: tableName,
        columns,
        primaryKeys,
        foreignKeys,
        reverseForeignKeys,
      } as TableSchema;
    }

    this.schemaCache = schema;
    return schema;
  }

  async getTables(): Promise<Array<{ table_name: string }>> {
    if (this.dialect === 'postgres') {
      const query = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `;
      const result = await (this.pool as PostgresPool).query<{ table_name: string }>(query);
      return result.rows;
    } else {
      const sql = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ?
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `;
      const [rows] = await (this.pool as MysqlPool).query<RowDataPacket[]>(sql, [this.database]);
      return rows.map((r: RowDataPacket) => ({ table_name: (r.table_name as string) || (r.TABLE_NAME as string) }));
    }
  }

  async getColumns(tableName: string): Promise<Array<ColumnSchema & { maxLength?: number | null; precision?: number | null; scale?: number | null; enumOptions?: string[]; udtName?: string; isAutoIncrement?: boolean }>> {
    if (this.dialect === 'postgres') {
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
      const result = await (this.pool as PostgresPool).query<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default?: string | null;
        character_maximum_length?: number | null;
        numeric_precision?: number | null;
        numeric_scale?: number | null;
        udt_name?: string;
      }>(query, [tableName]);

      const enumCols = result.rows.filter(col => col.data_type === 'USER-DEFINED');
      const enumOptionsMap: Record<string, string[]> = {};
      const enumTypeMap: Record<string, string> = {};
      if (enumCols.length > 0) {
        for (const col of enumCols) {
          enumTypeMap[col.column_name] = col.udt_name || '';
          const enumRes = await (this.pool as PostgresPool).query<{ enumlabel: string }>(
            `SELECT enumlabel FROM pg_enum WHERE enumtypid = (
              SELECT oid FROM pg_type WHERE typname = $1
            ) ORDER BY enumsortorder;`,
            [col.udt_name]
          );
          enumOptionsMap[col.column_name] = enumRes.rows.map(r => r.enumlabel);
        }
      }

      const autoIncRes = await (this.pool as PostgresPool).query<{ column_name: string }>(
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
        dataType: col.data_type,
        isNullable: col.is_nullable === 'YES',
        default: col.column_default ?? null,
        maxLength: col.character_maximum_length ?? null,
        precision: col.numeric_precision ?? null,
        scale: col.numeric_scale ?? null,
        enumOptions: enumOptionsMap[col.column_name] || undefined,
        udtName: enumTypeMap[col.column_name] || (col.data_type === 'USER-DEFINED' ? col.udt_name : undefined),
        isAutoIncrement: autoIncCols.has(col.column_name),
      }));
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
      const [rows] = await (this.pool as MysqlPool).query<RowDataPacket[]>(sql, [this.database, tableName]);
      return rows.map((col: RowDataPacket) => {
        const name = (col as RowDataPacket).column_name || (col as RowDataPacket).COLUMN_NAME;
        const type = (col as RowDataPacket).data_type || (col as RowDataPacket).DATA_TYPE;
        let enumOptions;
        if (type === 'enum' && ((col as RowDataPacket).column_type || (col as RowDataPacket).COLUMN_TYPE)) {
          const match = ((col as RowDataPacket).column_type || (col as RowDataPacket).COLUMN_TYPE).match(/^enum\((.*)\)$/i);
          if (match && match[1]) {
            enumOptions = match[1].split(/','/).map((s: string) => s.replace(/^'/, '').replace(/'$/, ''));
          }
        }
        const isAutoIncrement = (((col as RowDataPacket).extra || (col as RowDataPacket).EXTRA) + '').toLowerCase().includes('auto_increment');
        return {
          name,
          dataType: type,
          isNullable: ((col as RowDataPacket).is_nullable || (col as RowDataPacket).IS_NULLABLE) === 'YES',
          default: (col as RowDataPacket).column_default || (col as RowDataPacket).COLUMN_DEFAULT,
          maxLength: (col as RowDataPacket).character_maximum_length || (col as RowDataPacket).CHARACTER_MAXIMUM_LENGTH,
          precision: (col as RowDataPacket).numeric_precision || (col as RowDataPacket).NUMERIC_PRECISION,
          scale: (col as RowDataPacket).numeric_scale || (col as RowDataPacket).NUMERIC_SCALE,
          enumOptions,
          isAutoIncrement,
        };
      });
    }
  }

  async getPrimaryKeys(tableName: string) {
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
      const result = await (this.pool as PostgresPool).query<{ column_name: string }>(query, [tableName]);
      return result.rows.map((row) => row.column_name);
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
      const [rows] = await (this.pool as MysqlPool).query<RowDataPacket[]>(sql, [this.database, tableName]);
      return rows.map((r: RowDataPacket) => (r.column_name as string) || (r.COLUMN_NAME as string));
    }
  }

  async getForeignKeys(tableName: string) {
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
      const result = await (this.pool as PostgresPool).query<{ column_name: string; foreign_table_name: string; foreign_column_name: string; constraint_name: string }>(query, [tableName]);
      return result.rows.map((row) => ({
        columnName: row.column_name,
        foreignTable: row.foreign_table_name,
        foreignColumn: row.foreign_column_name,
        constraintName: row.constraint_name,
      }));
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
      const [rows] = await (this.pool as MysqlPool).query<RowDataPacket[]>(sql, [this.database, tableName]);
      return rows.map((row: RowDataPacket) => ({
        columnName: (row.column_name as string) || (row.COLUMN_NAME as string),
        foreignTable: (row.foreign_table_name as string) || (row.REFERENCED_TABLE_NAME as string),
        foreignColumn: (row.foreign_column_name as string) || (row.REFERENCED_COLUMN_NAME as string),
        constraintName: (row.constraint_name as string) || (row.CONSTRAINT_NAME as string),
      }));
    }
  }

  async getReverseForeignKeys(tableName: string) {
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
      const result = await (this.pool as PostgresPool).query<{ referencing_table: string; referencing_column: string; referenced_column: string; constraint_name: string }>(query, [tableName]);
      return result.rows.map((row) => ({
        referencingTable: row.referencing_table,
        referencingColumn: row.referencing_column,
        referencedColumn: row.referenced_column,
        constraintName: row.constraint_name,
      }));
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
      const [rows] = await (this.pool as MysqlPool).query<RowDataPacket[]>(sql, [this.database, tableName]);
      return rows.map((row: RowDataPacket) => ({
        referencingTable: (row.referencing_table as string) || (row.TABLE_NAME as string),
        referencingColumn: (row.referencing_column as string) || (row.COLUMN_NAME as string),
        referencedColumn: (row.referenced_column as string) || (row.REFERENCED_COLUMN_NAME as string),
        constraintName: (row.constraint_name as string) || (row.CONSTRAINT_NAME as string),
      }));
    }
  }

  getCache() {
    return this.schemaCache;
  }

  clearCache() {
    this.schemaCache = null;
  }
}
