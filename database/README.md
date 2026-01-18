# Database Schema Documentation

This folder contains the complete database schema and API models for the **Automatic APIs** application.

## Files

| File | Description |
|------|-------------|
| [schema.sql](schema.sql) | Complete PostgreSQL database schema with tables, indexes, triggers, and views |
| [openapi.yaml](openapi.yaml) | OpenAPI 3.0 specification defining all API endpoints and data models |
| [models.ts](models.ts) | TypeScript interfaces generated from the OpenAPI specification |

## Schema Overview

### Core Tables

```
┌─────────────────┐     ┌─────────────────────┐
│     users       │     │    connections      │
├─────────────────┤     ├─────────────────────┤
│ id (PK)         │────<│ user_id (FK)        │
│ email           │     │ id (PK)             │
│ password_hash   │     │ name                │
│ name            │     │ type                │
│ is_admin        │     │ host/port/database  │
└─────────────────┘     │ status              │
                        └─────────────────────┘
                                  │
           ┌──────────────────────┼──────────────────────┐
           │                      │                      │
           ▼                      ▼                      ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│   schema_tables     │ │     endpoints       │ │ local_database_data │
├─────────────────────┤ ├─────────────────────┤ ├─────────────────────┤
│ id (PK)             │ │ id (PK)             │ │ id (PK)             │
│ connection_id (FK)  │ │ connection_id (FK)  │ │ connection_id (FK)  │
│ table_name          │ │ name, slug          │ │ table_name          │
│ table_schema        │ │ method, path        │ │ row_data (JSONB)    │
└─────────────────────┘ │ graph               │ └─────────────────────┘
           │            └─────────────────────┘
           │                      │
           ▼                      ▼
┌─────────────────────┐ ┌─────────────────────┐
│   schema_columns    │ │  endpoint_graphs    │
├─────────────────────┤ ├─────────────────────┤
│ id (PK)             │ │ id (PK)             │
│ table_id (FK)       │ │ endpoint_id (FK)    │
│ column_name         │ │ source_table_name   │
│ data_type           │ │ output_fields       │
│ is_primary_key      │ │ filters             │
│ is_auto_increment   │ └─────────────────────┘
└─────────────────────┘            │
           │                       │
           ▼                       ▼
┌─────────────────────┐ ┌─────────────────────┐
│ schema_foreign_keys │ │   endpoint_joins    │
├─────────────────────┤ ├─────────────────────┤
│ id (PK)             │ │ id (PK)             │
│ table_id (FK)       │ │ graph_id (FK)       │
│ column_id (FK)      │ │ join_type           │
│ foreign_table_name  │ │ from_table/field    │
│ foreign_column_name │ │ to_table/field      │
│ on_delete/on_update │ └─────────────────────┘
└─────────────────────┘
```

### Enum Types

| Enum | Values |
|------|--------|
| `db_connection_type` | postgres, mysql, mongodb, mssql, oracle, local |
| `connection_status` | active, inactive, error, testing |
| `http_method` | GET, POST, PUT, PATCH, DELETE |
| `join_type` | INNER, LEFT, RIGHT, FULL, CROSS |
| `comparison_operator` | eq, neq, gt, gte, lt, lte, like, ilike, in, not_in, is_null, is_not_null, between |
| `aggregation_function` | COUNT, SUM, AVG, MIN, MAX, ARRAY_AGG, STRING_AGG |
| `fk_action` | NO ACTION, RESTRICT, CASCADE, SET NULL, SET DEFAULT |

## Tables Description

### Authentication & Users

| Table | Purpose |
|-------|---------|
| `users` | Application users with authentication details |

### Connection Management

| Table | Purpose |
|-------|---------|
| `connections` | Database connection configurations |
| `connection_settings` | Per-connection settings and preferences |

### Schema Introspection

| Table | Purpose |
|-------|---------|
| `schema_tables` | Cached introspected database tables |
| `schema_columns` | Cached table columns with metadata |
| `schema_primary_keys` | Primary key definitions (composite key support) |
| `schema_foreign_keys` | Foreign key relationships |
| `schema_indexes` | Table index definitions |

### Visual Endpoint Builder

| Table | Purpose |
|-------|---------|
| `endpoints` | Custom API endpoints created via visual builder |
| `endpoint_graphs` | Visual query builder graph structure |
| `endpoint_joins` | JOIN definitions for custom queries |
| `endpoint_filters` | Filter conditions for endpoints |
| `endpoint_aggregations` | Aggregation functions for endpoints |
| `endpoint_parameters` | Input parameter definitions |

### Local Database (Schema Builder)

| Table | Purpose |
|-------|---------|
| `local_database_data` | Data storage for virtual Schema Builder databases |

### Logging & Analytics

| Table | Purpose |
|-------|---------|
| `api_request_logs` | API request logging for analytics |
| `query_history` | SQL query execution history |

### Configuration

| Table | Purpose |
|-------|---------|
| `app_settings` | Global and user-specific application settings |
| `swagger_cache` | Cached OpenAPI specifications |

## Views

| View | Purpose |
|------|---------|
| `v_connection_stats` | Connection statistics with table/endpoint counts |
| `v_table_details` | Table details with column and relationship counts |
| `v_api_usage_stats` | API usage statistics aggregated by hour |

## Installation

1. **Create the database:**
   ```bash
   createdb automaticapis
   ```

2. **Run the schema:**
   ```bash
   psql -d automaticapis -f schema.sql
   ```

3. **Verify installation:**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```

## Using the TypeScript Models

Import models in your TypeScript code:

```typescript
import { 
  Connection, 
  ConnectionConfig,
  TableSchema, 
  Endpoint, 
  EndpointGraph 
} from './database/models';

// Example: Create a connection config
const config: ConnectionConfig = {
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  user: 'postgres',
  password: 'secret',
  type: 'postgres'
};

// Example: Define an endpoint graph
const graph: EndpointGraph = {
  source: { table: 'users' },
  joins: [
    {
      type: 'LEFT',
      from: { table: 'users', field: 'id' },
      to: { table: 'posts', field: 'user_id' }
    }
  ],
  outputFields: {
    users: ['id', 'name', 'email'],
    posts: ['title', 'created_at']
  },
  filters: [
    {
      table: 'users',
      column: 'is_active',
      operator: 'eq',
      value: true
    }
  ],
  groupBy: [],
  aggregations: [],
  having: []
};
```

## OpenAPI Usage

You can use the OpenAPI specification to:

1. **Generate client SDKs** using tools like OpenAPI Generator
2. **Generate server stubs** for different frameworks
3. **Import into Postman/Insomnia** for API testing
4. **Generate documentation** with tools like Redoc or Swagger UI

### Generate TypeScript Client

```bash
npx openapi-generator-cli generate \
  -i database/openapi.yaml \
  -g typescript-axios \
  -o src/generated/api
```

### Generate Documentation

```bash
npx redocly build-docs database/openapi.yaml \
  --output docs/api-reference.html
```

## Security Notes

1. **Password Storage**: User passwords are hashed using `pgcrypto`'s `crypt()` function with bcrypt
2. **Connection Passwords**: Database connection passwords should be encrypted before storage
3. **SQL Injection Prevention**: All queries use parameterized statements
4. **Access Control**: Implement row-level security (RLS) for multi-tenant setups

## Migration Notes

When upgrading the schema:

1. Always backup before migrations
2. Use transactions for DDL changes
3. Test migrations on a staging database first
4. Consider using a migration tool like `golang-migrate` or `flyway`
