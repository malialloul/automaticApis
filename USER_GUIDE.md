# User Guide

Complete guide to using Automatic APIs to generate REST APIs from your PostgreSQL database.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Connecting to a Database](#connecting-to-a-database)
3. [Viewing Schema](#viewing-schema)
4. [Using Generated APIs](#using-generated-apis)
5. [Testing APIs](#testing-apis)
6. [API Documentation](#api-documentation)
7. [Advanced Features](#advanced-features)

## Getting Started

After installation, you should have:
- Backend running on `http://localhost:3001`
- Frontend running on `http://localhost:3000`

Open your browser to `http://localhost:3000` to access the dashboard.

## Connecting to a Database

### Step 1: Fill in Connection Details

On the Home page, you'll see the "Database Connection" form:

1. **Connection ID** (optional): A unique identifier for this connection. Leave empty for auto-generation.
2. **Host**: Database server address (e.g., `localhost`, `db.example.com`)
3. **Port**: PostgreSQL port (default: `5432`)
4. **Database**: Database name
5. **User**: PostgreSQL username
6. **Password**: PostgreSQL password

### Step 2: Test Connection

Click the "Test Connection" button to verify your credentials are correct. You'll see:
- ✅ Success message with server timestamp
- ❌ Error message if connection fails

### Step 3: Introspect Schema

Click "Connect & Introspect" to:
- Save the connection to localStorage
- Connect to the database
- Analyze the database schema
- Generate API endpoints
- Cache schema information

You'll see statistics showing:
- Number of tables discovered
- Number of relationships found
- Total endpoints generated

### Managing Connections

Saved connections appear in the "Saved Connections" list:
- Click a connection to select it
- Click the 🗑️ icon to delete a saved connection
- The active connection shows a ✅ checkmark

## Viewing Schema

Navigate to the **Schema** page to explore your database structure.

### Schema Visualizer

The Schema Visualizer shows all tables with:
- Table names
- Column count
- Foreign key relationships
- Reverse foreign key relationships

**Features:**
- 🔍 **Search**: Filter tables by name
- 📋 **Column Details**: Click a table to expand and see:
  - Column names
  - Data types
  - Nullable status
  - Default values
  - Primary keys (highlighted)
  - Foreign keys (with target table)

### Relationship Graph

The interactive graph shows:
- Tables as nodes
- Foreign key relationships as arrows
- Visual representation of database structure

**Controls:**
- **Zoom**: Mouse wheel or pinch
- **Pan**: Click and drag
- **Minimap**: Navigate large schemas

## Using Generated APIs

Every table gets 5 CRUD endpoints automatically:

### List All Records

```http
GET /api/{connectionId}/{table}
```

**Query Parameters:**
- `limit` - Maximum records (default: 100)
- `offset` - Skip records (pagination)
- `orderBy` - Column to sort by
- `orderDir` - Sort direction (`ASC` or `DESC`)
- Any column name - Filter by that column

**Examples:**
```bash
# Get first 10 users
GET /api/mydb/users?limit=10

# Get users sorted by name
GET /api/mydb/users?orderBy=name&orderDir=ASC

# Get users with specific email
GET /api/mydb/users?email=john@example.com

# Pagination (page 2, 20 per page)
GET /api/mydb/users?limit=20&offset=20
```

### Get Single Record

```http
GET /api/{connectionId}/{table}/{id}
```

**Example:**
```bash
GET /api/mydb/users/1
```

### Create Record

```http
POST /api/{connectionId}/{table}
Content-Type: application/json

{
  "column1": "value1",
  "column2": "value2"
}
```

**Example:**
```bash
POST /api/mydb/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}
```

### Update Record

```http
PUT /api/{connectionId}/{table}/{id}
Content-Type: application/json

{
  "column1": "new_value"
}
```

**Example:**
```bash
PUT /api/mydb/users/1
Content-Type: application/json

{
  "name": "Jane Doe"
}
```

### Delete Record

```http
DELETE /api/{connectionId}/{table}/{id}
```

**Example:**
```bash
DELETE /api/mydb/users/1
```

### Relationship Endpoints

For tables with foreign keys, you get bonus endpoints:

```http
GET /api/{connectionId}/{table}/{id}/{relatedTable}
```

**Examples:**

```bash
# Get all posts by user 1
GET /api/mydb/users/1/posts

# Get all comments on post 5
GET /api/mydb/posts/5/comments

# Get the user who wrote post 3
GET /api/mydb/posts/3/users
```

## Testing APIs

Navigate to the **APIs** page for interactive testing.

### Endpoint Explorer

**Left Panel** - Browse all available endpoints:
- Organized by table
- Shows HTTP method (GET, POST, PUT, DELETE)
- Shows full endpoint path
- Copy endpoint URL
- Generate code snippets (cURL, fetch)

### API Testing Playground

**Right Panel** - Interactive request builder:

1. **Select Table**: Choose from dropdown
2. **Select Operation**: GET, POST, PUT, DELETE
3. **Record ID**: For single-record operations
4. **Query Parameters**: Add filters, pagination, sorting
5. **Request Body**: JSON input for POST/PUT
6. **Send Request**: Execute the API call

**Response Display:**
- HTTP status code
- Response time
- Response body (JSON viewer)
- Syntax highlighting
- Expandable/collapsible JSON

### Examples

**List Posts:**
- Table: `posts`
- Operation: `GET`
- Query Params: `limit=5&orderBy=created_at&orderDir=DESC`
- Click "Send Request"

**Create User:**
- Table: `users`
- Operation: `POST`
- Request Body:
  ```json
  {
    "name": "Alice",
    "email": "alice@example.com"
  }
  ```
- Click "Send Request"

**Update Post:**
- Table: `posts`
- Operation: `PUT`
- Record ID: `1`
- Request Body:
  ```json
  {
    "published": true
  }
  ```
- Click "Send Request"

## API Documentation

Navigate to the **Documentation** page for complete Swagger UI.

### Features

- **Interactive Documentation**: Try endpoints directly from the browser
- **Request/Response Schemas**: See all fields and types
- **Example Requests**: Copy example code
- **Authentication**: Test with different credentials
- **Download Spec**: Get OpenAPI JSON file

### Using Swagger UI

1. Find your endpoint in the list
2. Click to expand
3. Click "Try it out"
4. Fill in parameters
5. Click "Execute"
6. View response

### Download OpenAPI Spec

Click "Download OpenAPI Spec" to get a JSON file you can:
- Import into Postman
- Use with API testing tools
- Generate client SDKs
- Share with your team

## Advanced Features

### Multiple Connections

- Save multiple database connections
- Switch between them instantly
- Each connection has its own schema cache
- Connection IDs keep APIs organized

### Filters and Queries

**Combine multiple filters:**
```bash
GET /api/mydb/posts?published=true&user_id=1&orderBy=created_at
```

**Complex filtering:**
- Use column names as query parameters
- Values are matched exactly
- Multiple filters use AND logic

### Performance Tips

1. **Pagination**: Always use `limit` and `offset` for large tables
2. **Indexing**: Create indexes on frequently filtered columns
3. **Caching**: Schema is cached after introspection
4. **Connection Pooling**: Backend automatically manages connection pools

### Security Best Practices

1. **Don't expose publicly**: Use in development or behind authentication
2. **Use read-only users**: For viewing data only
3. **Network isolation**: Keep database on private network
4. **SSL/TLS**: Use encrypted connections for production
5. **Input validation**: All inputs are validated and parameterized

### Keyboard Shortcuts

- **Ctrl/Cmd + K**: Focus search box
- **Esc**: Close modals
- **Tab**: Navigate forms

## Common Workflows

### Workflow 1: Exploring a New Database

1. Connect to database
2. Go to Schema page
3. Browse tables and relationships
4. Go to APIs page
5. Test some endpoints
6. Go to Documentation page
7. Review full API spec

### Workflow 2: Debugging an Issue

1. Go to APIs page
2. Use API Tester to reproduce issue
3. Check response status and body
4. Modify request and retry
5. View schema if needed

### Workflow 3: Sharing API with Team

1. Connect to database
2. Go to Documentation page
3. Download OpenAPI spec
4. Share spec file with team
5. Team can import into Postman/Insomnia

## Tips and Tricks

### Copy Code Snippets

Click the "cURL" or "fetch" buttons in the Endpoint Explorer to copy ready-to-use code:

**cURL:**
```bash
curl -X GET "http://localhost:3001/api/mydb/users?limit=10"
```

**fetch:**
```javascript
fetch('/api/mydb/users?limit=10')
  .then(res => res.json())
  .then(data => console.log(data));
```

### Save Time with Defaults

- Last used connection is remembered
- Form values persist across sessions
- Connection list saved in localStorage

### Relationship Discovery

The system automatically finds:
- **Foreign Keys**: `posts.user_id → users.id`
- **Reverse FKs**: `users.id ← posts.user_id`
- Both create relationship endpoints

## Troubleshooting

### Can't Connect to Database

- Check host, port, username, password
- Ensure PostgreSQL is running
- Check firewall rules
- Verify `pg_hba.conf` allows connections

### Schema Not Appearing

- Click "Connect & Introspect" first
- Check browser console for errors
- Verify tables exist in `public` schema
- Ensure user has `SELECT` on `information_schema`

### API Returns 404

- Ensure you've introspected the database
- Check connection ID matches
- Verify table name is correct
- Check backend logs

### Slow Queries

- Add indexes on filtered columns
- Use pagination (`limit` and `offset`)
- Avoid selecting large text columns
- Check PostgreSQL query performance

## Next Steps

- Explore the [Backend API Documentation](./backend/README.md)
- Learn about [Frontend Architecture](./frontend/README.md)
- Check the [Installation Guide](./INSTALLATION.md)
- Review [Example Schema](./example-schema.sql)

## Getting Help

- Open an issue on [GitHub](https://github.com/malialloul/automaticApis/issues)
- Check existing documentation
- Review backend logs for errors
