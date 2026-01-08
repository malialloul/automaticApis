# Automatic APIs Frontend

React-based dashboard for managing database connections and testing auto-generated APIs.

## Features

- 🔌 Database connection manager with test functionality
- 💾 Save connections to localStorage
- 📊 Interactive schema visualizer
- 🔗 Relationship graph visualization
- 🔍 API endpoint explorer
- 🧪 Built-in API testing playground
- 📚 Integrated Swagger UI documentation
- 📈 Dashboard with statistics

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` if needed:

```env
VITE_API_URL=http://localhost:3001
```

## Usage

### Development mode

```bash
npm run dev
```

The app will start on `http://localhost:3000`

### Production build

```bash
npm run build
npm run preview
```

## Features Overview

### Connection Manager
- Add new database connections
- Test connections before saving
- Save multiple connections to localStorage
- Switch between connections easily
- View connection status

### Schema Visualizer
- Browse all tables in the database
- View column details (name, type, nullable, defaults)
- See primary keys highlighted
- View foreign key relationships
- Search and filter tables

### Relationship Graph
- Visual representation of table relationships
- Interactive graph with zoom and pan
- Shows foreign key connections
- Minimap for navigation

### API Endpoint Explorer
- Lists all auto-generated endpoints
- Organized by table
- Shows HTTP method, path, description
- Copy endpoint URLs
- Generate code snippets (cURL, fetch)

### API Testing Playground
- Interactive request builder
- Test GET, POST, PUT, DELETE operations
- Add query parameters
- JSON request body editor
- Response viewer with syntax highlighting
- Shows response status and timing

### Dashboard
- Overview of database statistics
- Table count, column count, relationship count
- Total API endpoints generated
- Quick stats and summaries

### Documentation
- Embedded Swagger UI
- Full API documentation
- Download OpenAPI spec

## Project Structure

```
frontend/
├── src/
│   ├── App.jsx                     # Main app component with routing
│   ├── main.jsx                    # React entry point
│   ├── components/
│   │   ├── ConnectionForm.jsx      # Database connection form
│   │   ├── ConnectionList.jsx      # Saved connections list
│   │   ├── SchemaVisualizer.jsx    # Database schema viewer
│   │   ├── RelationshipGraph.jsx   # Visual relationship graph
│   │   ├── EndpointExplorer.jsx    # API endpoint list
│   │   ├── APITester.jsx           # API testing playground
│   │   └── Dashboard.jsx           # Overview dashboard
│   ├── pages/
│   │   ├── Home.jsx                # Home page
│   │   ├── Schema.jsx              # Schema page
│   │   ├── APIs.jsx                # APIs page
│   │   └── Documentation.jsx       # Documentation page
│   ├── hooks/
│   │   └── useConnection.js        # Connection state hook
│   ├── services/
│   │   └── api.js                  # API client
│   └── utils/
│       └── storage.js              # localStorage helpers
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## Technologies Used

- **React 18** - UI framework
- **Material-UI** - Component library
- **React Router** - Navigation
- **React Query** - Data fetching
- **React Hook Form** - Form handling
- **Axios** - HTTP client
- **ReactFlow** - Graph visualization
- **React JSON View** - JSON viewer
- **Swagger UI React** - API documentation
- **Vite** - Build tool

## Usage Guide

### 1. Connect to Database

1. Navigate to the Home page
2. Fill in the connection form:
   - Host (e.g., localhost)
   - Port (default: 5432)
   - Database name
   - Username
   - Password
3. Click "Test Connection" to verify
4. Click "Connect & Introspect" to save and introspect the schema

### 2. View Schema

1. Navigate to the Schema page
2. Browse tables and columns
3. View relationships in the graph
4. Search for specific tables

### 3. Test APIs

1. Navigate to the APIs page
2. View all available endpoints
3. Use the API Tester to:
   - Select a table
   - Choose an operation (GET, POST, PUT, DELETE)
   - Add parameters
   - Send requests
   - View responses

### 4. View Documentation

1. Navigate to the Documentation page
2. Browse the auto-generated Swagger UI
3. Try out endpoints directly
4. Download the OpenAPI spec

## Troubleshooting

### CORS Issues

If you encounter CORS errors, ensure:
1. Backend is running on port 3001
2. Backend has CORS enabled
3. API_URL in `.env` is correct

### Connection Errors

If you can't connect to the database:
1. Verify backend is running
2. Check database credentials
3. Ensure PostgreSQL is accessible
4. Check network settings

### Schema Not Loading

If schema doesn't appear:
1. Make sure you've introspected the database
2. Check browser console for errors
3. Verify the connection is active
4. Try refreshing the page

## Development

### Adding New Components

1. Create component in `src/components/`
2. Import and use in pages
3. Add to navigation if needed

### Styling

- Uses Material-UI theme
- Customize theme in `App.jsx`
- Component-level styling with `sx` prop

### State Management

- Connection state: `useConnection` hook
- Server state: React Query
- Local state: React useState

## License

MIT
