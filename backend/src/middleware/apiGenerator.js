const express = require('express');
const QueryBuilder = require('./queryBuilder');

class APIGenerator {
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
                console.log('Adding cross-table endpoint:', endpoint);
                this._generatedCrossTableEndpoints.push({ endpoint, tableName, fkA, fkB });

                this.router.get(endpoint, async (req, res) => {
                  try {
                    // Get all fkB rows for the given fkA and build the array in JS (avoids DB-specific JSON functions)
                    try {
                      // Use QueryBuilder to sanitize identifiers and parameter placeholders per dialect
                      const qb = new QueryBuilder(tableName, tableSchema, this.dialect);
                      const wherePlaceholder = qb.addParam(req.params[fkA.columnName]);

                      const joinSql = `SELECT ${qb.sanitizeIdentifier(fkA.columnName)} as key_id, p.* FROM ${qb.sanitizeIdentifier(tableName)} jt JOIN ${qb.sanitizeIdentifier(fkB.foreignTable)} p ON jt.${qb.sanitizeIdentifier(fkB.columnName)} = p.${qb.sanitizeIdentifier(fkB.foreignColumn)} WHERE jt.${qb.sanitizeIdentifier(fkA.columnName)} = ${wherePlaceholder}`;

                      const result = await this.pool.query(joinSql, qb.params);
                      const rows = result.rows ?? result[0] ?? [];
                      if (!rows || rows.length === 0) return res.json({ [fkA.columnName]: req.params[fkA.columnName], [fkB.foreignTable]: [] });

                      // Extract products from rows (remove key_id)
                      const products = rows.map((r) => {
                        const copy = { ...r };
                        delete copy.key_id;
                        return copy;
                      });

                      return res.json({ [fkA.columnName]: req.params[fkA.columnName], [fkB.foreignTable]: products });
                    } catch (err) {
                      // Fallback and surface the original error
                      throw err;
                    }
                  } catch (error) {
                    console.error(`Error in cross-table endpoint ${endpoint}:`, error);
                    res.status(500).json({ error: error.message });
                  }
                });
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
        this.router.get(endpointPath, async (req, res) => {
          try {
            // Build SELECT list and FROM/JOIN clauses (chain joins)
            const selectList = [];
            for (let i = 0; i < joinPath.length; i++) {
              const tbl = joinPath[i];
              const cols = (this.schema[tbl]?.columns || []).map((c) => c.name);
              for (const col of cols) {
                selectList.push(`t${i}."${col}" AS t${i}__${col}`);
              }
            }

            const qb = new QueryBuilder(joinPath[joinPath.length - 1], this.schema[joinPath[joinPath.length - 1]] || {}, this.dialect);

            let sql = `SELECT ${selectList.join(', ')} FROM "${joinPath[0]}" t0`;
            for (let i = 0; i < joinPath.length - 1; i++) {
              const fkCol = (this.schema[joinPath[i]]?.foreignKeys || []).find(fk2 => fk2.foreignTable === joinPath[i + 1]);
              if (!fkCol) {
                throw new Error(`Could not find FK from ${joinPath[i]} to ${joinPath[i + 1]}`);
              }
              sql += ` JOIN "${joinPath[i + 1]}" t${i + 1} ON t${i}."${fkCol.columnName}" = t${i + 1}."${fkCol.foreignColumn}"`;
            }

            // WHERE clause for all FKs in the path (parameters added to qb)
            const whereClauses = [];
            for (let i = 0; i < joinPath.length - 1; i++) {
              const fkCol = (this.schema[joinPath[i]]?.foreignKeys || []).find(fk2 => fk2.foreignTable === joinPath[i + 1]);
              if (fkCol) {
                whereClauses.push(`t${i}."${fkCol.columnName}" = ${qb.addParam(req.params[fkCol.columnName])}`);
              }
            }
            if (whereClauses.length) {
              sql += ' WHERE ' + whereClauses.join(' AND ');
            }

            const result = await this.pool.query(sql, qb.params);
            res.json(result.rows);
          } catch (error) {
            console.error(`Error in multi-join endpoint ${endpointPath}:`, error);
            res.status(500).json({ error: error.message });
          }
        });
        // Recurse to next table
        this.generateMultiJoinRoutes(nextTable, this.schema[nextTable], basePath, [...visited, tableName]);
      }
    }
  constructor(connectionId, pool, schema, dialect = 'postgres') {
    this.connectionId = connectionId;
    this.pool = pool;
    this.schema = schema;
    this.dialect = dialect;
    this.router = express.Router();
  }

  generateRoutes() {
    for (const [tableName, tableSchema] of Object.entries(this.schema)) {
      this.generateTableRoutes(tableName, tableSchema);
    }
    this.generateCrossTableEndpoints();

    // Debug route to return generated and skipped cross-table endpoints for this connection
    this.router.get('/__debug/generated-routes', async (req, res) => {
      try {
        res.json({
          connectionId: this.connectionId,
          generated: this._generatedCrossTableEndpoints || [],
          skipped: this._skippedCrossTableEndpoints || [],
        });
      } catch (err) {
        console.error('Error returning generated routes debug info:', err);
        res.status(500).json({ error: err.message });
      }
    });

    return this.router;
  }

  generateTableRoutes(tableName, tableSchema) {
    const basePath = `/${tableName}`;

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

    // Allow delete by filters (no ordering/paging) at collection level
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

    // Support updates using query-string filters, e.g. PUT /table?col1=val1&col2=val2
    this.router.put(`${basePath}`, async (req, res) => {
      try {
        const qb = new QueryBuilder(tableName, tableSchema, this.dialect);

        // Build WHERE clause from query params
        const whereClauses = [];
        for (const [col, val] of Object.entries(req.query || {})) {
          if (!qb.isValidColumn(col)) continue;
          if (Array.isArray(val)) {
            // multiple values -> IN
            const placeholders = val.map((v) => qb.addParam(v));
            whereClauses.push(`${qb.sanitizeIdentifier(col)} IN (${placeholders.join(', ')})`);
          } else {
            whereClauses.push(`${qb.sanitizeIdentifier(col)} = ${qb.addParam(val)}`);
          }
        }

        if (whereClauses.length === 0) {
          throw new Error('No valid query filters provided for update');
        }

        // Determine data to update
        const data = req.body && Object.keys(req.body).length ? (req.body.data || req.body) : null;
        if (!data || Object.keys(data).length === 0) {
          throw new Error('No data provided for update');
        }

        // Build SET clause
        const setClauses = [];
        for (const [column, value] of Object.entries(data)) {
          if (qb.isValidColumn(column)) {
            setClauses.push(`${qb.sanitizeIdentifier(column)} = ${qb.addParam(value)}`);
          }
        }
        if (setClauses.length === 0) {
          throw new Error('No valid columns to update');
        }

        let sql = `UPDATE ${qb.sanitizeIdentifier(tableName)} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
        if (qb.dialect === 'postgres') sql += ' RETURNING *';
        const q = { text: sql, values: qb.params };

        const result = await this.pool.query(q.text, q.values);
        if (this.dialect === 'mysql') {
          return res.json({ message: 'Records updated' });
        }
        if (!result.rows || result.rows.length === 0) {
          return res.status(404).json({ error: 'Record not found' });
        }
        return res.json(result.rows[0]);
      } catch (error) {
        console.error(`Error updating ${tableName} (by query filters):`, error);
        res.status(400).json({ error: error.message });
      }
    });

    this.router.put(`${basePath}/:id`, async (req, res) => {
      try {
        const qb = new QueryBuilder(tableName, tableSchema, this.dialect);
        let q;
        // Support { data, where } payload
        if (req.body && req.body.data && req.body.where) {
          // Build dynamic WHERE clause from req.body.where
          const whereClauses = [];
          const pk = tableSchema.primaryKeys[0];
          let pkValue = req.params.id;
          for (const [col, cond] of Object.entries(req.body.where)) {
            if (!qb.isValidColumn(col)) continue;
            let op = '=';
            let val = cond;
            if (typeof cond === 'object' && cond !== null) {
              op = cond.op === 'contains' ? 'LIKE' : (cond.op || 'eq');
              if (op === 'eq') op = '=';
              val = cond.val;
              if (op === 'LIKE') val = `%${val}%`;
            }
            whereClauses.push(`${qb.sanitizeIdentifier(col)} ${op} ${qb.addParam(val)}`);
            if (col === pk) pkValue = val;
          }
          if (whereClauses.length === 0 && pkValue) {
            whereClauses.push(`${qb.sanitizeIdentifier(pk)} = ${qb.addParam(pkValue)}`);
          }
          if (whereClauses.length === 0) {
            throw new Error('No valid WHERE conditions for update');
          }
          // Build SET clause
          const setClauses = [];
          for (const [column, value] of Object.entries(req.body.data)) {
            if (qb.isValidColumn(column) && column !== pk) {
              setClauses.push(`${qb.sanitizeIdentifier(column)} = ${qb.addParam(value)}`);
            }
          }
          if (setClauses.length === 0) {
            throw new Error('No valid columns to update');
          }
          let sql = `UPDATE ${qb.sanitizeIdentifier(tableName)} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
          if (qb.dialect === 'postgres') sql += ' RETURNING *';
          q = { text: sql, values: qb.params };
        } else {
          // Fallback: classic single PK update
          q = qb.buildUpdate(req.params.id, req.body.data || req.body);
        }
        const result = await this.pool.query(q.text, q.values);
        if (this.dialect === 'mysql') {
          const qbSel = new QueryBuilder(tableName, tableSchema, this.dialect);
          const sel = qbSel.buildSelectById(req.params.id);
          const selRes = await this.pool.query(sel.text, sel.values);
          const rows = selRes.rows ?? selRes[0];
          if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Record not found' });
          }
          return res.json(rows[0]);
        }
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Record not found' });
        }
        return res.json(result.rows[0]);
      } catch (error) {
        console.error(`Error updating ${tableName}:`, error);
        res.status(400).json({ error: error.message });
      }
    });

    this.router.delete(`${basePath}/:id`, async (req, res) => {
      try {
        const qb = new QueryBuilder(tableName, tableSchema, this.dialect);
        const q = qb.buildDelete(req.params.id);
        const result = await this.pool.query(q.text, q.values);
        if (this.dialect === 'mysql') {
          return res.json({ message: 'Record deleted' });
        }
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Record not found' });
        }
        return res.json({ message: 'Record deleted', data: result.rows[0] });
      } catch (error) {
        console.error(`Error deleting ${tableName}:`, error);
        res.status(500).json({ error: error.message });
      }
    });

    this.generateRelationshipRoutes(tableName, tableSchema, basePath);
    // Generate multi-join endpoints up to 3 tables
    this.generateMultiJoinRoutes(tableName, tableSchema, basePath, [], 3);
  }

  generateRelationshipRoutes(tableName, tableSchema, basePath) {
    // For each FK, generate a unique endpoint using the FK column (existing behavior)
    for (const fk of tableSchema.foreignKeys || []) {
      const relatedTable = fk.foreignTable;
      const fkCol = fk.columnName;
      this.router.get(`${basePath}/by_${fkCol}/:${fkCol}/${relatedTable}`, async (req, res) => {
        try {
          const qb = new QueryBuilder(tableName, tableSchema, this.dialect);
          const q = qb.buildRelatedQuery(relatedTable, req.params[fkCol], req.query, fkCol);
          const result = await this.pool.query(q.text, q.values);
          const rows = result.rows ?? result[0];
          res.json(rows);
        } catch (error) {
          console.error(`Error getting related ${relatedTable} by ${fkCol}:`, error);
          res.status(500).json({ error: error.message });
        }
      });
    }

    // For each reverse FK, generate a unique endpoint using the referencing column (existing behavior)
    for (const rfk of tableSchema.reverseForeignKeys || []) {
      const relatedTable = rfk.referencingTable;
      this.router.get(`${basePath}/by_${rfk.referencedColumn}/:${rfk.referencedColumn}/${relatedTable}`, async (req, res) => {
        try {
          const qb = new QueryBuilder(tableName, tableSchema, this.dialect);
          const q = qb.buildRelatedQuery(relatedTable, req.params[rfk.referencedColumn], req.query, rfk.referencedColumn);
          const result = await this.pool.query(q.text, q.values);
          const rows = result.rows ?? result[0];
          res.json(rows);
        } catch (error) {
          console.error(`Error getting related ${relatedTable} by ${rfk.referencedColumn}:`, error);
          res.status(500).json({ error: error.message });
        }
      });
    }

    // For join tables with 2+ FKs, generate endpoints for each pair of FKs within the same table
    const fks = tableSchema.foreignKeys || [];
    if (fks.length >= 2) {
      for (let i = 0; i < fks.length; i++) {
        for (let j = 0; j < fks.length; j++) {
          if (i === j) continue;
          const fkA = fks[i];
          const fkB = fks[j];
          // e.g., /order_items/by_order_id/:order_id/by_product_id/:product_id
          this.router.get(`${basePath}/by_${fkA.columnName}/:${fkA.columnName}/by_${fkB.columnName}/:${fkB.columnName}`, async (req, res) => {
            try {
              const sql = `SELECT * FROM "${tableName}" WHERE "${fkA.columnName}" = $1 AND "${fkB.columnName}" = $2`;
              const values = [req.params[fkA.columnName], req.params[fkB.columnName]];
              const result = await this.pool.query(sql, values);
              res.json(result.rows);
            } catch (error) {
              console.error(`Error getting ${tableName} by ${fkA.columnName} and ${fkB.columnName}:`, error);
              res.status(500).json({ error: error.message });
            }
          });
        }
      }
    }
  }
}

module.exports = APIGenerator;
