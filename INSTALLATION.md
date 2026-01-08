# Installation Guide

This guide will help you set up and run the Automatic APIs project.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 18.0.0 ([Download](https://nodejs.org/))
- **PostgreSQL** >= 12.0 ([Download](https://www.postgresql.org/download/))
- **npm** or **yarn** (comes with Node.js)

## Option 1: Quick Start with Docker (Recommended for Testing)

### 1. Install Docker

If you don't have Docker installed:
- **Mac/Windows**: Download [Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Linux**: Follow the [official Docker installation guide](https://docs.docker.com/engine/install/)

### 2. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/malialloul/automaticApis.git
cd automaticApis

# Start PostgreSQL test database
docker-compose up -d

# Wait for PostgreSQL to be ready (about 10 seconds)
# The database will be initialized with the example schema
```

### 3. Install Backend Dependencies

```bash
cd backend
npm install
cp .env.example .env
```

### 4. Install Frontend Dependencies

```bash
cd ../frontend
npm install --legacy-peer-deps
cp .env.example .env
```

### 5. Start the Application

Open two terminal windows:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Backend will start on `http://localhost:3001`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend will start on `http://localhost:3000`

### 6. Connect to the Test Database

Open your browser to `http://localhost:3000` and use these credentials:

- **Host:** `localhost`
- **Port:** `5432`
- **Database:** `testdb`
- **User:** `postgres`
- **Password:** `postgres`

Click "Test Connection" then "Connect & Introspect"

## Option 2: Manual Setup (Production)

### 1. Install PostgreSQL

Download and install PostgreSQL from [postgresql.org](https://www.postgresql.org/download/)

### 2. Create a Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create a database
CREATE DATABASE myapp;

# Connect to the database
\c myapp

# Create some tables (or use your existing database)
-- See example-schema.sql for sample tables
```

### 3. Clone and Install

```bash
# Clone the repository
git clone https://github.com/malialloul/automaticApis.git
cd automaticApis

# Backend setup
cd backend
npm install
cp .env.example .env
# Edit .env if needed

# Frontend setup
cd ../frontend
npm install --legacy-peer-deps
cp .env.example .env
# Edit .env if needed
```

### 4. Start the Application

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

### 5. Connect to Your Database

1. Open `http://localhost:3000`
2. Fill in your database credentials
3. Click "Test Connection"
4. Click "Connect & Introspect"

## Configuration

### Backend (.env)

```env
PORT=3001
NODE_ENV=development
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:3001
```

## Verifying Installation

### Test Backend

```bash
cd backend
npm test
```

You should see:
```
✅ All tests passed!
```

### Test Frontend

```bash
cd frontend
npm run build
```

You should see:
```
✓ built in X.XXs
```

### Test Full Stack

1. Start both backend and frontend
2. Navigate to `http://localhost:3000`
3. You should see the Automatic APIs dashboard
4. Try connecting to a database

## Troubleshooting

### Port Already in Use

If port 3001 or 3000 is already in use:

**Backend:** Edit `backend/.env` and change `PORT=3001` to another port

**Frontend:** Edit `frontend/vite.config.js` and change the server port

### PostgreSQL Connection Refused

Ensure PostgreSQL is running:

**Mac:**
```bash
brew services start postgresql
```

**Linux:**
```bash
sudo systemctl start postgresql
```

**Windows:**
Open Services and start "PostgreSQL"

### Frontend Dependency Issues

If you encounter peer dependency errors:

```bash
cd frontend
npm install --legacy-peer-deps --force
```

### Backend Module Not Found

Ensure you're in the correct directory and dependencies are installed:

```bash
cd backend
npm install
npm run dev
```

## Next Steps

Once installed, check out:

- [User Guide](./USER_GUIDE.md) - Learn how to use the application
- [Backend README](./backend/README.md) - Backend API documentation
- [Frontend README](./frontend/README.md) - Frontend documentation

## Production Deployment

For production deployment:

### Backend

```bash
cd backend
npm install --production
npm start
```

Use a process manager like PM2:
```bash
npm install -g pm2
pm2 start src/index.js --name automatic-apis
```

### Frontend

```bash
cd frontend
npm run build
```

Serve the `dist` folder with nginx, Apache, or any static file server.

## Getting Help

- **Issues:** Open an issue on [GitHub](https://github.com/malialloul/automaticApis/issues)
- **Documentation:** Check the [README](./README.md)
- **Examples:** See [example-schema.sql](./example-schema.sql)
