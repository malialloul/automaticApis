export type DBType = 'postgres' | 'mysql' | 'mssql' | 'oracle' | 'mongodb' | 'local';

export interface ConnectionRow {
  id: string; // UUID
  user_id?: string | null;
  host?: string | null;
  port?: string | number | null;
  database?: string | null;
  user_name?: string | null;
  password?: string | null;
  type: DBType | string;
  uri?: string | null;
  is_local: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ColumnSchema {
  name: string;
  dataType?: string;
  isNullable?: boolean;
  default?: JSONValue;
  isPrimaryKey?: boolean;
}

export interface ForeignKeySchema {
  columnName: string;
  foreignTable: string;
  foreignColumn: string;
  onDelete?: string;
  onUpdate?: string;
}

export interface IndexSchema {
  name?: string;
  columns?: string[];
  isUnique?: boolean;
  isPrimary?: boolean;
  // allow additional index metadata but prefer typed JSON values
  [key: string]: JSONValue | undefined;
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  primaryKeys: string[];
  foreignKeys: ForeignKeySchema[];
  reverseForeignKeys?: Array<{ referencingTable: string; referencingColumn: string; referencedColumn: string }>;
  indexes?: IndexSchema[];
}

export interface SchemaMap {
  [table: string]: TableSchema;
}

export type DataStore = Map<string, Record<string, Record<string, JSONValue>[]>>; // connectionId -> { tableName: rows[] (each row is Record<string, JSONValue>) }

// JSON value types for typed DB rows and payloads
export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONValue[] | { [key: string]: JSONValue };

// Types for graph-based queries (used by Builder and execute/preview endpoints)
export interface GraphSource { table: string; alias?: string; field?: string }
export interface GraphJoinSide { table?: string; field?: string }
export interface GraphJoin {
  type?: 'LEFT' | 'INNER' | 'RIGHT' | string;
  from?: GraphJoinSide | string;
  to?: GraphJoinSide | string;
  fromTable?: string;
  toTable?: string;
  fromColumn?: string;
  toColumn?: string;
}
export type Operator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne' | 'like' | 'contains' | 'startswith' | 'endswith';
export interface GraphFilter { table?: string; source?: string; field?: string; op?: Operator; value?: JSONValue }
export interface GraphAgg { type?: string; func?: string; table?: string; field?: string; as?: string; alias?: string }
export interface Graph {
  source: GraphSource;
  joins?: GraphJoin[];
  filters?: GraphFilter[];
  aggregations?: GraphAgg[];
  outputFields?: Record<string, string[]>;
  fields?: string[];
  groupBy?: string[];
  orderBy?: Array<{ field: string; dir?: 'ASC' | 'DESC' }>;
  limit?: number;
  offset?: number;
}

export interface ExecuteResult {
  operation: string;
  results?: Array<{ table: string; insertedRow?: Record<string, JSONValue>; affectedRows?: number; insertId?: number; updated?: number; deleted?: number }>;
  updated?: number;
  deleted?: number;
  sql?: string;
  previewOnly?: boolean;
  limit?: number;
  rows?: Record<string, JSONValue>[];
}

// Normalized DB query result used across the codebase to avoid dialect-specific 'any'
export interface DBQueryResult<T extends Record<string, JSONValue> = Record<string, JSONValue>> {
  rows: T[];
  rowCount: number;
  fields?: Array<{ name: string; dataTypeID?: number }>; // dataTypeID available for Postgres
  insertId?: number | null; // mysql insertId
  affectedRows?: number | null; // mysql affected rows
  okPacket?: import('mysql2').OkPacket | null; // raw ok packet for advanced use
}

// Common response shapes for endpoints (used in route handler Response<> generics)
export type ListResponse<T> = T[];
export interface DDLResponse { success: boolean; message: string; sql?: string }
export interface SQLExecuteResponse { success: boolean; message: string; rowCount: number; rows: Record<string, JSONValue>[]; fields?: Array<{ name: string; dataTypeID?: number }> }
export interface DeleteResponse<T=Record<string, JSONValue>> { deleted: number; sql?: string; data?: T[]; message?: string }
export interface CreateResponse<T=Record<string, JSONValue>> { id?: number | string | null; row?: T; message?: string }

