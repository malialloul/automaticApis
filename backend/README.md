# Automatic APIs - Backend

Backend service for automatically generating REST APIs from PostgreSQL database schema.

## Features

- 🔌 Dynamic database connection management
- 🔍 Automatic schema introspection
- 🚀 Auto-generated CRUD endpoints for all tables
- 🔗 Automatic relationship endpoints (foreign keys)
- 📚 Auto-generated Swagger/OpenAPI documentation
- 🛡️ SQL injection prevention with parameterized queries
- 📊 Support for filtering, pagination, and sorting
- 🔄 Multiple simultaneous database connections

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3001
NODE_ENV=development
```

## Usage

### Development mode (with auto-reload)

```bash
npm run dev
```

### Production mode

```bash
npm start
```

The server will start on `http://localhost:3001`

## API Endpoints

### Connection Management

#### Test Connection
```http
POST /api/connections/test
Content-Type: application/json

{
  "host": "localhost",
  "port": 5432,
  "database": "mydb",
  "user": "postgres",
  "password": "password"
}
```

#### Introspect Schema
```http
POST /api/connections/:connectionId/introspect
Content-Type: application/json

{
  "host": "localhost",
  "port": 5432,
  "database": "mydb",
  "user": "postgres",
  "password": "password"
}
```

#### Get Schema
```http
GET /api/connections/:connectionId/schema
```

#### Get Swagger Spec
```http
GET /api/connections/:connectionId/swagger
```

#### List Connections
```http
GET /api/connections
```

#### Close Connection
```http
DELETE /api/connections/:connectionId
```

### Auto-Generated CRUD Endpoints

After introspecting a database, the following endpoints are automatically created for each table:

#### List All Records
```http
GET /api/:connectionId/:table?limit=100&offset=0&orderBy=id&orderDir=ASC
```

Query parameters:
- `limit`: Maximum records to return (default: 100)
- `offset`: Number of records to skip (default: 0)
- `orderBy`: Column to sort by
- `orderDir`: Sort direction (ASC or DESC)
- Any column name can be used as a filter (e.g., `?name=John`)

#### Get Single Record
```http
GET /api/:connectionId/:table/:id
```

#### Create Record
```http
POST /api/:connectionId/:table
Content-Type: application/json

{
  "column1": "value1",
  "column2": "value2"
}
```

#### Update Record
```http
PUT /api/:connectionId/:table/:id
Content-Type: application/json

{
  "column1": "new_value1"
}
```

#### Delete Record
```http
DELETE /api/:connectionId/:table/:id
```

### Auto-Generated Relationship Endpoints

For tables with foreign key relationships:

```http
GET /api/:connectionId/:table/:id/:relatedTable
```

This works for both:
- **Belongs-to**: When the table has a foreign key to the related table
- **Has-many**: When the related table has a foreign key to this table

## Swagger Documentation

Access interactive API documentation at:

```
http://localhost:3001/api-docs/:connectionId/ui
```

Get OpenAPI JSON spec at:

```
http://localhost:3001/api/connections/:connectionId/swagger
```

## Architecture

```
backend/
├── src/
│   ├── index.js                    # Express app entry point
│   ├── middleware/
│   │   ├── schemaInspector.js      # PostgreSQL schema introspection
│   │   ├── queryBuilder.js         # Parameterized SQL query builder
│   │   ├── apiGenerator.js         # Auto-generate CRUD routes
│   │   └── swaggerGenerator.js     # Auto-generate OpenAPI specs
│   ├── routes/
│   │   └── connections.js          # Connection management endpoints
│   └── utils/
│       └── connectionManager.js    # PostgreSQL connection pool management
├── package.json
├── .env.example
└── README.md
```

## Security

- All SQL queries use parameterized queries to prevent SQL injection
- Input validation on all endpoints
- Identifier sanitization (table and column names)
- Connection credentials are not logged
- CORS enabled for controlled access

## Error Handling

The API returns standardized error responses:

```json
{
  "error": "Error message here"
}
```

HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad request / Invalid input
- `404`: Resource not found
- `500`: Server error

## Performance

- Connection pooling for efficient database connections
- Schema caching to avoid repeated introspection
- Configurable pagination limits
- Supports databases with 100+ tables

## Development

### Project Structure

- **connectionManager.js**: Manages PostgreSQL connection pools
- **schemaInspector.js**: Queries `information_schema` to discover database structure
- **queryBuilder.js**: Builds safe, parameterized SQL queries
- **apiGenerator.js**: Creates Express routes dynamically based on schema
- **swaggerGenerator.js**: Generates OpenAPI 3.0 specifications
- **connections.js**: HTTP endpoints for connection management

### Adding Features

To add new features:

1. Schema changes: Modify `schemaInspector.js`
2. Query capabilities: Extend `queryBuilder.js`
3. New endpoints: Update `apiGenerator.js`
4. Documentation: Update `swaggerGenerator.js`

## Troubleshooting

### Connection Issues

If you can't connect to PostgreSQL:

1. Verify PostgreSQL is running
2. Check host, port, database, user, and password
3. Ensure PostgreSQL accepts connections from your host
4. Check `pg_hba.conf` for authentication settings

### Schema Not Found

If you get "Schema not found" errors:

1. First call `POST /api/connections/:id/introspect`
2. Verify the introspection succeeded
3. Check `GET /api/connections/:id/schema` to see the cached schema

### No Routes Generated

If API endpoints aren't working:

1. Introspect the database first
2. Check the connection ID matches
3. Verify tables exist in the `public` schema
4. Check server logs for errors

## License

MIT
