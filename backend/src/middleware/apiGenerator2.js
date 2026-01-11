const express = require('express');
const QueryBuilder = require('./queryBuilder');

class APIGenerator {
      // For each join table with multiple FKs, add endpoints under each referenced table to get related records by the other FK
      generateCrossTableEndpoints() {
        for (const [tableName, tableSchema] of Object.entries(this.schema)) {
          const fks = tableSchema.foreignKeys || [];
          if (fks.length >= 2) {
            for (let i = 0; i < fks.length; i++) {
              for (let j = 0; j < fks.length; j++) {
                if (i === j) continue;
                const fkA = fks[i]; // e.g., order_id
                const fkB = fks[j]; // e.g., product_id
                // Endpoint under fkA.foreignTable: /orders/by_order_id/:order_id/products
                const endpoint = `/${fkA.foreignTable}/by_${fkA.columnName}/:${fkA.columnName}/${fkB.foreignTable}`;
                this.router.get(endpoint, async (req, res) => {
                  try {
                    // Get all fkB values for the given fkA, then join to fkB.foreignTable
                    const joinSql = `SELECT jt."${fkA.columnName}" as key_id, json_agg(row_to_json(p.*)) as ${fkB.foreignTable}
                      FROM "${tableName}" jt
                      JOIN "${fkB.foreignTable}" p ON jt."${fkB.columnName}" = p."${fkB.foreignColumn}"
                      WHERE jt."${fkA.columnName}" = $1
                      GROUP BY jt."${fkA.columnName}"`;
                    const values = [req.params[fkA.columnName]];
                    const result = await this.pool.query(joinSql, values);
                    if (result.rows.length === 0) return res.json({ [fkA.columnName]: req.params[fkA.columnName], [fkB.foreignTable]: [] });
                    // Return { order_id, products: [...] }
                    const row = result.rows[0];
                    res.json({ [fkA.columnName]: row.key_id, [fkB.foreignTable]: row[fkB.foreignTable] });
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
    generateMultiJoinRoutes(tableName, tableSchema, basePath, visited = [], maxDepth = 3) {
      if (visited.length >= maxDepth) return;
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
            // Build SQL join for the path
            let sql = `SELECT t${joinPath.length - 1}.* FROM `;
            for (let i = 0; i < joinPath.length; i++) {
              sql += `"${joinPath[i]}" t${i}`;
              if (i < joinPath.length - 1) {
                const fkCol = (this.schema[joinPath[i]]?.foreignKeys || []).find(fk2 => fk2.foreignTable === joinPath[i + 1]);
                if (fkCol) {
                  sql += ` JOIN "${joinPath[i + 1]}" t${i + 1} ON t${i}."${fkCol.columnName}" = t${i + 1}."${fkCol.foreignColumn}"`;
                }
              }
              if (i < joinPath.length - 1) sql += ' ';
            }
            // WHERE clause for all FKs in the path
            const whereClauses = [];
            let paramIdx = 1;
            for (let i = 0; i < joinPath.length - 1; i++) {
              const fkCol = (this.schema[joinPath[i]]?.foreignKeys || []).find(fk2 => fk2.foreignTable === joinPath[i + 1]);
              if (fkCol) {
                whereClauses.push(`t${i}."${fkCol.columnName}" = $${paramIdx++}`);
              }
            }
            if (whereClauses.length) {
              sql += ' WHERE ' + whereClauses.join(' AND ');
            }
            // Collect params from req.params
            const values = [];
            for (let i = 0; i < joinPath.length - 1; i++) {
              const fkCol = (this.schema[joinPath[i]]?.foreignKeys || []).find(fk2 => fk2.foreignTable === joinPath[i + 1]);
              if (fkCol) {
                values.push(req.params[fkCol.columnName]);
              }
            }
            const result = await this.pool.query(sql, values);
            res.json(result.rows);
          } catch (error) {
            console.error(`Error in multi-join endpoint ${endpointPath}:`, error);
            res.status(500).json({ error: error.message });
          }
        });
        // Recurse to next table
        this.generateMultiJoinRoutes(nextTable, this.schema[nextTable], basePath, [...visited, tableName], maxDepth);
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
      const refCol = rfk.referencingColumn;
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
