# 🚀 Automatic APIs

> Automatically generate REST APIs from PostgreSQL database schema with complete Swagger/OpenAPI documentation

A full-stack application that introspects PostgreSQL databases and automatically generates comprehensive REST APIs with CRUD operations, relationship endpoints, and interactive documentation.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![PostgreSQL](https://img.shields.io/badge/postgresql-%3E%3D12.0-blue.svg)

## ✨ Features

### Backend
- ✅ Dynamic database connection management
- ✅ Automatic schema introspection from PostgreSQL
- ✅ Auto-generated CRUD endpoints for all tables
- ✅ Auto-generated relationship endpoints (foreign keys & reverse)
- ✅ Parameterized queries (SQL injection prevention)
- ✅ Filtering, pagination, and sorting
- ✅ Auto-generated Swagger/OpenAPI 3.0 documentation
- ✅ Multiple simultaneous database connections
- ✅ Connection pooling for performance

### Frontend
- ✅ Database connection manager with test functionality
- ✅ Interactive schema visualizer
- ✅ Visual relationship graph
- ✅ API endpoint explorer with code generation
- ✅ Built-in API testing playground
- ✅ Integrated Swagger UI
- ✅ Dashboard with statistics
- ✅ Responsive Material-UI design
- ✅ LocalStorage persistence

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend (Port 3000)               │
│  ┌────────────┬──────────────┬────────────┬──────────────┐  │
│  │ Connection │   Schema     │    API     │     Swagger  │  │
│  │  Manager   │  Visualizer  │   Tester   │      UI      │  │
│  └────────────┴──────────────┴────────────┴──────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP/REST
┌───────────────────────────▼─────────────────────────────────┐
│                  Express Backend (Port 3001)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            Connection Management API                 │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Schema Inspector → API Generator → Swagger Gen     │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Dynamic CRUD & Relationship Routes           │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │ SQL
┌───────────────────────────▼─────────────────────────────────┐
│                    PostgreSQL Database                       │
│  ┌────────────┬──────────────┬────────────┬──────────────┐  │
│  │   Users    │    Posts     │  Comments  │     ...      │  │
│  └────────────┴──────────────┴────────────┴──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 12.0
- npm or yarn

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/malialloul/automaticApis.git
cd automaticApis
```

### 2. Start PostgreSQL test database (optional)

```bash
docker-compose up -d
```

This creates a test database with example schema (users, posts, comments).

### 3. Install and start backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Backend runs on `http://localhost:3001`

### 4. Install and start frontend

```bash
cd ../frontend
npm install
cp .env.example .env
npm run dev
```

Frontend runs on `http://localhost:3000`

### 5. Connect to database

1. Open `http://localhost:3000`
2. Fill in connection details:
   - Host: `localhost`
   - Port: `5432`
   - Database: `testdb`
   - User: `postgres`
   - Password: `postgres`
3. Click "Test Connection"
4. Click "Connect & Introspect"

## 📖 Usage

### Connecting to a Database

1. Navigate to the **Home** page
2. Enter your PostgreSQL connection details
3. Test the connection
4. Click "Connect & Introspect" to generate APIs

### Viewing Schema

1. Navigate to the **Schema** page
2. Browse all tables and columns
3. View relationships in the interactive graph
4. Search for specific tables

### Testing APIs

1. Navigate to the **APIs** page
2. Browse available endpoints
3. Use the API Tester:
   - Select table and operation
   - Add parameters
   - Send requests
   - View responses

### Viewing Documentation

1. Navigate to the **Documentation** page
2. Browse auto-generated Swagger UI
3. Try endpoints directly from the UI
4. Download OpenAPI specification

## 🔌 API Endpoints

### Connection Management

```http
# Test connection
POST /api/connections/test
{
  "host": "localhost",
  "port": 5432,
  "database": "mydb",
  "user": "postgres",
  "password": "password"
}

# Introspect schema
POST /api/connections/:id/introspect

# Get schema
GET /api/connections/:id/schema

# Get Swagger spec
GET /api/connections/:id/swagger
```

### Auto-Generated CRUD (per table)

```http
# List all records
GET /api/:connectionId/:table?limit=100&offset=0&orderBy=id

# Get single record
GET /api/:connectionId/:table/:id

# Create record
POST /api/:connectionId/:table

# Update record
PUT /api/:connectionId/:table/:id

# Delete record
DELETE /api/:connectionId/:table/:id
```

### Auto-Generated Relationships

```http
# Get related records
GET /api/:connectionId/:table/:id/:relatedTable
```

## 📁 Project Structure

```
automaticApis/
├── backend/                    # Express.js backend
│   ├── src/
│   │   ├── index.js           # Main server
│   │   ├── middleware/
│   │   │   ├── schemaInspector.js
│   │   │   ├── queryBuilder.js
│   │   │   ├── apiGenerator.js
│   │   │   └── swaggerGenerator.js
│   │   ├── routes/
│   │   │   └── connections.js
│   │   └── utils/
│   │       └── connectionManager.js
│   └── package.json
│
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── utils/
│   └── package.json
│
├── docker-compose.yml         # PostgreSQL test database
├── example-schema.sql         # Example database schema
└── README.md                  # This file
```

## 🔒 Security

- **SQL Injection Prevention**: All queries use parameterized statements
- **Input Validation**: Validates all user inputs
- **Identifier Sanitization**: Table and column names are sanitized
- **CORS Configuration**: Controlled cross-origin access
- **No Credential Logging**: Database credentials are never logged

## ⚡ Performance

- Connection pooling (max 20 connections per database)
- Schema caching to avoid repeated introspection
- Pagination support (default limit: 100)
- Efficient database queries
- Supports databases with 100+ tables

## 🧪 Example Database Schema

The project includes an example schema (`example-schema.sql`) with:
- **Users** table (id, name, email, bio, timestamps)
- **Posts** table (id, user_id FK, title, content, published, view_count, timestamps)
- **Comments** table (id, post_id FK, user_id FK, text, timestamp)

This creates:
- 3 tables
- 15+ API endpoints
- Foreign key relationships (belongs-to and has-many)
- Sample data for testing

## 🛠️ Development

### Backend Development

```bash
cd backend
npm run dev        # Start with nodemon (auto-reload)
```

### Frontend Development

```bash
cd frontend
npm run dev        # Start Vite dev server
npm run build      # Production build
npm run preview    # Preview production build
```

### Adding New Features

1. **Schema introspection**: Modify `schemaInspector.js`
2. **Query capabilities**: Extend `queryBuilder.js`
3. **API endpoints**: Update `apiGenerator.js`
4. **Documentation**: Enhance `swaggerGenerator.js`
5. **UI components**: Add to `frontend/src/components/`

## 🐛 Troubleshooting

### Connection Issues

**Problem**: Cannot connect to PostgreSQL

**Solutions**:
- Verify PostgreSQL is running
- Check host, port, and credentials
- Ensure PostgreSQL accepts connections from your host
- Check `pg_hba.conf` for authentication settings
- Verify firewall rules

### Schema Not Found

**Problem**: "Schema not found" error

**Solutions**:
- Run introspection first: `POST /api/connections/:id/introspect`
- Verify database has tables in the `public` schema
- Check server logs for introspection errors
- Ensure user has SELECT permissions on `information_schema`

### API Endpoints Not Working

**Problem**: 404 errors on API calls

**Solutions**:
- Introspect the database first
- Verify connection ID matches
- Check table exists in schema
- Review server logs for errors

### CORS Errors

**Problem**: CORS policy blocking requests

**Solutions**:
- Ensure backend CORS is enabled (default: enabled)
- Check frontend API_URL is correct
- Verify backend is running on port 3001

## 📝 Future Enhancements

- [ ] Support for views and materialized views
- [ ] Custom endpoint configuration
- [ ] Authentication and authorization
- [ ] Rate limiting
- [ ] WebSocket support for real-time updates
- [ ] Support for other databases (MySQL, MongoDB)
- [ ] Export generated API as standalone project
- [ ] GraphQL endpoint generation
- [ ] Automated testing generation
- [ ] API versioning support

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with Express.js and React
- Uses node-postgres (pg) for PostgreSQL connections
- Swagger UI for API documentation
- Material-UI for React components
- ReactFlow for graph visualization

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

**Made with ❤️ for developers who want instant APIs from their databases**