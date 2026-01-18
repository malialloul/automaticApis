/**
 * Auto-generated TypeScript models from OpenAPI specification
 * Generated for Automatic APIs application
 */

// ========================================
// Enum Types
// ========================================

export type DbConnectionType = 'postgres' | 'mysql' | 'mongodb' | 'mssql' | 'oracle' | 'local';

export type ConnectionStatus = 'active' | 'inactive' | 'error' | 'testing';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS';

export type ComparisonOperator = 
  | 'eq' 
  | 'neq' 
  | 'gt' 
  | 'gte' 
  | 'lt' 
  | 'lte' 
  | 'like' 
  | 'ilike' 
  | 'in' 
  | 'not_in' 
  | 'is_null' 
  | 'is_not_null' 
  | 'between';

export type AggregationFunction = 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'ARRAY_AGG' | 'STRING_AGG';

export type ForeignKeyAction = 'NO ACTION' | 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';

export type ParameterLocation = 'query' | 'path' | 'header' | 'body';

export type ValueType = 'static' | 'parameter' | 'variable';

// ========================================
// User Models
// ========================================

export interface User {
  id: string; // UUID
  email: string;
  name?: string;
  avatar_url?: string;
  is_active: boolean;
  is_admin: boolean;
  last_login_at?: string; // ISO datetime
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

export interface UserInput {
  email: string;
  password: string;
  name?: string;
  avatar_url?: string;
}

// ========================================
// Connection Models
// ========================================

export interface Connection {
  id: string; // UUID
  user_id?: string; // UUID
  name: string;
  description?: string;
  type: DbConnectionType;
  host?: string;
  port?: number;
  database_name?: string;
  username?: string;
  uri?: string; // MongoDB connection URI
  use_ssl: boolean;
  connection_options: Record<string, unknown>;
  status: ConnectionStatus;
  last_tested_at?: string; // ISO datetime
  last_introspected_at?: string; // ISO datetime
  is_local: boolean;
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

export interface ConnectionConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  type?: DbConnectionType;
  uri?: string;
  encrypt?: boolean;
}

export interface ConnectionTestResult {
  success: boolean;
  message?: string;
  timestamp?: string; // ISO datetime
  info?: Record<string, unknown>;
}

export interface IntrospectionResult {
  success: boolean;
  message?: string;
  connectionId: string;
  stats: {
    tables: number;
    relationships: number;
    endpoints: number;
  };
}

// ========================================
// Schema Models
// ========================================

export interface DatabaseSchema {
  [tableName: string]: TableSchema;
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  primaryKeys: string[];
  foreignKeys: ForeignKeySchema[];
  reverseForeignKeys?: ForeignKeySchema[];
  indexes?: IndexSchema[];
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable?: boolean;
  default?: string;
  maxLength?: number;
  precision?: number;
  scale?: number;
  udtName?: string;
  enumOptions?: string[];
  isAutoIncrement?: boolean;
}

export interface ForeignKeySchema {
  columnName: string;
  foreignTable: string;
  foreignColumn: string;
  onDelete?: ForeignKeyAction;
  onUpdate?: ForeignKeyAction;
}

export interface IndexSchema {
  name: string;
  columns: string[];
  isUnique?: boolean;
  type?: string;
}

// ========================================
// Schema Tables (Database Entity)
// ========================================

export interface SchemaTable {
  id: string; // UUID
  connection_id: string; // UUID
  table_name: string;
  table_schema: string;
  table_type: string;
  estimated_row_count?: number;
  table_size_bytes?: number;
  description?: string;
  metadata: Record<string, unknown>;
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

export interface SchemaColumn {
  id: string; // UUID
  table_id: string; // UUID
  column_name: string;
  data_type: string;
  udt_name?: string;
  is_nullable: boolean;
  column_default?: string;
  character_maximum_length?: number;
  numeric_precision?: number;
  numeric_scale?: number;
  is_primary_key: boolean;
  is_auto_increment: boolean;
  is_unique: boolean;
  ordinal_position: number;
  enum_values?: string[];
  description?: string;
  metadata: Record<string, unknown>;
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

export interface SchemaPrimaryKey {
  id: string; // UUID
  table_id: string; // UUID
  column_id: string; // UUID
  constraint_name?: string;
  ordinal_position: number;
  created_at: string; // ISO datetime
}

export interface SchemaForeignKey {
  id: string; // UUID
  table_id: string; // UUID
  column_id: string; // UUID
  constraint_name?: string;
  foreign_table_id?: string; // UUID
  foreign_table_name: string;
  foreign_column_name: string;
  on_delete: ForeignKeyAction;
  on_update: ForeignKeyAction;
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

export interface SchemaIndex {
  id: string; // UUID
  table_id: string; // UUID
  index_name: string;
  is_unique: boolean;
  is_primary: boolean;
  index_type: string;
  column_names: string[];
  index_definition?: string;
  created_at: string; // ISO datetime
}

// ========================================
// Endpoint Builder Models
// ========================================

export interface Endpoint {
  id: string; // UUID
  connection_id?: string; // UUID
  user_id?: string; // UUID
  name: string;
  slug: string;
  description?: string;
  method: HttpMethod;
  path: string;
  graph?: EndpointGraph;
  is_active: boolean;
  is_public: boolean;
  version: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

export interface EndpointInput {
  name: string;
  slug?: string;
  description?: string;
  method?: HttpMethod;
  path?: string;
  graph?: EndpointGraph;
  is_active?: boolean;
  is_public?: boolean;
  tags?: string[];
}

export interface EndpointGraph {
  source: {
    table: string;
  };
  joins: JoinDefinition[];
  outputFields: Record<string, string[]>;
  filters: FilterCondition[];
  groupBy: string[];
  aggregations: Aggregation[];
  having: FilterCondition[];
  orderBy?: Array<{
    field: string;
    direction: 'ASC' | 'DESC';
  }>;
  limit?: number;
  offset?: number;
}

export interface JoinDefinition {
  type: JoinType;
  from: {
    table: string;
    field: string;
  };
  to: {
    table: string;
    field: string;
  };
  alias?: string;
}

export interface FilterCondition {
  table: string;
  column: string;
  operator: ComparisonOperator;
  value?: string | number | boolean | (string | number)[];
  valueType?: ValueType;
  parameterName?: string;
  isOr?: boolean;
}

export interface Aggregation {
  function: AggregationFunction;
  table: string;
  column: string;
  alias?: string;
  distinct?: boolean;
}

export interface EndpointParameter {
  id?: string; // UUID
  endpoint_id: string; // UUID
  name: string;
  location: ParameterLocation;
  dataType: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
  validationPattern?: string;
  enumValues?: string[];
  minValue?: number;
  maxValue?: number;
  minLength?: number;
  maxLength?: number;
}

// ========================================
// Endpoint Graph (Database Entity)
// ========================================

export interface EndpointGraphEntity {
  id: string; // UUID
  endpoint_id: string; // UUID
  source_table_id?: string; // UUID
  source_table_name: string;
  output_fields: Record<string, string[]>;
  filters: FilterCondition[];
  group_by: string[];
  having: FilterCondition[];
  order_by: Array<{ field: string; direction: 'ASC' | 'DESC' }>;
  limit_value?: number;
  offset_value?: number;
  distinct_on?: string[];
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

export interface EndpointJoin {
  id: string; // UUID
  graph_id: string; // UUID
  join_type: JoinType;
  from_table: string;
  from_field: string;
  to_table: string;
  to_field: string;
  alias?: string;
  join_order: number;
  created_at: string; // ISO datetime
}

export interface EndpointFilter {
  id: string; // UUID
  graph_id: string; // UUID
  table_name: string;
  column_name: string;
  operator: ComparisonOperator;
  value?: string;
  value_type: ValueType;
  parameter_name?: string;
  is_or: boolean;
  filter_group: number;
  filter_order: number;
  created_at: string; // ISO datetime
}

export interface EndpointAggregation {
  id: string; // UUID
  graph_id: string; // UUID
  function_name: AggregationFunction;
  table_name: string;
  column_name: string;
  alias?: string;
  distinct_values: boolean;
  created_at: string; // ISO datetime
}

// ========================================
// Local Database Data Model
// ========================================

export interface LocalDatabaseData {
  id: string; // UUID
  connection_id: string; // UUID
  table_name: string;
  row_data: Record<string, unknown>;
  row_order: number;
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

// ========================================
// API Logging Models
// ========================================

export interface ApiRequestLog {
  id: string; // UUID
  connection_id?: string; // UUID
  endpoint_id?: string; // UUID
  user_id?: string; // UUID
  method: HttpMethod;
  path: string;
  query_params?: Record<string, unknown>;
  request_body?: Record<string, unknown>;
  response_status?: number;
  response_body_preview?: string;
  response_time_ms?: number;
  ip_address?: string;
  user_agent?: string;
  error_message?: string;
  created_at: string; // ISO datetime
}

export interface QueryHistory {
  id: string; // UUID
  connection_id: string; // UUID
  user_id?: string; // UUID
  query_text: string;
  query_params?: Record<string, unknown>;
  execution_time_ms?: number;
  rows_affected?: number;
  error_message?: string;
  created_at: string; // ISO datetime
}

// ========================================
// Settings Models
// ========================================

export interface AppSetting {
  id: string; // UUID
  user_id?: string; // UUID
  setting_key: string;
  setting_value: Record<string, unknown>;
  description?: string;
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

export interface ConnectionSetting {
  id: string; // UUID
  connection_id: string; // UUID
  setting_key: string;
  setting_value: Record<string, unknown>;
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

// ========================================
// Swagger Cache
// ========================================

export interface SwaggerCache {
  id: string; // UUID
  connection_id: string; // UUID
  spec_version: string;
  specification: Record<string, unknown>;
  generated_at: string; // ISO datetime
  expires_at?: string; // ISO datetime
}

// ========================================
// Statistics Models (Views)
// ========================================

export interface ConnectionStats {
  connection_id: string; // UUID
  connection_name: string;
  connection_type: DbConnectionType;
  status: ConnectionStatus;
  table_count: number;
  column_count: number;
  relationship_count: number;
  endpoint_count: number;
  last_introspected_at?: string; // ISO datetime
  created_at: string; // ISO datetime
}

export interface TableDetails {
  table_id: string; // UUID
  connection_id: string; // UUID
  table_name: string;
  table_schema: string;
  column_count: number;
  pk_count: number;
  fk_count: number;
  estimated_row_count?: number;
  created_at: string; // ISO datetime
}

export interface ApiUsageStats {
  connection_id?: string; // UUID
  endpoint_id?: string; // UUID
  method: HttpMethod;
  hour: string; // ISO datetime
  request_count: number;
  avg_response_time_ms: number;
  error_count: number;
}

// ========================================
// Common Response Models
// ========================================

export interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface SuccessResponse {
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// ========================================
// API Response Types
// ========================================

export type ListRecordsResponse<T = Record<string, unknown>> = T[];

export type GetRecordResponse<T = Record<string, unknown>> = T;

export type CreateRecordResponse<T = Record<string, unknown>> = T;

export type UpdateRecordResponse<T = Record<string, unknown>> = T;

export interface DeleteRecordResponse {
  success: boolean;
  deleted: number;
}

// ========================================
// Query Builder Types
// ========================================

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: 'ASC' | 'DESC';
  filters?: Record<string, unknown>;
}

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
  fields?: Array<{
    name: string;
    dataTypeID: number;
  }>;
}

// ========================================
// Schema Builder Types
// ========================================

export interface SchemaBuilderTable {
  name: string;
  columns: SchemaBuilderColumn[];
  primaryKey: string[];
  foreignKeys: SchemaBuilderForeignKey[];
  indexes: SchemaBuilderIndex[];
}

export interface SchemaBuilderColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  autoIncrement?: boolean;
  unique?: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export interface SchemaBuilderForeignKey {
  column: string;
  refTable: string;
  refColumn: string;
  onDelete?: ForeignKeyAction;
  onUpdate?: ForeignKeyAction;
}

export interface SchemaBuilderIndex {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface SchemaBuilderSchema {
  tables: SchemaBuilderTable[];
}
