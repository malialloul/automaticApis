# Quick Reference

Essential commands and endpoints for Automatic APIs.

## Installation

```bash
# Clone
git clone https://github.com/malialloul/automaticApis.git
cd automaticApis

# Backend
cd backend && npm install && npm run dev

# Frontend (in new terminal)
cd frontend && npm install --legacy-peer-deps && npm run dev
```

## Test Database (Docker)

```bash
docker-compose up -d
# Credentials: postgres:postgres@localhost:5432/testdb
```

## API Endpoints

### Connection Management

```bash
# Test connection
POST /api/connections/test
Body: { host, port, database, user, password }

# Introspect database
POST /api/connections/:id/introspect
Body: { host, port, database, user, password }

# Get schema
GET /api/connections/:id/schema

# Get Swagger spec
GET /api/connections/:id/swagger
```

### Auto-Generated CRUD

```bash
# List all (with filters, pagination, sorting)
GET /api/:connId/:table?limit=100&offset=0&orderBy=id&field=value

# Get by ID
GET /api/:connId/:table/:id

# Create
POST /api/:connId/:table
Body: { field1: value1, field2: value2 }

# Update
PUT /api/:connId/:table/:id
Body: { field1: newValue }

# Delete
DELETE /api/:connId/:table/:id

# Get related
GET /api/:connId/:table/:id/:relatedTable
```

## Example Requests

```bash
# List users
curl http://localhost:3001/api/testdb/users?limit=10

# Create user
curl -X POST http://localhost:3001/api/testdb/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com"}'

# Update user
curl -X PUT http://localhost:3001/api/testdb/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane"}'

# Get user's posts
curl http://localhost:3001/api/testdb/users/1/posts

# Delete user
curl -X DELETE http://localhost:3001/api/testdb/users/1
```

## Query Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `limit` | Max records to return | `?limit=50` |
| `offset` | Records to skip | `?offset=100` |
| `orderBy` | Column to sort by | `?orderBy=created_at` |
| `orderDir` | Sort direction | `?orderDir=DESC` |
| `{column}` | Filter by column | `?email=john@example.com` |

## Frontend Routes

| Route | Description |
|-------|-------------|
| `/` | Home - Connection manager & dashboard |
| `/schema` | Schema visualizer & relationship graph |
| `/apis` | API explorer & testing playground |
| `/documentation` | Swagger UI documentation |

## Common Tasks

### Connect to Database
1. Open http://localhost:3000
2. Fill connection form
3. Test connection
4. Click "Connect & Introspect"

### View Schema
1. Navigate to Schema page
2. Search for tables
3. Expand to see columns
4. View relationship graph

### Test API
1. Navigate to APIs page
2. Select table and operation
3. Fill parameters
4. Click "Send Request"
5. View response

### Generate Code
1. Navigate to APIs page
2. Find endpoint
3. Click "cURL" or "fetch"
4. Copy generated code

## Testing

```bash
# Backend tests
cd backend && npm test

# Frontend build test
cd frontend && npm run build
```

## Environment Variables

### Backend (.env)
```env
PORT=3001
NODE_ENV=development
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3001
```

## Project Structure

```
automaticApis/
├── backend/           # Express API server
│   ├── src/
│   │   ├── middleware/  # Core logic
│   │   ├── routes/      # Endpoints
│   │   └── utils/       # Helpers
│   └── test.js        # Tests
├── frontend/          # React dashboard
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Route pages
│   │   ├── hooks/       # Custom hooks
│   │   └── services/    # API client
│   └── ...
└── ...
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port in use | Change PORT in .env |
| Can't connect to DB | Check PostgreSQL is running |
| Schema not found | Run introspection first |
| CORS errors | Check VITE_API_URL |
| Dependency errors | Use `--legacy-peer-deps` |

## Resources

- [README](./README.md) - Overview & features
- [Installation Guide](./INSTALLATION.md) - Detailed setup
- [User Guide](./USER_GUIDE.md) - Complete usage guide
- [Contributing](./CONTRIBUTING.md) - How to contribute
- [Backend Docs](./backend/README.md) - Backend API
- [Frontend Docs](./frontend/README.md) - Frontend details

## Support

- GitHub Issues: https://github.com/malialloul/automaticApis/issues
- Example Schema: [example-schema.sql](./example-schema.sql)

## Quick Commands

```bash
# Start everything
docker-compose up -d                    # PostgreSQL
cd backend && npm run dev &             # Backend
cd frontend && npm run dev &            # Frontend

# Stop everything
pkill -f "node src/index.js"           # Backend
pkill -f "vite"                        # Frontend
docker-compose down                     # PostgreSQL

# Clean install
rm -rf node_modules package-lock.json
npm install
```

## Sample Database Connection

```json
{
  "host": "localhost",
  "port": 5432,
  "database": "testdb",
  "user": "postgres",
  "password": "postgres"
}
```

---

**Made with ❤️ for developers**
