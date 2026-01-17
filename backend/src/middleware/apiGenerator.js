const express = require('express');
const QueryBuilder = require('./queryBuilder');

class APIGenerator {
   constructor(connectionId, pool, schema, dialect = 'postgres') {
    this.connectionId = connectionId;
    this.pool = pool;
    this.schema = schema;
    this.dialect = (dialect || 'postgres').toLowerCase();
    this.router = express.Router();

    // Collections for generated metadata (used by UI and executor)
    this._generatedCrossTableEndpoints = [];
    this._skippedCrossTableEndpoints = [];
    this._generatedMultiJoinEndpoints = [];
    this._generatedPairEndpoints = [];
  }
      // For each join table with multiple FKs, add endpoints under each referenced table to get related records by the other FK
      generateCrossTableEndpoints() {
        // Diagnostic collections for generated and skipped cross-table endpoints
        this._generatedCrossTableEndpoints = this._generatedCrossTableEndpoints || [];
        this._skippedCrossTableEndpoints = this._skippedCrossTableEndpoints || [];

        for (const [tableName, tableSchema] of Object.entries(this.schema)) {
          const fks = tableSchema.foreignKeys || [];
          if (fks.length >= 2) {
            for (let i = 0; i < fks.length; i++) {
              for (let j = 0; j < fks.length; j++) {
                if (i === j) continue;
                const fkA = fks[i]; // e.g., order_id
                const fkB = fks[j]; // e.g., product_id

                // Validate required FK metadata before creating the endpoint; skip if any required piece is missing
                const missing = [];
                if (!fkA) missing.push('fkA');
                if (!fkB) missing.push('fkB');
                if (missing.length > 0) {
                  const reason = 'missing fk entries';
                  console.warn('Skipping cross-table endpoint:', reason, { tableName, missing, fkA, fkB });
                  this._skippedCrossTableEndpoints.push({ tableName, fkA, fkB, reason, missing });
                  continue;
                }
                if (!fkA.foreignTable) missing.push('fkA.foreignTable');
                if (!fkA.columnName) missing.push('fkA.columnName');
                if (!fkB.foreignTable) missing.push('fkB.foreignTable');
                if (!fkB.columnName) missing.push('fkB.columnName');
                if (!fkB.foreignColumn) missing.push('fkB.foreignColumn');
                if (missing.length > 0) {
                  const reason = `missing FK metadata: ${missing.join(', ')}`;
                  console.warn(`Skipping cross-table endpoint for ${tableName} due to ${reason}`, { fkA, fkB });
                  this._skippedCrossTableEndpoints.push({ tableName, fkA, fkB, reason, missing });
                  continue;
                }
                // Ensure referenced tables exist in the introspected schema
                if (!this.schema[fkA.foreignTable] || !this.schema[fkB.foreignTable]) {
                  const reason = 'referenced table not present in schema';
                  console.warn(`Skipping cross-table endpoint for ${tableName} because ${reason}`, { fkA, fkB });
                  this._skippedCrossTableEndpoints.push({ tableName, fkA, fkB, reason });
                  continue;
                }

                // Endpoint under fkA.foreignTable: /orders/by_order_id/:order_id/products
                const endpoint = `/${fkA.foreignTable}/by_${fkA.columnName}/:${fkA.columnName}/${fkB.foreignTable}`;
                console.log('Adding cross-table endpoint metadata:', endpoint);
                // Only store metadata; do not register a runtime route (executor will handle execution)
                this._generatedCrossTableEndpoints.push({ endpoint, tableName, fkA, fkB });
              }
            }
          }
        }
      }
    // Recursively generate join endpoints up to a given depth
    generateMultiJoinRoutes(tableName, tableSchema, basePath, visited = []) {
      const fks = tableSchema.foreignKeys || [];
      for (const fk of fks) {
        const nextTable = fk.foreignTable;
        if (visited.includes(nextTable)) continue;
        // Build join path
        const joinPath = [...visited, tableName, nextTable];
        // Endpoint path: /table/by_fk1/:fk1/by_fk2/:fk2/nextTable
        const pathParts = [basePath];
        for (let i = 0; i < joinPath.length - 1; i++) {
          const t = joinPath[i];
          const fkCol = (this.schema[t]?.foreignKeys || []).find(fk2 => fk2.foreignTable === joinPath[i + 1]);
          if (fkCol) {
            pathParts.push(`by_${fkCol.columnName}`);
            pathParts.push(`:${fkCol.columnName}`);
          }
          pathParts.push(joinPath[i + 1]);
        }
        const endpointPath = pathParts.join('/').replace(/\/+/g, '/');
        // Store multi-join endpoint metadata; executor will handle actual execution
        this._generatedMultiJoinEndpoints = this._generatedMultiJoinEndpoints || [];
        if (!this._generatedMultiJoinEndpoints.includes(endpointPath)) this._generatedMultiJoinEndpoints.push(endpointPath);

        // Recurse to next table - continue building metadata
        this.generateMultiJoinRoutes(nextTable, this.schema[nextTable], basePath, [...visited, tableName]);
      }
    }

