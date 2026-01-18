# Fix for Primary Keys Lost After SQL Import

## Problem
When importing SQL to create a new local database:
1. `/api/connections/{id}/import-sql` - correctly extracts primary keys
2. `/api/connections/{id}/schema` (POST) - was losing primary keys

## Root Cause
The POST `/schema` endpoint had OLD code that:
1. Didn't convert `tables` array format to keyed object format (just did `schema || { tables }`)
2. Didn't properly normalize and sanitize primary keys
3. Didn't handle multiple field name variants (`primaryKey` vs `primaryKeys`)

## Solution
Updated POST `/schema` endpoint to:
1. Properly convert `tables` array to keyed schema object
2. Sanitize table and column names (strip quotes, backticks, etc.)
3. Handle both `primaryKeys` and `primaryKey` field variants
4. Normalize column definitions
5. Compute reverse foreign keys for consistency
6. Filter out empty/null values

## Files Changed
- `backend/src/routes/connections.js`: POST `/api/connections/:id/schema`

## Flow After Fix
1. User creates new DB in Schema Builder
2. User uploads SQL file → calls `/import-sql`
   - Backend parses SQL, extracts `primaryKeys`, caches in schemaCache
   - Returns { success, tables: count, ... }
3. Frontend calls `/schema` (GET) to fetch the cached schema  
   - Gets schema with `primaryKeys` correctly set
   - Updates local state
4. User clicks "Use in App" → calls `convertToAppSchema(tables)` then POST `/schema`
   - Frontend sends keyed schema with `primaryKeys`
   - Backend normalizes and stores in schemaCache again
   - Primary keys are preserved ✓

## Testing
```bash
# 1. Create new local DB with SQL import
# 2. Verify primary keys appear in ER diagram (green PK column highlight)
# 3. Verify primary keys appear in Schema page
# 4. Verify relations are detected (lines connecting tables)
```
