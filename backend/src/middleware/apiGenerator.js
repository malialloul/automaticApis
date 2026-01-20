const express = require('express');
const QueryBuilder = require('./queryBuilder');

class APIGenerator {
  constructor(connectionId, pool, schema, dialect = 'postgres', dataStore = null) {
    this.connectionId = connectionId;
    this.pool = pool;
    this.schema = schema;
    this.dialect = (dialect || 'postgres').toLowerCase();
    this.router = express.Router();
    this.dataStore = dataStore; // For in-memory data storage in local databases
  }

  // Register basic CRUD routes for a table (only register id-based routes if PK exists)
  generateCRUDRoutes(tableName, tableSchema) {
    const basePath = `/${tableName}`;

    // For local databases (no pool), use in-memory data storage
    if (!this.pool) {
      // Initialize table data storage if not exists
      const initDataStore = () => {
        if (!this.dataStore.has(this.connectionId)) {
          this.dataStore.set(this.connectionId, {});
        }
        const connData = this.dataStore.get(this.connectionId);
        if (!connData[tableName]) {
          connData[tableName] = [];
        }
        return connData[tableName];
      };

      // Helper to get row ID for finding records
      const getPrimaryKeyValue = (row) => {
        const pks = tableSchema.primaryKeys || [];
        if (pks.length === 0) return JSON.stringify(row);
        if (pks.length === 1) return row[pks[0]];
        return pks.map(pk => row[pk]).join('|');
      };

      // List with filters/pagination
      this.router.get(basePath, async (req, res) => {
        try {
          const { limit = 100, offset = 0, orderBy, orderDir = 'asc' } = req.query;
          let rows = initDataStore();

          console.log(`[LOCAL DB] GET ${basePath} - connectionId: ${this.connectionId}, tableName: ${tableName}, rows count: ${rows.length}`);

          // Apply filters from query params
          for (const [key, value] of Object.entries(req.query)) {
            if (['limit', 'offset', 'orderBy', 'orderDir'].includes(key)) continue;
            const opMatch = key.match(/(.+?)__(gt|gte|lt|lte|like|contains|startswith|endswith)$/);
            if (opMatch) {
              const [, col, op] = opMatch;
              rows = rows.filter(row => {
                const val = row[col];
                switch (op) {
                  case 'gt': return val > value;
                  case 'gte': return val >= value;
                  case 'lt': return val < value;
                  case 'lte': return val <= value;
                  case 'like':
                  case 'contains': return String(val).includes(String(value));
                  case 'startswith': return String(val).startsWith(String(value));
                  case 'endswith': return String(val).endsWith(String(value));
                  default: return true;
                }
              });
            } else if (req.query.hasOwnProperty(key)) {
              rows = rows.filter(row => row[key] == value);
            }
          }

          // Apply ordering
          if (orderBy) {
            rows = rows.sort((a, b) => {
              const aVal = a[orderBy];
              const bVal = b[orderBy];
              const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
              return orderDir === 'desc' ? -cmp : cmp;
            });
          }

          // Apply pagination
          const total = rows.length;
          rows = rows.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

          res.json(rows);
        } catch (error) {
          console.error(`Error listing ${tableName}:`, error);
          res.status(500).json({ error: error.message });
        }
      });

      // Create new row
      this.router.post(basePath, async (req, res) => {
        try {
          const rows = initDataStore();

          console.log(`[LOCAL DB] POST ${basePath} - connectionId: ${this.connectionId}, tableName: ${tableName}, body:`, req.body);

          // Normalize data keys - strip table prefix if present (e.g., "users.name" -> "name")
          const newRow = {};
          for (const [key, value] of Object.entries(req.body)) {
            const cleanKey = key.includes('.') ? key.split('.')[1] : key;
            newRow[cleanKey] = value;
          }

          // Generate ID if table has auto-increment primary key
          const pks = tableSchema.primaryKeys || [];
          if (pks.length === 1) {
            const pkCol = pks[0];
            if (!newRow[pkCol]) {
              const maxId = Math.max(...rows.map(r => parseInt(r[pkCol]) || 0), 0);
              newRow[pkCol] = maxId + 1;
            }
          }

          rows.push(newRow);
          console.log(`[LOCAL DB] POST ${basePath} - inserted:`, newRow, 'total rows now:', rows.length);
          res.status(201).json(newRow);
        } catch (error) {
          console.error(`Error creating ${tableName}:`, error);
          res.status(500).json({ error: error.message });
        }
      });

      // Helper to evaluate where clause - handles both simple and complex formats
      const matchesWhere = (row, where) => {
        if (!where) return true;

        for (const [key, condition] of Object.entries(where)) {
          const rowVal = row[key];

          // Handle complex format: { op: "eq", val: "1" }
          if (typeof condition === 'object' && condition !== null && condition.op && condition.val !== undefined) {
            const { op, val } = condition;
            const compareVal = String(val);
            const compareRowVal = String(rowVal);

            switch (op) {
              case 'eq': if (compareRowVal !== compareVal) return false; break;
              case 'ne': if (compareRowVal === compareVal) return false; break;
              case 'gt': if (!(Number(rowVal) > Number(val))) return false; break;
              case 'gte': if (!(Number(rowVal) >= Number(val))) return false; break;
              case 'lt': if (!(Number(rowVal) < Number(val))) return false; break;
              case 'lte': if (!(Number(rowVal) <= Number(val))) return false; break;
              case 'like':
              case 'contains': if (!compareRowVal.includes(compareVal)) return false; break;
              case 'startswith': if (!compareRowVal.startsWith(compareVal)) return false; break;
              case 'endswith': if (!compareRowVal.endsWith(compareVal)) return false; break;
              default: return false;
            }
          } else {
            // Handle simple format: { id: "1" }
            if (String(rowVal) !== String(condition)) return false;
          }
        }
        return true;
      };

      // Update row(s)
      this.router.put(basePath, async (req, res) => {
        try {
          const rows = initDataStore();
          let { data, where } = req.body;

          if (!data || Object.keys(data).length === 0) {
            return res.status(400).json({ error: 'No update data provided' });
          }

          // Handle id passed as query parameter (convert to where clause)
          if (req.query.id && !where) {
            const pks = tableSchema.primaryKeys || [];
            if (pks.length > 0) {
              where = { [pks[0]]: req.query.id };
            }
          }

          // Normalize data keys - strip table prefix if present (e.g., "users.name" -> "name")
          const normalizedData = {};
          for (const [key, value] of Object.entries(data)) {
            const cleanKey = key.includes('.') ? key.split('.')[1] : key;
            normalizedData[cleanKey] = value;
          }

          let updated = 0;
          for (let i = 0; i < rows.length; i++) {
            if (matchesWhere(rows[i], where)) {
              rows[i] = { ...rows[i], ...normalizedData };
              updated++;
            }
          }

          res.json({ updated, message: `Updated ${updated} row(s)` });
        } catch (error) {
          console.error(`Error updating ${tableName}:`, error);
          res.status(500).json({ error: error.message });
        }
      });

      // Delete row(s)
      this.router.delete(basePath, async (req, res) => {
        try {
          const rows = initDataStore();
          let { where } = req.body || {};

          // Handle id passed as query parameter (convert to where clause)
          if (req.query.id && !where) {
            const pks = tableSchema.primaryKeys || [];
            if (pks.length > 0) {
              where = { [pks[0]]: req.query.id };
            }
          }

          // If no body.where provided, build where from query params
          if ((!where || Object.keys(where).length === 0) && Object.keys(req.query || {}).length > 0) {
            const q = { ...req.query };
            const built = {};
            for (const [key, val] of Object.entries(q)) {
              if (['limit', 'offset', 'orderBy', 'orderDir', 'id'].includes(key)) continue;
              const opMatch = key.match(/(.+?)__(gt|gte|lt|lte|like|contains|startswith|endswith|ne)$/);
              if (opMatch) {
                const [, col, op] = opMatch;
                built[col] = { op, val };
              } else {
                built[key] = val;
              }
            }
            if (Object.keys(built).length > 0) {
              where = built;
            }
          }

          // Safety check: require a where clause to prevent accidental deletion of all rows
          if (!where || Object.keys(where).length === 0) {
            return res.status(400).json({ error: 'DELETE requires a where clause or id parameter to prevent accidental deletion of all records' });
          }

          let initialLength = rows.length;
          let i = rows.length;
          while (i--) {
            if (matchesWhere(rows[i], where)) {
              rows.splice(i, 1);
            }
          }

          const deleted = initialLength - rows.length;
          res.json({ deleted, message: `Deleted ${deleted} row(s)` });
        } catch (error) {
          console.error(`Error deleting ${tableName}:`, error);
          res.status(500).json({ error: error.message });
        }
      });

      // Get single row by ID
      this.router.get(`${basePath}/:id`, async (req, res) => {
        try {
          const rows = initDataStore();
          const pks = tableSchema.primaryKeys || [];

          let row = null;
          if (pks.length > 0) {
            row = rows.find(r => String(getPrimaryKeyValue(r)) === String(req.params.id));
          }

          res.json(row);
        } catch (error) {
          console.error(`Error getting ${tableName}:`, error);
          res.status(500).json({ error: error.message });
        }
      });

      // Update single row by ID
      this.router.put(`${basePath}/:id`, async (req, res) => {
        try {
          const rows = initDataStore();
          const pks = tableSchema.primaryKeys || [];

          if (pks.length === 0) {
            return res.status(400).json({ error: 'No primary key defined' });
          }

          const idx = rows.findIndex(r => String(getPrimaryKeyValue(r)) === String(req.params.id));
          if (idx === -1) {
            return res.status(404).json({ error: 'Row not found' });
          }

          rows[idx] = { ...rows[idx], ...req.body };
          res.json(rows[idx]);
        } catch (error) {
          console.error(`Error updating ${tableName}:`, error);
          res.status(500).json({ error: error.message });
        }
      });

      // Delete single row by ID
      this.router.delete(`${basePath}/:id`, async (req, res) => {
        try {
          const rows = initDataStore();
          const pks = tableSchema.primaryKeys || [];

          if (pks.length === 0) {
            return res.status(400).json({ error: 'No primary key defined' });
          }

          const idx = rows.findIndex(r => String(getPrimaryKeyValue(r)) === String(req.params.id));
          if (idx === -1) {
            return res.status(404).json({ error: 'Row not found' });
          }

          const deleted = rows.splice(idx, 1);
          res.json({ deleted: deleted[0], message: 'Row deleted' });
        } catch (error) {
          console.error(`Error deleting ${tableName}:`, error);
          res.status(500).json({ error: error.message });
        }
      });

      return;
    }

    // List with filters/pagination (always present)
    this.router.get(basePath, async (req, res) => {
      try {
        const { limit, offset, orderBy, orderDir, ...filters } = req.query;
        const qb = new QueryBuilder(tableName, tableSchema, this.dialect);
        const q = qb.buildSelect({
          filters,
          limit: limit || 100,
          offset: offset || 0,
          orderBy,
          orderDir,
        });
        const result = await this.pool.query(q.text, q.values);
        const rows = result.rows ?? result[0];
        res.json(rows);
      } catch (error) {
        console.error(`Error listing ${tableName}:`, error);
        res.status(500).json({ error: error.message });
      }
    });

    // Collection-level update (supports filters via query params OR req.body.where ({ col: {op, val} }))
    this.router.put(`${basePath}`, async (req, res) => {
      try {
        const qb = new QueryBuilder(tableName, tableSchema, this.dialect);

        // Determine data to update FIRST (so SET params come before WHERE params)
        const data = req.body && Object.keys(req.body).length ? (req.body.data || req.body) : null;
        if (!data || Object.keys(data).length === 0) {
          throw new Error('No update data provided');
        }

        const setClauses = [];
        for (const [k, v] of Object.entries(data)) {
          if (!qb.isValidColumn(k)) continue;
          setClauses.push(`${qb.sanitizeIdentifier(k)} = ${qb.addParam(v)}`);
        }

        if (setClauses.length === 0) {
          throw new Error('No valid columns to update');
        }

        // Build WHERE clause from req.query and/or req.body.where AFTER SET clauses
        const whereClauses = [];

        // 1) From query params (supports column__gt, column__like, column__contains, column__startswith, etc.)
        for (const [col, val] of Object.entries(req.query || {})) {
          if (!qb.isValidColumn(col) && !col.includes('__')) continue;
          // If operator suffix used in query param, pass through as in buildSelect handling
          const opMatch = col.match(/(.+?)__(gt|gte|lt|lte|like|contains|startswith|endswith)$/);
          if (opMatch) {
            const column = opMatch[1];
            const op = opMatch[2];
            if (!qb.isValidColumn(column)) continue;
            if (['like', 'contains', 'startswith', 'endswith'].includes(op)) {
              let v = val;
              if (op === 'contains') v = `%${val}%`;
              else if (op === 'startswith') v = `${val}%`;
              else if (op === 'endswith') v = `%${val}`;
              whereClauses.push(`${qb.sanitizeIdentifier(column)} LIKE ${qb.addParam(v)}`);
            } else {
              const map = { gt: '>', gte: '>=', lt: '<', lte: '<=' };
              const sqlOp = map[op] || '=';
              whereClauses.push(`${qb.sanitizeIdentifier(column)} ${sqlOp} ${qb.addParam(val)}`);
            }
            continue;
          }

          if (!qb.isValidColumn(col)) continue;
          if (Array.isArray(val)) {
            const placeholders = val.map((v) => qb.addParam(v));
            whereClauses.push(`${qb.sanitizeIdentifier(col)} IN (${placeholders.join(', ')})`);
          } else {
            whereClauses.push(`${qb.sanitizeIdentifier(col)} = ${qb.addParam(val)}`);
          }
        }

        // 2) From body.where in form { col: { op, val } }
        if (req.body && req.body.where && typeof req.body.where === 'object') {
          for (const [col, cond] of Object.entries(req.body.where)) {
            if (!qb.isValidColumn(col)) continue;
            let op = '=';
            let val = cond;
            if (typeof cond === 'object' && cond !== null) {
              op = cond.op || 'eq';
              val = cond.val;
            }
            if (val === undefined) continue;
            // string-like ops
            if (op === 'contains') {
              whereClauses.push(`${qb.sanitizeIdentifier(col)} LIKE ${qb.addParam(`%${val}%`)}`);
            } else if (op === 'startswith') {
              whereClauses.push(`${qb.sanitizeIdentifier(col)} LIKE ${qb.addParam(`${val}%`)}`);
            } else if (op === 'endswith') {
              whereClauses.push(`${qb.sanitizeIdentifier(col)} LIKE ${qb.addParam(`%${val}`)}`);
            } else if (['gt', 'gte', 'lt', 'lte'].includes(op)) {
              const map = { gt: '>', gte: '>=', lt: '<', lte: '<=' };
              whereClauses.push(`${qb.sanitizeIdentifier(col)} ${map[op]} ${qb.addParam(val)}`);
            } else {
              whereClauses.push(`${qb.sanitizeIdentifier(col)} = ${qb.addParam(val)}`);
            }
          }
        }

        if (whereClauses.length === 0) {
          throw new Error('No valid filters provided for update');
        }

        let qtext = `UPDATE ${qb.sanitizeIdentifier(tableName)} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
        if (this.dialect === 'postgres') {
          qtext += ' RETURNING *';
        }
        const result = await this.pool.query(qtext, qb.params);
        const rows = result.rows ?? result[0];

        // For MySQL, rows will be affected count info, not actual data
        if (this.dialect === 'mysql') {
          return res.json({ updated: result.affectedRows ?? 0, data: [] });
        }
        return res.json({ updated: rows?.length ?? 0, data: rows });

      } catch (error) {
        console.error(`Error updating ${tableName}:`, error);
        res.status(400).json({ error: error.message });
      }
    });

    // Allow delete by filters (collection-level)
    this.router.delete(basePath, async (req, res) => {
      try {
        const { ...filters } = req.query;
        const qb = new QueryBuilder(tableName, tableSchema, this.dialect);
        const q = qb.buildDeleteWhere(filters);
        const result = await this.pool.query(q.text, q.values);
        const rows = result.rows ?? result[0];
        return res.json({ deleted: rows?.length ?? 0, data: rows });
      } catch (error) {
        console.error(`Error deleting ${tableName}:`, error);
        res.status(400).json({ error: error.message });
      }
    });

    // Create
    this.router.post(basePath, async (req, res) => {
      try {
        const qb = new QueryBuilder(tableName, tableSchema, this.dialect);
        const q = qb.buildInsert(req.body);
        const result = await this.pool.query(q.text, q.values);
        if (this.dialect === 'mysql') {
          const insertId = (result[0] && result[0].insertId) || null;
          if (insertId) {
            const qbSel = new QueryBuilder(tableName, tableSchema, this.dialect);
            const sel = qbSel.buildSelectById(insertId);
            const selRes = await this.pool.query(sel.text, sel.values);
            const rows = selRes.rows ?? selRes[0];
            return res.status(201).json(rows[0] || {});
          }
          return res.status(201).json({ message: 'Record created' });
        }
        return res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error(`Error creating ${tableName}:`, error);
        res.status(400).json({ error: error.message });
      }
    });

    // If table lacks a primary key, skip single-item CRUD routes (only list is available)
    const hasPK = Array.isArray(tableSchema.primaryKeys) && tableSchema.primaryKeys.length > 0;
    if (!hasPK) {
      // Table lacks a primary key: only list/collection-level CRUD routes will be available
      return;
    }

    // Read by id
    this.router.get(`${basePath}/:id`, async (req, res) => {
      try {
        const qb = new QueryBuilder(tableName, tableSchema, this.dialect);
        const q = qb.buildSelectById(req.params.id);
        const result = await this.pool.query(q.text, q.values);
        const rows = result.rows ?? result[0];
        if (!rows || rows.length === 0) {
          return res.status(404).json({ error: 'Record not found' });
        }
        res.json(rows[0]);
      } catch (error) {
        console.error(`Error getting ${tableName}:`, error);
        res.status(500).json({ error: error.message });
      }
    });

    // Update by id
    this.router.put(`${basePath}/:id`, async (req, res) => {
      try {
        const qb = new QueryBuilder(tableName, tableSchema, this.dialect);
        const updateQ = qb.buildUpdate(req.params.id, req.body);
        await this.pool.query(updateQ.text, updateQ.values);

        // Fetch the updated record
        const qb2 = new QueryBuilder(tableName, tableSchema, this.dialect);
        const selectQ = qb2.buildSelectById(req.params.id);
        const result = await this.pool.query(selectQ.text, selectQ.values);
        const rows = result.rows ?? result[0];
        if (!rows || rows.length === 0) {
          return res.status(404).json({ error: 'Record not found' });
        }
        res.json(rows[0]);
      } catch (error) {
        console.error(`Error updating ${tableName}:`, error);
        res.status(500).json({ error: error.message });
      }
    });

    // (Removed per-id delete route) single-item delete routes are intentionally not registered; use collection-level DELETE with filters instead.


  }


  generateRoutes() {
    // Phase 1: register CRUD routes for all tables
    console.debug('Generating CRUD routes for tables:', Object.keys(this.schema));
    for (const [tableName, tableSchema] of Object.entries(this.schema)) {
      this.generateCRUDRoutes(tableName, tableSchema);
    }

    // Public endpoint for UI to fetch generated endpoints (CRUD, REL, multi-join)
    this.router.get('/__generated_endpoints', async (req, res) => {
      try {
        // Compose endpoints from generated cross-table endpoints and relationship routes
        const endpoints = [];

        // Add CRUD endpoints for each table
        for (const [tableName, tableSchema] of Object.entries(this.schema)) {
          // Always expose list endpoint
          endpoints.push({ table: tableName, method: 'GET', path: `/${tableName}`, description: `List ${tableName}`, params: [], type: 'CRUD' });

          // Collection-level update (PUT /table) that accepts { data, where }
          endpoints.push({ table: tableName, method: 'PUT', path: `/${tableName}`, description: `Update ${tableName} by filter (body { data, where })`, params: [{ name: 'body', type: 'body', desc: 'Payload: { data, where }' }], type: 'CRUD' });

          // Collection-level delete (DELETE /table) using filters as query params or body.where
          endpoints.push({ table: tableName, method: 'DELETE', path: `/${tableName}`, description: `Delete ${tableName} by filter (query params or body.where)`, params: [{ name: 'filters', type: 'query', desc: 'Filter query params or provide body.where' }], type: 'CRUD' });

          // Always expose create
          endpoints.push({ table: tableName, method: 'POST', path: `/${tableName}`, description: `Create ${tableName}`, params: [{ name: 'body', type: 'body' }], type: 'CRUD' });
        }

        // Relationship/cross-table endpoints are disabled; only CRUD endpoints will be returned to the UI
        // (Removed REL and multi-join endpoints per user request)

        // Deduplicate by method+path (keep distinct HTTP methods for the same path)
        const unique = [];
        const seen = new Set();
        for (const e of endpoints) {
          const key = `${e.method || 'GET'} ${e.path}`;
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(e);
          }
        }

        res.json({ connectionId: this.connectionId, endpoints: unique });
      } catch (err) {
        console.error('Error returning generated endpoints:', err);
        res.status(500).json({ error: err.message });
      }
    });


    // Relationship/multi-join runtime routes are disabled.

    return this.router;
  }

  /**
   * Execute a graph-based query for local databases
   * Supports: joins, filtering, group by, aggregations, having, sorting, pagination
   */
  async executeGraph(graph, options = {}) {
    const { limit = 50, offset = 0, sort = [], filters: extraFilters = {} } = options;

    if (!graph || !graph.source || !graph.source.table) {
      throw new Error('Missing graph.source.table');
    }

    const sourceTable = graph.source.table;
    const sourceAlias = graph.source.alias || sourceTable;
    const joins = graph.joins || [];
    const groupBy = graph.groupBy || [];
    const aggregations = graph.aggregations || [];
    const having = graph.having || [];
    const outputFields = graph.outputFields || {};
    const graphFilters = graph.filters || [];

    // Get initial data
    const dbData = this.dataStore?.get(this.connectionId) || {};
    let rows = [...(dbData[sourceTable] || [])];

    // Prefix source table columns with table name for disambiguation
    rows = rows.map(row => {
      const prefixed = {};
      for (const [key, value] of Object.entries(row)) {
        prefixed[`${sourceTable}_${key}`] = value;
        prefixed[key] = value; // Keep original for filter matching
      }
      return prefixed;
    });

    // Apply filters to source table
    const applyFilters = (records, filters) => {
      return records.filter(row => {
        for (const filter of filters) {
          const field = filter.field?.split('.').pop() || filter.field;
          const rowVal = String(row[field] ?? row[`${sourceTable}_${field}`] ?? '');
          const filterVal = String(filter.value || '');

          switch (filter.op) {
            case 'eq': if (rowVal !== filterVal) return false; break;
            case 'neq': if (rowVal === filterVal) return false; break;
            case 'gt': if (!(parseFloat(rowVal) > parseFloat(filterVal))) return false; break;
            case 'gte': if (!(parseFloat(rowVal) >= parseFloat(filterVal))) return false; break;
            case 'lt': if (!(parseFloat(rowVal) < parseFloat(filterVal))) return false; break;
            case 'lte': if (!(parseFloat(rowVal) <= parseFloat(filterVal))) return false; break;
            case 'like':
            case 'contains': if (!rowVal.includes(filterVal)) return false; break;
            case 'startswith': if (!rowVal.startsWith(filterVal)) return false; break;
            case 'endswith': if (!rowVal.endsWith(filterVal)) return false; break;
            case 'in': {
              const vals = Array.isArray(filter.value) ? filter.value : String(filter.value).split(',').map(v => v.trim());
              if (!vals.includes(rowVal)) return false;
              break;
            }
          }
        }
        return true;
      });
    };

    rows = applyFilters(rows, graphFilters);

    // Apply joins
    if (joins.length > 0) {
      for (const join of joins) {
        const fromTable = join.from?.table || join.fromTable;
        const toTable = join.to?.table || join.toTable;
        const fromCol = join.from?.field || join.fromColumn;
        const toCol = join.to?.field || join.toColumn;

        const joinedData = dbData[toTable] || [];

        // Left join (keep all rows from source)
        rows = rows.map(sourceRow => {
          // Check both raw column name and prefixed name for matching
          const sourceValue = sourceRow[fromCol] ?? sourceRow[`${fromTable}_${fromCol}`] ?? sourceRow[`${sourceTable}_${fromCol}`];
          const matchingJoinedRows = joinedData.filter(jRow =>
            String(sourceValue) === String(jRow[toCol])
          );

          if (matchingJoinedRows.length === 0) {
            // No match - create a single row with nulls for joined columns
            const result = { ...sourceRow };
            for (const col of (this.schema[toTable]?.columns || [])) {
              // Use tableName_columnName format for disambiguation
              result[`${toTable}_${col.name}`] = null;
            }
            return result;
          }

          // Multiple matches - create one row per match
          return matchingJoinedRows.map(jRow => {
            const result = { ...sourceRow };
            for (const col of (this.schema[toTable]?.columns || [])) {
              // Use tableName_columnName format for disambiguation
              result[`${toTable}_${col.name}`] = jRow[col.name];
            }
            return result;
          });
        }).flat();
      }
    }

    // Apply GROUP BY and aggregations
    if (groupBy.length > 0) {
      const grouped = new Map();

      for (const row of rows) {
        // Create group key from group-by columns
        const groupKey = groupBy.map(g => {
          const col = g.split('.').pop();
          return String(row[col] || '');
        }).join('|');

        if (!grouped.has(groupKey)) {
          grouped.set(groupKey, []);
        }
        grouped.get(groupKey).push(row);
      }

      rows = Array.from(grouped.entries()).map(([groupKey, groupRows]) => {
        const result = {};

        // Add grouped columns
        const groupKeyCols = groupKey.split('|');
        groupBy.forEach((g, idx) => {
          const col = g.split('.').pop();
          result[col] = groupKeyCols[idx];
        });

        // Add aggregations
        for (const agg of aggregations) {
          const field = agg.field?.split('.').pop() || agg.field;
          const alias = agg.as || `${agg.type.toLowerCase()}_${field}`;
          const values = groupRows.map(r => r[field]).filter(v => v !== null && v !== undefined);

          switch (agg.type.toUpperCase()) {
            case 'COUNT':
              result[alias] = groupRows.length;
              break;
            case 'SUM':
              result[alias] = values.reduce((a, b) => a + parseFloat(b), 0);
              break;
            case 'AVG':
              result[alias] = values.length > 0 ? values.reduce((a, b) => a + parseFloat(b), 0) / values.length : 0;
              break;
            case 'MIN':
              result[alias] = values.length > 0 ? Math.min(...values.map(v => parseFloat(v))) : null;
              break;
            case 'MAX':
              result[alias] = values.length > 0 ? Math.max(...values.map(v => parseFloat(v))) : null;
              break;
          }
        }

        return result;
      });
    }

    // Apply HAVING clause
    if (having.length > 0 && aggregations.length > 0) {
      rows = rows.filter(row => {
        for (const h of having) {
          const aggField = h.aggField; // The alias of the aggregation
          const rowVal = parseFloat(row[aggField] || 0);
          const filterVal = parseFloat(h.value || 0);

          switch (h.op) {
            case 'eq': if (rowVal !== filterVal) return false; break;
            case 'neq': if (rowVal === filterVal) return false; break;
            case 'gt': if (!(rowVal > filterVal)) return false; break;
            case 'gte': if (!(rowVal >= filterVal)) return false; break;
            case 'lt': if (!(rowVal < filterVal)) return false; break;
            case 'lte': if (!(rowVal <= filterVal)) return false; break;
            case '>=': if (!(rowVal >= filterVal)) return false; break;
            case '<=': if (!(rowVal <= filterVal)) return false; break;
            case '>': if (!(rowVal > filterVal)) return false; break;
            case '<': if (!(rowVal < filterVal)) return false; break;
          }
        }
        return true;
      });
    }

    // Select output fields - use tableName_fieldName format
    if (Object.keys(outputFields).length > 0 && groupBy.length === 0) {
      rows = rows.map(row => {
        const result = {};
        for (const [table, fields] of Object.entries(outputFields)) {
          if (!fields || fields.length === 0) {
            // Include all fields from this table (with table_ prefix)
            for (const [key, value] of Object.entries(row)) {
              if (key.startsWith(`${table}_`)) {
                result[key] = value;
              }
            }
          } else {
            // Include only selected fields (with table_ prefix)
            for (const field of fields) {
              const prefixedKey = `${table}_${field}`;
              if (row[prefixedKey] !== undefined) {
                result[prefixedKey] = row[prefixedKey];
              } else if (row[field] !== undefined) {
                result[`${table}_${field}`] = row[field];
              }
            }
          }
        }
        return result;
      });
    }

    // Clean up unprefixed keys from final output (keep only tableName_fieldName format)
    rows = rows.map(row => {
      const cleaned = {};
      for (const [key, value] of Object.entries(row)) {
        // Skip unprefixed keys if we have a prefixed version
        if (!key.includes('_') && Object.keys(row).some(k => k.endsWith(`_${key}`))) {
          continue;
        }
        cleaned[key] = value;
      }
      return cleaned;
    });

    // Sort
    if (sort.length > 0) {
      for (const s of sort.reverse()) {
        const field = s.field?.split('.').pop() || s.field;
        const dir = (s.direction || 'ASC').toUpperCase() === 'DESC' ? -1 : 1;
        rows.sort((a, b) => {
          const aVal = a[field];
          const bVal = b[field];
          if (aVal < bVal) return -1 * dir;
          if (aVal > bVal) return 1 * dir;
          return 0;
        });
      }
    }

    // Paginate
    const total = rows.length;
    rows = rows.slice(offset, offset + limit);

    return { rows, total, columns: rows.length > 0 ? Object.keys(rows[0]) : [] };
  }

  /**
   * Execute INSERT, UPDATE, or DELETE operations on local in-memory database
   */
  async executeWrite(operation, graph, data, options = {}) {
    const { previewOnly = false } = options;

    if (!graph || !graph.source || !graph.source.table) {
      throw new Error('Missing graph.source.table');
    }

    // Initialize data store for this connection if needed
    if (!this.dataStore.has(this.connectionId)) {
      this.dataStore.set(this.connectionId, {});
    }
    const connData = this.dataStore.get(this.connectionId);

    // Get all tables involved (source + joined tables)
    const tables = graph.tables || [graph.source.table];

    // Parse data by table prefix (e.g., "users.name" -> { users: { name: value } })
    const dataByTable = {};
    for (const [key, value] of Object.entries(data || {})) {
      const parts = key.split('.');
      let tableName, fieldName;
      if (parts.length >= 2) {
        tableName = parts[0];
        fieldName = parts.slice(1).join('.'); // Handle fields with dots in name
      } else {
        tableName = graph.source.table;
        fieldName = key;
      }
      if (!dataByTable[tableName]) dataByTable[tableName] = {};
      dataByTable[tableName][fieldName] = value;
    }

    const results = { operation, tables: {}, success: true };

    if (operation === 'INSERT') {
      for (const tableName of tables) {
        if (!connData[tableName]) connData[tableName] = [];
        const tableData = dataByTable[tableName] || {};

        // Skip tables with no data
        if (Object.keys(tableData).length === 0) continue;

        // Generate ID if not provided and table has a primary key
        const pks = this.schema[tableName]?.primaryKeys || [];
        const newRow = { ...tableData };

        for (const pk of pks) {
          if (newRow[pk] === undefined || newRow[pk] === '' || newRow[pk] === null) {
            // Auto-generate ID
            const existingIds = connData[tableName].map(r => parseInt(r[pk]) || 0);
            const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
            newRow[pk] = maxId + 1;
          }
        }

        if (previewOnly) {
          results.tables[tableName] = { operation: 'INSERT', data: newRow, preview: true };
        } else {
          connData[tableName].push(newRow);
          console.log(`[LOCAL DB] INSERT into ${tableName} - connectionId: ${this.connectionId}, newRow:`, newRow, 'total rows:', connData[tableName].length);
          results.tables[tableName] = { operation: 'INSERT', data: newRow, inserted: true };
        }
      }
    } else if (operation === 'UPDATE') {
      const additionalFilters = options.additionalFilters || [];

      for (const tableName of tables) {
        if (!connData[tableName]) connData[tableName] = [];
        const tableData = dataByTable[tableName] || {};

        // Skip tables with no data
        if (Object.keys(tableData).length === 0) continue;

        // Find rows to update based on filters
        const graphFilters = (graph.filters || []).filter(f => {
          const filterTable = f.field?.split('.')[0];
          return filterTable === tableName || filterTable === graph.source.alias;
        });

        let updatedCount = 0;
        connData[tableName] = connData[tableName].map(row => {
          // Check if row matches filters
          let matches = true;
          for (const filter of [...graphFilters, ...additionalFilters]) {
            const field = filter.field?.split('.').pop() || filter.field;
            const rowVal = String(row[field] || '');
            const filterVal = String(filter.value || '');

            switch (filter.op) {
              case 'eq': if (rowVal !== filterVal) matches = false; break;
              case 'neq': if (rowVal === filterVal) matches = false; break;
              // Add more operators as needed
            }
          }

          if (matches) {
            updatedCount++;
            if (!previewOnly) {
              return { ...row, ...tableData };
            }
          }
          return row;
        });

        results.tables[tableName] = {
          operation: 'UPDATE',
          data: tableData,
          updatedCount: previewOnly ? `Would update ${updatedCount} row(s)` : updatedCount,
          preview: previewOnly
        };
      }
    } else if (operation === 'DELETE') {
      const additionalFilters = options.additionalFilters || [];
      const sourceTable = graph.source.table;
      const sourceAlias = graph.source.alias || sourceTable;

      if (!connData[sourceTable]) connData[sourceTable] = [];

      const graphFilters = graph.filters || [];
      const beforeCount = connData[sourceTable].length;
      const allFilters = [...graphFilters, ...additionalFilters];

      // Safety check: require at least one filter for DELETE to prevent accidental deletion of all rows
      if (allFilters.length === 0) {
        throw new Error('DELETE requires at least one filter to prevent accidental deletion of all records');
      }

      // Separate filters by table - source table filters vs joined table filters
      const sourceFilters = [];
      const joinedFilters = []; // filters on joined tables

      for (const filter of allFilters) {
        const filterTable = filter.table || sourceTable;
        if (filterTable === sourceTable || filterTable === sourceAlias) {
          sourceFilters.push(filter);
        } else {
          joinedFilters.push(filter);
        }
      }

      // Helper to check if a row matches source filters
      const matchesSourceFilters = (row) => {
        for (const filter of sourceFilters) {
          const field = filter.field?.split('.').pop() || filter.field;
          const rowVal = String(row[field] ?? '');
          const filterVal = String(filter.value ?? '');

          let filterMatches = false;
          switch (filter.op) {
            case 'eq': filterMatches = (rowVal === filterVal); break;
            case 'neq': filterMatches = (rowVal !== filterVal); break;
            case 'gt': filterMatches = (Number(row[field]) > Number(filter.value)); break;
            case 'gte': filterMatches = (Number(row[field]) >= Number(filter.value)); break;
            case 'lt': filterMatches = (Number(row[field]) < Number(filter.value)); break;
            case 'lte': filterMatches = (Number(row[field]) <= Number(filter.value)); break;
            case 'like':
            case 'contains': filterMatches = rowVal.includes(filterVal); break;
            default: filterMatches = (rowVal === filterVal); break;
          }

          if (!filterMatches) return false;
        }
        return true;
      };

      // Helper to check if a source row matches via joined table filters
      const matchesJoinedFilters = (sourceRow) => {
        if (joinedFilters.length === 0) return true;

        // For each joined filter, check if the source row is connected to a matching joined row
        for (const filter of joinedFilters) {
          const filterTable = filter.table;
          const filterField = filter.field?.split('.').pop() || filter.field;

          // Find the join that connects source to this filter's table
          const join = (graph.joins || []).find(j => {
            const toTable = j.to?.table || j.toTable;
            const fromTable = j.from?.table || j.fromTable;
            return toTable === filterTable || fromTable === filterTable;
          });

          if (!join) {
            // No join to this table - can't evaluate filter, skip it
            continue;
          }

          // Determine join direction and get the FK relationship
          const toTable = join.to?.table || join.toTable;
          const fromTable = join.from?.table || join.fromTable;
          const toField = join.to?.field || join.toField;
          const fromField = join.from?.field || join.fromField;

          let sourceJoinField, targetJoinField, targetTable;
          if (fromTable === sourceTable || fromTable === sourceAlias) {
            sourceJoinField = fromField;
            targetJoinField = toField;
            targetTable = toTable;
          } else {
            sourceJoinField = toField;
            targetJoinField = fromField;
            targetTable = fromTable;
          }

          // Get the source row's join key value
          const sourceJoinValue = String(sourceRow[sourceJoinField] ?? '');

          // Find matching rows in the joined table
          const joinedRows = connData[targetTable] || [];
          const matchingJoinedRows = joinedRows.filter(jr => {
            // First check if the join key matches
            if (String(jr[targetJoinField] ?? '') !== sourceJoinValue) return false;

            // Then check if this joined row matches the filter
            const rowVal = String(jr[filterField] ?? '');
            const filterVal = String(filter.value ?? '');

            switch (filter.op) {
              case 'eq': return rowVal === filterVal;
              case 'neq': return rowVal !== filterVal;
              case 'gt': return Number(jr[filterField]) > Number(filter.value);
              case 'gte': return Number(jr[filterField]) >= Number(filter.value);
              case 'lt': return Number(jr[filterField]) < Number(filter.value);
              case 'lte': return Number(jr[filterField]) <= Number(filter.value);
              case 'like':
              case 'contains': return rowVal.includes(filterVal);
              default: return rowVal === filterVal;
            }
          });

          // If no matching joined rows found for this filter, the source row doesn't match
          if (matchingJoinedRows.length === 0) return false;
        }

        return true;
      };

      if (!previewOnly) {
        connData[sourceTable] = connData[sourceTable].filter(row => {
          // Keep rows that DON'T match ALL filters
          const matchesSource = sourceFilters.length === 0 || matchesSourceFilters(row);
          const matchesJoined = matchesJoinedFilters(row);

          // Delete only if BOTH source and joined filters match
          if (matchesSource && matchesJoined) {
            return false; // Don't keep - delete this row
          }
          return true; // Keep this row
        });
      }

      const deletedCount = beforeCount - connData[sourceTable].length;
      results.tables[sourceTable] = {
        operation: 'DELETE',
        deletedCount: previewOnly ? `Would delete rows matching filters` : deletedCount,
        preview: previewOnly
      };
    }

    return results;
  }
}

module.exports = APIGenerator;