    // Execute a generated endpoint path (local path relative to router)
    async executeGeneratedEndpoint(localPath, params = {}, query = {}, body = null) {
      // Normalize local path: strip leading slashes
      let local = localPath.replace(/^\/+/, '');

      // Helper to find param value (from params object or literal in path)
      const extractValue = (token) => {
        if (!token) return undefined;
        if (token.startsWith(':')) return params[token.slice(1)];
        return token;
      };

      const parts = local.split('/').filter(Boolean);
      if (parts.length === 0) throw new Error('invalid path');

      // 1) Pair-FK on join table: table/by_fk/:val/by_fk2/:val2
      if (parts.length >= 5 && parts[1] && parts[1].startsWith('by_') && parts[3] && parts[3].startsWith('by_')) {
        const table = parts[0];
        const fk1 = parts[1].slice(3);
        const fk2 = parts[3].slice(3);
        const v1 = extractValue(parts[2]);
        const v2 = extractValue(parts[4]);
        if (v1 === undefined || v2 === undefined) throw new Error('missing parameters for pair-FK endpoint');
        const qb = new QueryBuilder(table, this.schema[table] || {}, this.dialect);
        const qtext = `SELECT * FROM ${qb.sanitizeIdentifier(table)} WHERE ${qb.sanitizeIdentifier(fk1)} = ${qb.addParam(v1)} AND ${qb.sanitizeIdentifier(fk2)} = ${qb.addParam(v2)}`;
        const result = await this.pool.query(qtext, qb.params);
        return result.rows ?? result[0] ?? [];
      }

      // 2) Cross-table endpoint: foreignTable/by_fk/:val/relatedTable
      if (parts.length === 4 && parts[1] && parts[1].startsWith('by_')) {
        const fkForeignTable = parts[0];
        const fkCol = parts[1].slice(3);
        const val = extractValue(parts[2]);
        const relatedTable = parts[3];
        if (val === undefined) throw new Error('missing parameter for cross-table endpoint');
        // Find matching generated cross-table metadata using tolerant matching
        const endpointKey = `/${fkForeignTable}/by_${fkCol}/:${fkCol}/${relatedTable}`;
        const generated = this._generatedCrossTableEndpoints || [];
        const normalize = (p) => (p || '').replace(new RegExp(`^/api/${this.connectionId}`), '').replace(/^\/+/, '');
        const match = generated.find((e) => {
          const a = normalize(e.endpoint).split('/').filter(Boolean);
          const b = normalize(endpointKey).split('/').filter(Boolean);
          if (a.length !== b.length) return false;
          for (let i = 0; i < a.length; i++) {
            const segA = a[i];
            const segB = b[i];
            if (segA.startsWith(':') || segB.startsWith(':')) continue;
            if (segA !== segB) return false;
          }
          return true;
        });
        if (!match) throw new Error('cross-table endpoint not found');
        const joinTable = match.tableName;
        const fkA = match.fkA; // referencing fk (on join table) that points to fkForeignTable
        const fkB = match.fkB; // referencing fk that points to relatedTable
        const qb = new QueryBuilder(joinTable, this.schema[joinTable] || {}, this.dialect);
        const wherePlaceholder = qb.addParam(val);
        const joinSql = `SELECT ${qb.sanitizeIdentifier(fkA.columnName)} as key_id, p.* FROM ${qb.sanitizeIdentifier(joinTable)} jt JOIN ${qb.sanitizeIdentifier(fkB.foreignTable)} p ON jt.${qb.sanitizeIdentifier(fkB.columnName)} = p.${qb.sanitizeIdentifier(fkB.foreignColumn)} WHERE jt.${qb.sanitizeIdentifier(fkA.columnName)} = ${wherePlaceholder}`;
        const result = await this.pool.query(joinSql, qb.params);
        const rows = result.rows ?? result[0] ?? [];
        const items = rows.map((r) => { const copy = { ...r }; delete copy.key_id; return copy; });
        return { [fkA.columnName]: val, [fkB.foreignTable]: items };
      }

      // 3) Multi-join generic: build joinPath from pattern and run join query
      const joinPath = [parts[0]];
      for (let i = 1; i + 2 < parts.length; i += 3) {
        const byPart = parts[i];
        const paramPart = parts[i + 1];
        const nextTbl = parts[i + 2];
        if (!byPart || !byPart.startsWith('by_') || !paramPart || !nextTbl) break;
        joinPath.push(nextTbl);
      }
      if (joinPath.length > 1) {
        // build select list
        const selectList = [];
        for (let i = 0; i < joinPath.length; i++) {
          const tbl = joinPath[i];
          const cols = (this.schema[tbl]?.columns || []).map((c) => c.name);
          for (const col of cols) selectList.push(`t${i}."${col}" AS t${i}__${col}`);
        }
        const qb2 = new QueryBuilder(joinPath[joinPath.length - 1], this.schema[joinPath[joinPath.length - 1]] || {}, this.dialect);
        let sql = `SELECT ${selectList.join(', ')} FROM "${joinPath[0]}" t0`;
        for (let i = 0; i < joinPath.length - 1; i++) {
          const fkCol = (this.schema[joinPath[i]]?.foreignKeys || []).find(fk2 => fk2.foreignTable === joinPath[i + 1]);
          if (!fkCol) {
            throw new Error(`no FK from ${joinPath[i]} to ${joinPath[i+1]}`);
          }
          sql += ` JOIN "${joinPath[i + 1]}" t${i + 1} ON t${i}."${fkCol.columnName}" = t${i + 1}."${fkCol.foreignColumn}"`;
        }
        // where clauses using params
        const whereClauses = [];
        // extract values in order from path tokens
        let pathIdx = 1;
        for (let i = 0; i < joinPath.length - 1; i++) {
          const fkCol = (this.schema[joinPath[i]]?.foreignKeys || []).find(fk2 => fk2.foreignTable === joinPath[i + 1]);
          const token = parts[pathIdx + 1]; // param token at parts[2], [5], ...
          const val = extractValue(token) ?? params[fkCol.columnName] ?? query[fkCol.columnName];
          if (val === undefined) throw new Error(`missing parameter ${fkCol.columnName}`);
          whereClauses.push(`t${i}."${fkCol.columnName}" = ${qb2.addParam(val)}`);
          pathIdx += 3;
        }
        if (whereClauses.length) sql += ' WHERE ' + whereClauses.join(' AND ');
        const result = await this.pool.query(sql, qb2.params);
        // reconstruct last table rows and attach referenced objects as before
        const rows = result.rows ?? result[0] ?? [];
        // build final objects from aliased columns (only return last table enriched)
        const lastIdx = joinPath.length - 1;
        const enriched = [];
        for (const r of rows) {
          const obj = {};
          const cols = (this.schema[joinPath[lastIdx]]?.columns || []).map(c => c.name);
          for (const col of cols) obj[col] = r[`t${lastIdx}__${col}`];
          enriched.push(obj);
        }
        // attach FK referenced objects for final table (batch load)
        const fkValueSets = {};
        const lastSchema = this.schema[joinPath[lastIdx]] || {};
        for (const finalObj of enriched) {
          for (const fk of (lastSchema.foreignKeys || [])) {
            const val = finalObj[fk.columnName];
            if (val === undefined || val === null) continue;
            fkValueSets[fk.foreignTable] = fkValueSets[fk.foreignTable] || { fk, values: new Set() };
            fkValueSets[fk.foreignTable].values.add(val);
          }
        }
        const fkMaps = {};
        for (const [ft, info] of Object.entries(fkValueSets)) {
          const fk = info.fk;
          const vals = Array.from(info.values);
          if (vals.length === 0) continue;
          const qb3 = new QueryBuilder(ft, this.schema[ft] || {}, this.dialect);
          const placeholders = vals.map((v) => qb3.addParam(v));
          const qtext = `SELECT * FROM ${qb3.sanitizeIdentifier(ft)} WHERE ${qb3.sanitizeIdentifier(fk.foreignColumn)} IN (${placeholders.join(', ')})`;
          const fres = await this.pool.query(qtext, qb3.params);
          const fresRows = fres.rows ?? fres[0] ?? [];
          const map = new Map();
          for (const fr of fresRows) map.set(String(fr[fk.foreignColumn]), fr);
          fkMaps[ft] = { fk, map };
        }
        const finalResults = enriched.map((finalObj) => {
          for (const [ft, info] of Object.entries(fkMaps)) {
            const fk = info.fk;
            const map = info.map;
            const fkVal = finalObj[fk.columnName];
            let relName = (fk.columnName && fk.columnName.replace(/_id$/, '')) || (ft.replace(/s$/, '')) || ft;
            if (Object.prototype.hasOwnProperty.call(finalObj, relName)) relName = `${relName}_obj`;
            finalObj[relName] = map.get(String(fkVal)) || null;
          }
          return finalObj;
        });
        return finalResults;
      }

      throw new Error('unsupported path');
    }
 



  // Register basic CRUD routes for a table (only register id-based routes if PK exists)
  generateCRUDRoutes(tableName, tableSchema) {
    const basePath = `/${tableName}`;

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
            if (['like','contains','startswith','endswith'].includes(op)) {
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
            } else if (['gt','gte','lt','lte'].includes(op)) {
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

  generateRelationshipRoutes(/* tableName, tableSchema, basePath */) {
    // Relationship endpoints are disabled - no-op
    return;
  }

    generateRoutes() {
    // Phase 1: register CRUD routes for all tables
    console.debug('Generating CRUD routes for tables:', Object.keys(this.schema));
    for (const [tableName, tableSchema] of Object.entries(this.schema)) {
      this.generateCRUDRoutes(tableName, tableSchema);
    }

    // Relationship/cross-table endpoints are disabled: only CRUD routes will be registered
    // (Removed generation of REL and multi-join endpoints per user request)

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
}

module.exports = APIGenerator;
